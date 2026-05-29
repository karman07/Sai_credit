#!/usr/bin/env python3
"""
=== FILE 9: train_stage2.py ===
Stage 2 training: Fine-tune all layers at 1280px resolution.
Run with: python -m torch.distributed.run --nproc_per_node=8 train_stage2.py
"""
print("=" * 70)
print("Run with: python -m torch.distributed.run --nproc_per_node=8 train_stage2.py")
print("=" * 70)
print("\n=== FILE 9: train_stage2.py ===")

import torch
import os

torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True
os.environ["NCCL_DEBUG"] = "WARN"
os.environ["OMP_NUM_THREADS"] = "8"

from ultralytics import YOLO
from braille_lookup import CLASS_NAMES  # never hardcode class names
from pathlib import Path

assert len(CLASS_NAMES) == 40, f"Expected 40 classes, got {len(CLASS_NAMES)}"

# Load stage 1 best weights
stage1_weights = Path("./runs/stage1/weights/best.pt")
if not stage1_weights.exists():
    print(f"ERROR: Stage 1 weights not found at {stage1_weights}")
    print("Run train_stage1.py first.")
    import sys; sys.exit(1)

print(f"  Loading stage 1 weights: {stage1_weights}")
print(f"  Classes: {len(CLASS_NAMES)}")
print(f"  GPUs available: {torch.cuda.device_count()}")

model = YOLO(str(stage1_weights))

# Stage 2: unfreeze all, high resolution, lower LR
results = model.train(
    data="./data/final/data.yaml",
    epochs=80,
    imgsz=1280,               # high resolution for fine detail
    batch=64,                  # 8 per GPU × 8 GPUs (1280px needs more VRAM)
    device="0,1,2,3,4,5,6,7",
    freeze=0,                  # unfreeze ALL layers
    lr0=0.002,                 # much lower LR for fine-tuning
    lrf=0.0002,
    warmup_epochs=3,
    cos_lr=True,
    optimizer="AdamW",
    weight_decay=0.0005,
    amp=True,
    workers=16,
    # CRITICAL: never flip Braille
    flipud=0.0,
    fliplr=0.0,
    hsv_h=0.0,
    hsv_s=0.3,
    hsv_v=0.5,
    degrees=8.0,
    mosaic=1.0,                # full mosaic for stage 2
    mixup=0.1,
    patience=20,
    project="./runs",
    name="stage2",
    save_period=10,
)

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("Stage 2 Training Summary:")
print("=" * 60)
if hasattr(results, "results_dict"):
    for k, v in results.results_dict.items():
        print(f"  {k}: {v}")
print(f"\n  Best weights: ./runs/stage2/weights/best.pt")
print(f"  Last weights: ./runs/stage2/weights/last.pt")
print("\n=== train_stage2.py complete ===")
