#!/usr/bin/env python3
"""
=== FILE 10: evaluate.py ===
Evaluates the trained model: per-class metrics, confusion matrix,
and sample inference on test images.
"""
import os, sys, csv
from pathlib import Path
from collections import defaultdict
import numpy as np

print("=== FILE 10: evaluate.py ===")

from braille_lookup import CLASS_NAMES, IDX_TO_CLASS, CLASS_TO_IDX

# ─────────────────────────────────────────────────────────────────────────────
# Load model
# ─────────────────────────────────────────────────────────────────────────────
weights = Path("./runs/stage2/weights/best.pt")
if not weights.exists():
    print(f"ERROR: Weights not found at {weights}")
    print("Run train_stage2.py first.")
    sys.exit(1)

from ultralytics import YOLO
model = YOLO(str(weights))
print(f"  Model loaded: {weights}")

# ─────────────────────────────────────────────────────────────────────────────
# Run validation on test set
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Running validation on test set ──")
results = model.val(
    data="./data/final/data.yaml",
    split="test",
    imgsz=640,
    batch=32,
    device=0,
    verbose=True,
)

# Extract metrics
print("\n" + "=" * 60)
print("Per-Class Metrics:")
print("=" * 60)
print(f"  {'Class':<15s} {'mAP50':>8s} {'mAP50-95':>10s} {'Precision':>10s} {'Recall':>8s}")
print("  " + "-" * 55)

# results.box contains per-class data
metrics_data = []
warnings = []

# Access per-class metrics from results
try:
    ap50 = results.box.ap50 if hasattr(results.box, 'ap50') else [0]*40
    ap = results.box.ap if hasattr(results.box, 'ap') else [0]*40
    p_cls = results.box.p if hasattr(results.box, 'p') else [0]*40
    r_cls = results.box.r if hasattr(results.box, 'r') else [0]*40
except Exception:
    ap50 = [0]*40
    ap = [0]*40
    p_cls = [0]*40
    r_cls = [0]*40

for i, cls_name in enumerate(CLASS_NAMES):
    if i < len(ap50):
        m50 = float(ap50[i])
        m5095 = float(ap[i]) if i < len(ap) else 0
        prec = float(p_cls[i]) if i < len(p_cls) else 0
        rec = float(r_cls[i]) if i < len(r_cls) else 0
    else:
        m50 = m5095 = prec = rec = 0.0

    flag = ""
    if m50 < 0.70:
        flag = " ⚠ WARNING: mAP50 < 0.70"
        warnings.append(cls_name)

    print(f"  {cls_name:<15s} {m50:>8.4f} {m5095:>10.4f} {prec:>10.4f} {rec:>8.4f}{flag}")
    metrics_data.append({
        "class": cls_name,
        "mAP50": m50,
        "mAP50-95": m5095,
        "precision": prec,
        "recall": rec,
    })

# Overall metrics
try:
    overall_map50 = float(results.box.map50)
    overall_map5095 = float(results.box.map)
    overall_p = float(results.box.mp)
    overall_r = float(results.box.mr)
except Exception:
    overall_map50 = overall_map5095 = overall_p = overall_r = 0.0

print(f"\n  Overall mAP50:    {overall_map50:.4f}")
print(f"  Overall mAP50-95: {overall_map5095:.4f}")
print(f"  Overall Precision: {overall_p:.4f}")
print(f"  Overall Recall:    {overall_r:.4f}")

if warnings:
    print(f"\n  ⚠ Classes with mAP50 < 0.70: {warnings}")

# ─────────────────────────────────────────────────────────────────────────────
# Sample inference: 5 synthetic + 5 real test images
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Sample Inference ──")

CHAR_MAP = {}
for c in "abcdefghijklmnopqrstuvwxyz":
    CHAR_MAP[c] = c
# Space is inferred from gaps between detections, not a detected class
CHAR_MAP["period"] = "."
CHAR_MAP["comma"] = ","
CHAR_MAP["question"] = "?"
CHAR_MAP["exclamation"] = "!"
for i, name in enumerate(["zero","one","two","three","four","five","six","seven","eight","nine"]):
    CHAR_MAP[name] = str(i)


