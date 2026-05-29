#!/usr/bin/env python3
"""
=== FILE 7: merge_and_split.py ===
Merges all data sources, deduplicates by MD5, and splits into train/val/test.
Real page images (angelina + dsbi) → TEST ONLY.
Generates ./data/final/data.yaml
"""
import os, sys, shutil, hashlib, random, yaml
from pathlib import Path
from collections import Counter, defaultdict
from tqdm import tqdm

print("=== FILE 7: merge_and_split.py ===")

from braille_lookup import CLASS_NAMES, CLASS_TO_IDX, IDX_TO_CLASS

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
FINAL = Path("./data/final")
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

for split in ["train", "val", "test"]:
    (FINAL / split / "images").mkdir(parents=True, exist_ok=True)
    (FINAL / split / "labels").mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# Collect all image-label pairs by source category
# ─────────────────────────────────────────────────────────────────────────────
def collect_pairs(base_dir):
    """Collect (image_path, label_path) pairs from a directory."""
    img_dir = base_dir / "images"
    lbl_dir = base_dir / "labels"
    pairs = []
    if not img_dir.exists():
        return pairs
    for img_f in sorted(img_dir.iterdir()):
        if img_f.suffix.lower() not in IMG_EXT:
            continue
        lbl_f = lbl_dir / (img_f.stem + ".txt")
        if lbl_f.exists():
            pairs.append((img_f, lbl_f))
    return pairs

# Sources
synthetic_pairs = collect_pairs(Path("./data/synthetic"))
augmented_pairs = collect_pairs(Path("./data/augmented"))
angelina_pairs = collect_pairs(Path("./data/converted/angelina"))
dsbi_pairs = collect_pairs(Path("./data/converted/dsbi"))

print(f"  Synthetic:  {len(synthetic_pairs)} pairs")
print(f"  Augmented:  {len(augmented_pairs)} pairs")
print(f"  Angelina:   {len(angelina_pairs)} pairs")
print(f"  DSBI:       {len(dsbi_pairs)} pairs")
print(f"  Total raw:  {len(synthetic_pairs)+len(augmented_pairs)+len(angelina_pairs)+len(dsbi_pairs)} pairs")

# ─────────────────────────────────────────────────────────────────────────────
# Deduplicate by MD5 hash of image file
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Deduplicating by MD5 ──")

