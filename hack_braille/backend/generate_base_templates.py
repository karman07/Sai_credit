#!/usr/bin/env python3
"""
generate_base_templates.py
Generates synthetic dot-pattern letter templates for all 40 classes
when Kaggle/Roboflow datasets are unavailable.
These serve as bootstrap templates for the synthetic sentence generator.
Output: ./data/converted/kaggle/{images,labels}/
"""
import os, sys, random
from pathlib import Path
from collections import defaultdict
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

print("=== generate_base_templates.py ===")

from braille_lookup import CLASS_NAMES, CLASS_TO_IDX, REVERSE_MAP

OUT_DIR = Path("./data/converted/kaggle")
(OUT_DIR / "images").mkdir(parents=True, exist_ok=True)
(OUT_DIR / "labels").mkdir(parents=True, exist_ok=True)

CELL_W, CELL_H = 48, 72
TEMPLATES_PER_CLASS = 50  # 50 variations per class

# Dot positions within a braille cell (relative coords)
# Standard layout: dots 1,2,3 in left column, 4,5,6 in right
DOT_POS = [
    (0.30, 0.20),  # dot 1 (top-left)
    (0.30, 0.50),  # dot 2 (mid-left)
    (0.30, 0.80),  # dot 3 (bot-left)
    (0.70, 0.20),  # dot 4 (top-right)
    (0.70, 0.50),  # dot 5 (mid-right)
    (0.70, 0.80),  # dot 6 (bot-right)
]

idx = 0
for cls_name in CLASS_NAMES:
    pattern = REVERSE_MAP.get(cls_name)
    if pattern is None:
        print(f"  WARNING: no dot pattern for '{cls_name}', using empty cell")
        pattern = (0, 0, 0, 0, 0, 0)

    for v in range(TEMPLATES_PER_CLASS):
        # Vary background brightness
        bg_val = random.randint(200, 245)
        img = Image.new("L", (CELL_W, CELL_H), bg_val)
        draw = ImageDraw.Draw(img)

        # Vary dot properties
        dot_r = random.uniform(3.5, 7.0)
        dot_shade = random.randint(20, 90)

        for i, (dx, dy) in enumerate(DOT_POS):
            if pattern[i] == 1:
                px = dx * CELL_W + random.uniform(-3, 3)
                py = dy * CELL_H + random.uniform(-3, 3)
                # Slightly vary each dot's size and shade
                r = dot_r + random.uniform(-1, 1)
                shade = dot_shade + random.randint(-15, 15)
                shade = max(10, min(120, shade))
                draw.ellipse(
                    [px - r, py - r, px + r, py + r],
                    fill=shade
                )

        # Add subtle noise
        arr = np.array(img).astype(np.float32)
        arr += np.random.normal(0, random.uniform(3, 8), arr.shape)
        arr = np.clip(arr, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)

        # Occasional blur
        if random.random() < 0.3:
            img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 1.0)))

        # Save
        cls_id = CLASS_TO_IDX[cls_name]
        img_path = OUT_DIR / "images" / f"template_{idx:06d}.png"
        lbl_path = OUT_DIR / "labels" / f"template_{idx:06d}.txt"
        img.save(str(img_path))
        lbl_path.write_text(f"{cls_id} 0.5 0.5 1.0 1.0\n")
        idx += 1

print(f"  Generated {idx} templates across {len(CLASS_NAMES)} classes")
print(f"  Templates per class: {TEMPLATES_PER_CLASS}")
print(f"  Output: {OUT_DIR}")
print("=== generate_base_templates.py complete ===")
