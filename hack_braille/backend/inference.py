#!/usr/bin/env python3
"""
=== FILE 12: inference.py ===
CLI inference: reads a Braille photo, runs ONNX detection,
sorts detections in reading order, outputs English text.

Usage: python inference.py --image photo.jpg
"""
import argparse, os, sys, time
from pathlib import Path
import numpy as np
import cv2

print("=== FILE 12: inference.py ===")

from braille_lookup import CLASS_NAMES, IDX_TO_CLASS, CLASS_TO_IDX

# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Braille → English text inference")
parser.add_argument("--image", required=True, help="Path to input image (JPG/PNG)")
parser.add_argument("--model", default="./exports/braille_yolo11n.onnx", help="ONNX model path")
parser.add_argument("--conf", type=float, default=0.3, help="Confidence threshold")
parser.add_argument("--iou", type=float, default=0.45, help="NMS IoU threshold")
parser.add_argument("--imgsz", type=int, default=640, help="Input image size")
args = parser.parse_args()

# ─────────────────────────────────────────────────────────────────────────────
# Validate inputs
# ─────────────────────────────────────────────────────────────────────────────
img_path = Path(args.image)
if not img_path.exists():
    print(f"ERROR: Image not found: {img_path}")
    sys.exit(1)

model_path = Path(args.model)
if not model_path.exists():
    print(f"ERROR: Model not found: {model_path}")
    print("Run export.py first to generate the ONNX model.")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# Character mapping for output
# ─────────────────────────────────────────────────────────────────────────────
CHAR_MAP = {}
for c in "abcdefghijklmnopqrstuvwxyz":
    CHAR_MAP[c] = c
# Space is inferred from x-gaps between detections, not a detected class
CHAR_MAP["period"] = "."
CHAR_MAP["comma"] = ","
CHAR_MAP["question"] = "?"
CHAR_MAP["exclamation"] = "!"
for i, name in enumerate(["zero","one","two","three","four","five","six","seven","eight","nine"]):
    CHAR_MAP[name] = str(i)


# ─────────────────────────────────────────────────────────────────────────────
# Preprocessing: grayscale → CLAHE → normalize [0,1]
# ─────────────────────────────────────────────────────────────────────────────
def preprocess(img_bgr, target_size=640):
    """Preprocess image for ONNX inference."""
    # Grayscale
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Convert back to 3-channel (model expects RGB)
    rgb = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB)

    # Resize with letterboxing
    h, w = rgb.shape[:2]
    scale = target_size / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    resized = cv2.resize(rgb, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    # Pad to square
    canvas = np.full((target_size, target_size, 3), 114, dtype=np.uint8)
    pad_x = (target_size - new_w) // 2
    pad_y = (target_size - new_h) // 2
    canvas[pad_y:pad_y+new_h, pad_x:pad_x+new_w] = resized

    # Normalize to [0,1] and transpose to NCHW
    blob = canvas.astype(np.float32) / 255.0
    blob = np.transpose(blob, (2, 0, 1))  # HWC → CHW
    blob = np.expand_dims(blob, axis=0)    # add batch dim

    return blob, scale, pad_x, pad_y, w, h


# ─────────────────────────────────────────────────────────────────────────────
# Post-processing: NMS + reading order
# ─────────────────────────────────────────────────────────────────────────────
def nms(boxes, scores, iou_threshold):
    """Non-maximum suppression."""
    if len(boxes) == 0:
        return []
    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0, xx2 - xx1)
        h = np.maximum(0, yy2 - yy1)
        inter = w * h
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]
    return keep


def postprocess(output, conf_thresh, iou_thresh, scale, pad_x, pad_y, orig_w, orig_h, imgsz):
    """
    Parse ONNX output → list of (x1, y1, x2, y2, class_id, confidence) in original coords.
    YOLO output shape: [1, num_classes+4, num_boxes] or [1, num_boxes, num_classes+4]
    """
    pred = output[0]  # first output tensor

    # Handle different output shapes
    if pred.ndim == 3:
        if pred.shape[1] == len(CLASS_NAMES) + 4:
            # Shape: [1, 44, N] → transpose to [1, N, 44]
            pred = np.transpose(pred, (0, 2, 1))
        pred = pred[0]  # remove batch dim → [N, 44]
    elif pred.ndim == 2:
        pass  # already [N, 44]

    # Extract boxes and class scores
    cx = pred[:, 0]
    cy = pred[:, 1]
    w = pred[:, 2]
    h = pred[:, 3]
    class_scores = pred[:, 4:]  # [N, 40]

    # Get best class per box
    class_ids = np.argmax(class_scores, axis=1)
    confidences = np.max(class_scores, axis=1)

    # Filter by confidence
    mask = confidences >= conf_thresh
    cx, cy, w, h = cx[mask], cy[mask], w[mask], h[mask]
    class_ids = class_ids[mask]
    confidences = confidences[mask]

    if len(cx) == 0:
        return []

    # Convert to xyxy
    x1 = cx - w / 2
    y1 = cy - h / 2
    x2 = cx + w / 2
    y2 = cy + h / 2
    boxes = np.stack([x1, y1, x2, y2], axis=1)

    # NMS per class
    final_detections = []
    for cls_id in np.unique(class_ids):
        cls_mask = class_ids == cls_id
        cls_boxes = boxes[cls_mask]
        cls_scores = confidences[cls_mask]
        keep = nms(cls_boxes, cls_scores, iou_thresh)
        for k in keep:
            bx1, by1, bx2, by2 = cls_boxes[k]
            # Convert from padded/scaled coords back to original
            bx1 = (bx1 - pad_x) / scale
            by1 = (by1 - pad_y) / scale
            bx2 = (bx2 - pad_x) / scale
            by2 = (by2 - pad_y) / scale
            # Clamp
            bx1 = max(0, min(orig_w, bx1))
            by1 = max(0, min(orig_h, by1))
            bx2 = max(0, min(orig_w, bx2))
            by2 = max(0, min(orig_h, by2))
            final_detections.append((bx1, by1, bx2, by2, int(cls_id), float(cls_scores[k])))

    return final_detections


