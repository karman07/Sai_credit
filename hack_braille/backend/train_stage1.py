#!/usr/bin/env python3
"""
=== FILE 8: train_stage1.py ===
Stage 1 training: YOLOv11n with frozen backbone on 640px images.
Run with: python -m torch.distributed.run --nproc_per_node=8 train_stage1.py
"""
# Print usage instruction prominently
print("=" * 70)
print("Run with: python -m torch.distributed.run --nproc_per_node=8 train_stage1.py")
print("=" * 70)
print("\n=== FILE 8: train_stage1.py ===")

import torch
import os

# TF32 for A100 performance
torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True

# NCCL and threading config
os.environ["NCCL_DEBUG"] = "WARN"
os.environ["OMP_NUM_THREADS"] = "8"

from ultralytics import YOLO
from braille_lookup import CLASS_NAMES  # never hardcode class names

# Sanity check
assert len(CLASS_NAMES) == 40, f"Expected 40 classes, got {len(CLASS_NAMES)}"
print(f"  Classes: {len(CLASS_NAMES)}")
print(f"  GPUs available: {torch.cuda.device_count()}")
print(f"  CUDA version: {torch.version.cuda}")

# Load pretrained YOLOv11n
model = YOLO("yolo11n.pt")

# Stage 1: frozen backbone, high LR, 640px
results = model.train(
    data="./data/final/data.yaml",
    epochs=120,
    imgsz=640,
    batch=256,                # 32 per GPU × 8 GPUs
    device="0,1,2,3,4,5,6,7",
    freeze=10,                # freeze backbone layers
    lr0=0.04,                 # scaled: 0.01 × (256/64) = 0.04
    lrf=0.01,
    warmup_epochs=5,
    cos_lr=True,
    optimizer="AdamW",
    weight_decay=0.0005,
    amp=True,
    workers=16,
    # CRITICAL: never flip Braille — dots are positional
    flipud=0.0,
    fliplr=0.0,
    # Grayscale domain — hue augmentation is useless
    hsv_h=0.0,
    hsv_s=0.3,
    hsv_v=0.5,
    degrees=8.0,
    mosaic=0.8,
    mixup=0.1,
    patience=25,
    project="./runs",
    name="stage1",
    save_period=10,
)

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("Stage 1 Training Summary:")
print("=" * 60)
if hasattr(results, "results_dict"):
    for k, v in results.results_dict.items():
        print(f"  {k}: {v}")
print(f"\n  Best weights: ./runs/stage1/weights/best.pt")
print(f"  Last weights: ./runs/stage1/weights/last.pt")
print("\n=== train_stage1.py complete ===")