def md5_file(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def dedup(pairs, label):
    seen = set()
    unique = []
    dupes = 0
    for img_f, lbl_f in pairs:
        h = md5_file(img_f)
        if h in seen:
            dupes += 1
        else:
            seen.add(h)
            unique.append((img_f, lbl_f))
    if dupes:
        print(f"  {label}: removed {dupes} duplicates ({len(unique)} remain)")
    return unique, seen

synthetic_pairs, seen_synth = dedup(synthetic_pairs, "Synthetic")
augmented_pairs, seen_aug = dedup(augmented_pairs, "Augmented")
angelina_pairs, seen_ang = dedup(angelina_pairs, "Angelina")
dsbi_pairs, seen_dsbi = dedup(dsbi_pairs, "DSBI")

# Cross-source dedup
all_seen = set()
def cross_dedup(pairs, label):
    global all_seen
    unique = []
    for img_f, lbl_f in pairs:
        h = md5_file(img_f)
        if h not in all_seen:
            all_seen.add(h)
            unique.append((img_f, lbl_f))
    removed = len(pairs) - len(unique)
    if removed:
        print(f"  Cross-dedup {label}: removed {removed}")
    return unique

synthetic_pairs = cross_dedup(synthetic_pairs, "Synthetic")
augmented_pairs = cross_dedup(augmented_pairs, "Augmented")
angelina_pairs = cross_dedup(angelina_pairs, "Angelina")
dsbi_pairs = cross_dedup(dsbi_pairs, "DSBI")

# ─────────────────────────────────────────────────────────────────────────────
# Split
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Splitting ──")

# Real page images (angelina + dsbi) → TEST ONLY
real_test = angelina_pairs + dsbi_pairs
print(f"  Real test images (angelina + dsbi): {len(real_test)}")

# Synthetic: 80/10/10
random.shuffle(synthetic_pairs)
n_synth = len(synthetic_pairs)
s_train = int(n_synth * 0.8)
s_val = int(n_synth * 0.1)
synth_train = synthetic_pairs[:s_train]
synth_val = synthetic_pairs[s_train:s_train+s_val]
synth_test = synthetic_pairs[s_train+s_val:]
print(f"  Synthetic split: train={len(synth_train)}, val={len(synth_val)}, test={len(synth_test)}")

# Augmented letters: 85/15
random.shuffle(augmented_pairs)
n_aug = len(augmented_pairs)
a_train = int(n_aug * 0.85)
aug_train = augmented_pairs[:a_train]
aug_val = augmented_pairs[a_train:]
print(f"  Augmented split: train={len(aug_train)}, val={len(aug_val)}")

# Merge
train_pairs = synth_train + aug_train
val_pairs = synth_val + aug_val
test_pairs = synth_test + real_test

print(f"\n  Final split:")
print(f"    Train: {len(train_pairs)}")
print(f"    Val:   {len(val_pairs)}")
print(f"    Test:  {len(test_pairs)}")

# ─────────────────────────────────────────────────────────────────────────────
# Copy files to final directory
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Copying to final directory ──")

def copy_pairs(pairs, split_name):
    cls_counts = Counter()
    for i, (img_f, lbl_f) in enumerate(tqdm(pairs, desc=f"  {split_name}", leave=False)):
        ext = img_f.suffix.lower()
        dst_img = FINAL / split_name / "images" / f"{split_name}_{i:06d}{ext}"
        dst_lbl = FINAL / split_name / "labels" / f"{split_name}_{i:06d}.txt"
        shutil.copy2(img_f, dst_img)
        shutil.copy2(lbl_f, dst_lbl)
        # Count classes
        for line in lbl_f.read_text().strip().split("\n"):
            if line.strip():
                cls_id = int(float(line.strip().split()[0]))
                cls_counts[cls_id] += 1
    return cls_counts

train_counts = copy_pairs(train_pairs, "train")
val_counts = copy_pairs(val_pairs, "val")
test_counts = copy_pairs(test_pairs, "test")

# ─────────────────────────────────────────────────────────────────────────────
# Validate: every class present in all splits
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Validation ──")
issues = []
for cls_id, cls_name in enumerate(CLASS_NAMES):
    t = train_counts.get(cls_id, 0)
    v = val_counts.get(cls_id, 0)
    te = test_counts.get(cls_id, 0)
    if t == 0:
        issues.append(f"  ERROR: '{cls_name}' missing from train set")
    if v == 0:
        issues.append(f"  WARNING: '{cls_name}' missing from val set")
    if te == 0:
        issues.append(f"  WARNING: '{cls_name}' missing from test set")
    if t < 200:
        issues.append(f"  ERROR: '{cls_name}' has only {t} train instances (min 200)")

if issues:
    for issue in issues:
        print(issue)
    # Only raise on actual errors (missing from train or <200)
    errors = [i for i in issues if "ERROR" in i]
    if errors:
        print(f"\n  {len(errors)} validation errors found!")
        # Don't exit — just warn strongly, data might be limited
else:
    print("  ✓ All 40 classes present in train, val, and test")

# ─────────────────────────────────────────────────────────────────────────────
# Generate data.yaml
# ─────────────────────────────────────────────────────────────────────────────
data_yaml = {
    "path": str(FINAL.absolute()),
    "train": "train/images",
    "val": "val/images",
    "test": "test/images",
    "nc": 40,
    "names": CLASS_NAMES,
}

yaml_path = FINAL / "data.yaml"
with open(yaml_path, "w") as f:
    yaml.dump(data_yaml, f, default_flow_style=False, sort_keys=False)

print(f"\n  Generated: {yaml_path}")

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("Merge & Split Summary:")
print("=" * 60)
total = len(train_pairs) + len(val_pairs) + len(test_pairs)
print(f"  Total images: {total}")
print(f"  Train: {len(train_pairs):>6}")
print(f"  Val:   {len(val_pairs):>6}")
print(f"  Test:  {len(test_pairs):>6}")
print(f"\n  Class distribution (train):")
for cls_id, cls_name in enumerate(CLASS_NAMES):
    t = train_counts.get(cls_id, 0)
    print(f"    {cls_id:2d} {cls_name:12s}: {t:>6}")
print("\n=== merge_and_split.py complete ===")
