#!/usr/bin/env python3
"""
=== FILE 6: augment_real_data.py ===
Augments real (non-synthetic) converted data using Albumentations.
4 augmented copies per image. NO flips — Braille is not flip-symmetric.
Input:  ./data/converted/{kaggle,roboflow,user,dsbi,angelina}/
Output: ./data/augmented/{images,labels}/
"""
import os, sys, shutil
from pathlib import Path
from collections import Counter
import cv2
import numpy as np
import albumentations as A
from tqdm import tqdm

print("=== FILE 6: augment_real_data.py ===")

from braille_lookup import CLASS_NAMES, CLASS_TO_IDX, IDX_TO_CLASS

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
CONV_DIR = Path("./data/converted")
OUT_DIR = Path("./data/augmented")
(OUT_DIR / "images").mkdir(parents=True, exist_ok=True)
(OUT_DIR / "labels").mkdir(parents=True, exist_ok=True)

SOURCES = ["kaggle", "roboflow", "user", "dsbi", "angelina"]
AUG_COPIES = 4
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# ─────────────────────────────────────────────────────────────────────────────
# Albumentations pipeline — NO flips (Braille is NOT flip-symmetric)
# ─────────────────────────────────────────────────────────────────────────────
transform = A.Compose([
    A.RandomBrightnessContrast(brightness_limit=0.4, contrast_limit=0.4, p=0.8),
    A.CLAHE(clip_limit=4.0, p=0.5),
    A.GaussNoise(var_limit=(5, 40), p=0.5),
    A.Rotate(limit=12, border_mode=cv2.BORDER_CONSTANT, value=(242, 237, 224), p=0.5),
    A.Perspective(scale=(0.02, 0.07), p=0.35),
    A.Blur(blur_limit=3, p=0.2),
    A.RandomShadow(p=0.25),
    # flipud=0.0 and fliplr=0.0 — CRITICAL: never flip Braille
], bbox_params=A.BboxParams(
    format="yolo",
    label_fields=["class_ids"],
    min_area=100,          # discard tiny boxes after transform
    min_visibility=0.3,    # keep box if ≥30% still visible
))


def load_yolo_labels(lbl_path):
    """Load YOLO labels → list of (class_id, cx, cy, w, h)."""
    labels = []
    if not lbl_path.exists():
        return labels
    for line in lbl_path.read_text().strip().split("\n"):
        if not line.strip():
            continue
        parts = line.strip().split()
        cls_id = int(parts[0])
        cx, cy, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
        labels.append((cls_id, cx, cy, w, h))
    return labels


def save_yolo_labels(lbl_path, labels):
    """Save labels in YOLO format."""
    lines = [f"{c} {x:.6f} {y:.6f} {w:.6f} {h:.6f}" for c, x, y, w, h in labels]
    lbl_path.write_text("\n".join(lines) + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# Process
# ─────────────────────────────────────────────────────────────────────────────
global_idx = 0
total_input = 0
total_output = 0
class_counts = Counter()

for source in SOURCES:
    src_img = CONV_DIR / source / "images"
    src_lbl = CONV_DIR / source / "labels"
    if not src_img.exists():
        print(f"  {source}: directory not found, skipping")
        continue

    images = [f for f in sorted(src_img.iterdir()) if f.suffix.lower() in IMG_EXT]
    print(f"\n── {source}: {len(images)} images ──")
    total_input += len(images)

    for img_f in tqdm(images, desc=f"  Aug {source}", leave=False):
        lbl_f = src_lbl / (img_f.stem + ".txt")
        labels = load_yolo_labels(lbl_f)
        if not labels:
            continue

        try:
            img = cv2.imread(str(img_f))
            if img is None:
                print(f"    WARNING: cannot read {img_f}")
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        except Exception as e:
            print(f"    WARNING: error reading {img_f}: {e}")
            continue

        # Also copy original
        dst_img = OUT_DIR / "images" / f"aug_{global_idx:07d}{img_f.suffix.lower()}"
        dst_lbl = OUT_DIR / "labels" / f"aug_{global_idx:07d}.txt"
        cv2.imwrite(str(dst_img), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
        save_yolo_labels(dst_lbl, labels)
        for c, *_ in labels:
            class_counts[c] += 1
        global_idx += 1
        total_output += 1

        # Generate AUG_COPIES augmented versions
        bboxes = [(cx, cy, w, h) for _, cx, cy, w, h in labels]
        class_ids = [c for c, *_ in labels]

        for aug_i in range(AUG_COPIES):
            try:
                result = transform(
                    image=img,
                    bboxes=bboxes,
                    class_ids=class_ids,
                )
                aug_img = result["image"]
                aug_bboxes = result["bboxes"]
                aug_cls = result["class_ids"]

                if not aug_bboxes:
                    continue  # all boxes were lost

                aug_labels = [
                    (c, bx, by, bw, bh)
                    for c, (bx, by, bw, bh) in zip(aug_cls, aug_bboxes)
                ]

                dst_img = OUT_DIR / "images" / f"aug_{global_idx:07d}.jpg"
                dst_lbl = OUT_DIR / "labels" / f"aug_{global_idx:07d}.txt"
                cv2.imwrite(str(dst_img), cv2.cvtColor(aug_img, cv2.COLOR_RGB2BGR),
                            [cv2.IMWRITE_JPEG_QUALITY, 92])
                save_yolo_labels(dst_lbl, aug_labels)
                for c, *_ in aug_labels:
                    class_counts[c] += 1
                global_idx += 1
                total_output += 1

            except Exception as e:
                print(f"    WARNING: augmentation failed for {img_f} copy {aug_i}: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("Augmentation Summary:")
print("=" * 60)
print(f"  Input images:  {total_input}")
print(f"  Output images: {total_output} (originals + {AUG_COPIES}× augmented)")
print(f"\n  Class distribution (label instances):")
for cls_id, cls_name in enumerate(CLASS_NAMES):
    count = class_counts.get(cls_id, 0)
    print(f"    {cls_id:2d} {cls_name:12s}: {count:>6}")
print(f"\n  Total labels: {sum(class_counts.values())}")
print("\n=== augment_real_data.py complete ===")