def detections_to_text(results_obj):
    """Sort detections in reading order and convert to text. Infer spaces from gaps."""
    boxes = results_obj.boxes
    if boxes is None or len(boxes) == 0:
        return "(no detections)"

    # Get box data
    xyxy = boxes.xyxy.cpu().numpy()
    cls_ids = boxes.cls.cpu().numpy().astype(int)
    confs = boxes.conf.cpu().numpy()

    # Sort by y (top→bottom), then x (left→right)
    # Group into lines by y-coordinate clustering
    centers = [(xyxy[i][0] + xyxy[i][2])/2 for i in range(len(xyxy))]
    y_centers = [(xyxy[i][1] + xyxy[i][3])/2 for i in range(len(xyxy))]
    widths = [xyxy[i][2] - xyxy[i][0] for i in range(len(xyxy))]

    # Simple line grouping: sort by y, detect gaps
    indices = list(range(len(xyxy)))
    indices.sort(key=lambda i: y_centers[i])

    lines = []
    current_line = [indices[0]]
    for k in range(1, len(indices)):
        if y_centers[indices[k]] - y_centers[indices[k-1]] > 30:  # new line threshold
            lines.append(current_line)
            current_line = [indices[k]]
        else:
            current_line.append(indices[k])
    lines.append(current_line)

    # Sort each line left→right, infer spaces from x-gaps
    avg_w = np.mean(widths) if widths else 30
    space_threshold = avg_w * 0.8  # gap > 0.8× avg char width → space
    text_lines = []
    for line in lines:
        line.sort(key=lambda i: centers[i])
        chars = []
        for idx_in_line, i in enumerate(line):
            # Insert space if gap between this and previous char is large
            if idx_in_line > 0:
                prev_i = line[idx_in_line - 1]
                gap = xyxy[i][0] - xyxy[prev_i][2]  # left edge - prev right edge
                if gap > space_threshold:
                    chars.append(" ")
            cls_name = IDX_TO_CLASS.get(cls_ids[i], "?")
            ch = CHAR_MAP.get(cls_name, "?")
            chars.append(ch)
        text_lines.append("".join(chars))

    return "\n".join(text_lines)


test_img_dir = Path("./data/final/test/images")
test_images = sorted(test_img_dir.iterdir()) if test_img_dir.exists() else []

# Separate synthetic vs real (heuristic: filename prefix)
synth_imgs = [f for f in test_images if "synth" in f.stem or "train" in f.stem or "val" in f.stem]
real_imgs = [f for f in test_images if "angelina" in f.stem or "dsbi" in f.stem]
# Fallback: just take first and last
if not synth_imgs:
    synth_imgs = test_images[:len(test_images)//2]
if not real_imgs:
    real_imgs = test_images[len(test_images)//2:]

import random
random.seed(42)
sample_synth = random.sample(synth_imgs, min(5, len(synth_imgs)))
sample_real = random.sample(real_imgs, min(5, len(real_imgs)))

print("\n  Synthetic test images:")
for img_f in sample_synth:
    preds = model.predict(str(img_f), imgsz=640, conf=0.25, verbose=False)
    text = detections_to_text(preds[0])
    n_det = len(preds[0].boxes) if preds[0].boxes is not None else 0
    print(f"    {img_f.name}: [{n_det} detections] → \"{text}\"")

print("\n  Real test images:")
for img_f in sample_real:
    preds = model.predict(str(img_f), imgsz=640, conf=0.25, verbose=False)
    text = detections_to_text(preds[0])
    n_det = len(preds[0].boxes) if preds[0].boxes is not None else 0
    print(f"    {img_f.name}: [{n_det} detections] → \"{text}\"")

# ─────────────────────────────────────────────────────────────────────────────
# Save outputs
# ─────────────────────────────────────────────────────────────────────────────
results_dir = Path("./results")
results_dir.mkdir(parents=True, exist_ok=True)

# Save confusion matrix
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    # The confusion matrix is auto-generated by ultralytics during val
    cm_src = Path("./runs/stage2/val/confusion_matrix.png")
    cm_dst = results_dir / "confusion_matrix.png"
    if cm_src.exists():
        import shutil
        shutil.copy2(cm_src, cm_dst)
        print(f"\n  Saved confusion matrix: {cm_dst}")
    else:
        # Try to find it in recent run
        for p in Path("./runs").rglob("confusion_matrix.png"):
            import shutil
            shutil.copy2(p, cm_dst)
            print(f"\n  Saved confusion matrix: {cm_dst}")
            break
except Exception as e:
    print(f"\n  WARNING: could not save confusion matrix: {e}")

# Save metrics CSV
csv_path = results_dir / "metrics.csv"
with open(csv_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["class", "mAP50", "mAP50-95", "precision", "recall"])
    writer.writeheader()
    writer.writerows(metrics_data)
    # Overall row
    writer.writerow({
        "class": "OVERALL",
        "mAP50": overall_map50,
        "mAP50-95": overall_map5095,
        "precision": overall_p,
        "recall": overall_r,
    })
print(f"  Saved metrics: {csv_path}")

print("\n" + "=" * 60)
print("Evaluation Summary:")
print("=" * 60)
print(f"  mAP50:    {overall_map50:.4f}")
print(f"  mAP50-95: {overall_map5095:.4f}")
print(f"  Warnings: {len(warnings)} classes below 0.70 mAP50")
print(f"  Results:  {results_dir}/")
print("\n=== evaluate.py complete ===")