def group_into_lines(detections, line_threshold=None):
    """
    Group detections into lines by y-coordinate clustering.
    Sort left-to-right within each line.
    """
    if not detections:
        return []

    # Compute centers
    centers = [(d[0]+d[2])/2 for d in detections]
    y_centers = [(d[1]+d[3])/2 for d in detections]

    # Estimate line height from box heights
    heights = [d[3]-d[1] for d in detections]
    avg_height = np.mean(heights) if heights else 30

    if line_threshold is None:
        line_threshold = avg_height * 0.6

    # Sort by y center
    sorted_indices = sorted(range(len(detections)), key=lambda i: y_centers[i])

    lines = []
    current_line = [sorted_indices[0]]
    for k in range(1, len(sorted_indices)):
        if y_centers[sorted_indices[k]] - y_centers[sorted_indices[k-1]] > line_threshold:
            lines.append(current_line)
            current_line = [sorted_indices[k]]
        else:
            current_line.append(sorted_indices[k])
    lines.append(current_line)

    # Sort each line left-to-right
    result_lines = []
    for line in lines:
        line.sort(key=lambda i: centers[i])
        result_lines.append(line)

    return result_lines


# ─────────────────────────────────────────────────────────────────────────────
# Run inference
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n  Input:  {img_path}")
print(f"  Model:  {model_path}")
print(f"  Conf:   {args.conf}")
print(f"  IoU:    {args.iou}")

# Load image
img_bgr = cv2.imread(str(img_path))
if img_bgr is None:
    print(f"ERROR: Cannot read image: {img_path}")
    sys.exit(1)

print(f"  Image size: {img_bgr.shape[1]}×{img_bgr.shape[0]}")

# Preprocess
blob, scale, pad_x, pad_y, orig_w, orig_h = preprocess(img_bgr, args.imgsz)

# Load ONNX model
import onnxruntime as ort

providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
available = ort.get_available_providers()
if "CUDAExecutionProvider" not in available:
    providers = ["CPUExecutionProvider"]
    print("  Using CPU inference")
else:
    print("  Using GPU inference")

sess = ort.InferenceSession(str(model_path), providers=providers)
input_name = sess.get_inputs()[0].name

# Inference
t0 = time.perf_counter()
output = sess.run(None, {input_name: blob})
t1 = time.perf_counter()
inference_ms = (t1 - t0) * 1000
print(f"  Inference time: {inference_ms:.2f} ms")

# Post-process
detections = postprocess(output, args.conf, args.iou, scale, pad_x, pad_y, orig_w, orig_h, args.imgsz)
print(f"  Detections: {len(detections)}")

# Group into lines and produce text (spaces inferred from x-gaps)
lines = group_into_lines(detections)
# Compute average char width for space threshold
all_widths = [detections[i][2] - detections[i][0] for i in range(len(detections))]
avg_char_w = np.mean(all_widths) if all_widths else 30
space_threshold = avg_char_w * 0.8  # gap > 0.8× avg width → insert space

text_lines = []
for line_indices in lines:
    chars = []
    for idx_in_line, i in enumerate(line_indices):
        # Insert space if gap between this and previous detection is large
        if idx_in_line > 0:
            prev_i = line_indices[idx_in_line - 1]
            gap = detections[i][0] - detections[prev_i][2]  # left edge - prev right edge
            if gap > space_threshold:
                chars.append(" ")
        cls_id = detections[i][4]
        cls_name = IDX_TO_CLASS.get(cls_id, "?")
        ch = CHAR_MAP.get(cls_name, "?")
        chars.append(ch)
    text_lines.append("".join(chars))

output_text = "\n".join(text_lines)

print(f"\n{'='*60}")
print("Detected English Text:")
print("=" * 60)
print(output_text)
print("=" * 60)

# ─────────────────────────────────────────────────────────────────────────────
# Save annotated image
# ─────────────────────────────────────────────────────────────────────────────
annotated = img_bgr.copy()
colors = {}  # class_id → BGR color
for det in detections:
    x1, y1, x2, y2, cls_id, conf = det
    cls_name = IDX_TO_CLASS.get(cls_id, "?")
    ch = CHAR_MAP.get(cls_name, "?")

    # Generate color per class
    if cls_id not in colors:
        np.random.seed(cls_id * 17 + 42)
        colors[cls_id] = tuple(int(x) for x in np.random.randint(50, 255, 3))

    color = colors[cls_id]
    cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
    label = f"{ch} {conf:.2f}"
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    cv2.rectangle(annotated, (int(x1), int(y1)-th-6), (int(x1)+tw+4, int(y1)), color, -1)
    cv2.putText(annotated, label, (int(x1)+2, int(y1)-4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1, cv2.LINE_AA)

result_path = img_path.parent / f"{img_path.stem}_result.jpg"
cv2.imwrite(str(result_path), annotated, [cv2.IMWRITE_JPEG_QUALITY, 95])
print(f"\n  Annotated image saved: {result_path}")

print("\n=== inference.py complete ===")
