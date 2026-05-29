#!/usr/bin/env python3
"""
=== FILE 4: convert_annotations.py ===
Converts every raw dataset to unified YOLO format using the 40-class system.
Imports CLASS_TO_IDX and ENGLISH_CHARS from braille_lookup.py.
"""
import os, sys, json, shutil, re
from pathlib import Path
from collections import defaultdict
import numpy as np

print("=== FILE 4: convert_annotations.py ===")

from braille_lookup import (
    CLASS_TO_IDX, ENGLISH_CHARS, ENGLISH_BRAILLE_MAP, CLASS_NAMES, IDX_TO_CLASS
)

RAW = Path("./data/raw")
CONV = Path("./data/converted")
IMG_EXT = {".jpg",".jpeg",".png",".bmp",".tif",".tiff",".webp"}

stats = defaultdict(lambda: {"total":0,"kept":0,"skipped":0})

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def ensure_dirs(base):
    (base/"images").mkdir(parents=True, exist_ok=True)
    (base/"labels").mkdir(parents=True, exist_ok=True)

def normalize_label(raw_label):
    """Map raw folder/class name to one of the 40 CLASS_NAMES or None."""
    raw = raw_label.strip().lower()
    # Direct match
    if raw in ENGLISH_CHARS:
        return raw
    # Single letter
    if len(raw) == 1 and raw.isalpha():
        return raw
    # Single digit
    if len(raw) == 1 and raw.isdigit():
        digit_map = {"0":"zero","1":"one","2":"two","3":"three","4":"four",
                     "5":"five","6":"six","7":"seven","8":"eight","9":"nine"}
        return digit_map.get(raw)
    # Common aliases
    aliases = {
        ".":"period","period":"period","dot":"period","full stop":"period",
        ",":"comma","comma":"comma",
        "?":"question","question":"question","question mark":"question",
        "!":"exclamation","exclamation":"exclamation","exclamation mark":"exclamation",
        # Space is NOT a detectable class — skip it
        "0":"zero","1":"one","2":"two","3":"three","4":"four",
        "5":"five","6":"six","7":"seven","8":"eight","9":"nine",
    }
    return aliases.get(raw)


# ─────────────────────────────────────────────────────────────────────────────
# 1. KAGGLE: folder-name = class → one bbox covering full image
# ─────────────────────────────────────────────────────────────────────────────
def convert_kaggle():
    print("\n── Converting Kaggle datasets ──")
    kaggle_dirs = [d for d in RAW.iterdir() if d.is_dir() and d.name.startswith("kaggle_")]
    out = CONV / "kaggle"; ensure_dirs(out)
    idx = 0
    for kd in sorted(kaggle_dirs):
        print(f"  Source: {kd.name}")
        # Walk looking for class folders containing images
        for root, dirs, files in os.walk(kd):
            root_p = Path(root)
            folder_name = root_p.name
            cls = normalize_label(folder_name)
            if cls is None:
                continue
            cls_id = CLASS_TO_IDX[cls]
            for f in files:
                fp = root_p / f
                if fp.suffix.lower() not in IMG_EXT:
                    continue
                stats["kaggle"]["total"] += 1
                # Full-image bbox: cx=0.5 cy=0.5 w=1.0 h=1.0
                dst_img = out / "images" / f"kaggle_{idx:06d}{fp.suffix.lower()}"
                dst_lbl = out / "labels" / f"kaggle_{idx:06d}.txt"
                shutil.copy2(fp, dst_img)
                dst_lbl.write_text(f"{cls_id} 0.5 0.5 1.0 1.0\n")
                stats["kaggle"]["kept"] += 1
                idx += 1
    stats["kaggle"]["skipped"] = stats["kaggle"]["total"] - stats["kaggle"]["kept"]
    print(f"  Kaggle: kept {stats['kaggle']['kept']}/{stats['kaggle']['total']}")


# ─────────────────────────────────────────────────────────────────────────────
# 2. ROBOFLOW: already YOLO → remap class IDs
# ─────────────────────────────────────────────────────────────────────────────
def convert_roboflow():
    print("\n── Converting Roboflow datasets ──")
    robo_dirs = [d for d in RAW.iterdir() if d.is_dir() and d.name.startswith("roboflow_")]
    out = CONV / "roboflow"; ensure_dirs(out)
    idx = 0
    for rd in sorted(robo_dirs):
        print(f"  Source: {rd.name}")
        # Find data.yaml to get class name mapping
        yaml_files = list(rd.rglob("data.yaml")) + list(rd.rglob("*.yaml"))
        class_map = {}
        if yaml_files:
            import yaml
            for yf in yaml_files:
                try:
                    with open(yf) as f:
                        cfg = yaml.safe_load(f)
                    if cfg and "names" in cfg:
                        names = cfg["names"]
                        if isinstance(names, dict):
                            for src_id, name in names.items():
                                mapped = normalize_label(str(name))
                                if mapped:
                                    class_map[int(src_id)] = CLASS_TO_IDX[mapped]
                        elif isinstance(names, list):
                            for src_id, name in enumerate(names):
                                mapped = normalize_label(str(name))
                                if mapped:
                                    class_map[src_id] = CLASS_TO_IDX[mapped]
                        break
                except Exception as e:
                    print(f"    WARNING: failed to parse {yf}: {e}")

        if not class_map:
            print(f"    WARNING: no valid class mapping found, skipping {rd.name}")
            continue

        print(f"    Mapped {len(class_map)} classes to our 40-class system")

        # Process image+label pairs
        for split in ["train","valid","test",""]:
            img_dir = rd / split / "images" if split else rd / "images"
            lbl_dir = rd / split / "labels" if split else rd / "labels"
            if not img_dir.exists():
                continue
            for img_f in img_dir.iterdir():
                if img_f.suffix.lower() not in IMG_EXT:
                    continue
                lbl_f = lbl_dir / (img_f.stem + ".txt")
                stats["roboflow"]["total"] += 1
                if not lbl_f.exists():
                    stats["roboflow"]["skipped"] += 1
                    continue
                new_lines = []
                for line in lbl_f.read_text().strip().split("\n"):
                    if not line.strip():
                        continue
                    parts = line.strip().split()
                    src_cls = int(parts[0])
                    if src_cls in class_map:
                        new_lines.append(f"{class_map[src_cls]} {' '.join(parts[1:])}")
                if not new_lines:
                    stats["roboflow"]["skipped"] += 1
                    continue
                dst_img = out / "images" / f"roboflow_{idx:06d}{img_f.suffix.lower()}"
                dst_lbl = out / "labels" / f"roboflow_{idx:06d}.txt"
                shutil.copy2(img_f, dst_img)
                dst_lbl.write_text("\n".join(new_lines) + "\n")
                stats["roboflow"]["kept"] += 1
                idx += 1
    stats["roboflow"]["skipped"] = stats["roboflow"]["total"] - stats["roboflow"]["kept"]
    print(f"  Roboflow: kept {stats['roboflow']['kept']}/{stats['roboflow']['total']}")


# ─────────────────────────────────────────────────────────────────────────────
# 3. DSBI: dot coordinates → DBSCAN cluster → decode → YOLO bbox
# ─────────────────────────────────────────────────────────────────────────────
def convert_dsbi():
    print("\n── Converting DSBI ──")
    dsbi_dir = RAW / "github_dsbi"
    out = CONV / "dsbi"; ensure_dirs(out)

    if not dsbi_dir.exists():
        print("  WARNING: DSBI directory not found, skipping.")
        return

    from sklearn.cluster import DBSCAN
    from PIL import Image

    # Find annotation files (DSBI stores dot coordinates in various formats)
    anno_files = list(dsbi_dir.rglob("*.txt")) + list(dsbi_dir.rglob("*.json"))
    idx = 0

    for af in sorted(anno_files):
        try:
            # Try to parse dot coordinate files
            # DSBI format: each line is "x y" or JSON with dot positions
            if af.suffix == ".json":
                with open(af) as f:
                    data = json.load(f)
                # Extract dots from JSON structure
                dots = []
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and "x" in item and "y" in item:
                            dots.append((float(item["x"]), float(item["y"])))
                elif isinstance(data, dict):
                    for key, val in data.items():
                        if isinstance(val, list):
                            for item in val:
                                if isinstance(item, dict) and "x" in item and "y" in item:
                                    dots.append((float(item["x"]), float(item["y"])))
            else:
                dots = []
                for line in af.read_text().strip().split("\n"):
                    parts = line.strip().split()
                    if len(parts) >= 2:
                        try:
                            dots.append((float(parts[0]), float(parts[1])))
                        except ValueError:
                            continue

            if len(dots) < 2:
                continue

            # Find corresponding image
            img_candidates = [af.parent / (af.stem + ext) for ext in [".jpg",".png",".jpeg",".bmp"]]
            img_path = None
            for ic in img_candidates:
                if ic.exists():
                    img_path = ic; break
            if img_path is None:
                # Search nearby
                for ext in IMG_EXT:
                    found = list(af.parent.glob(af.stem + "*" + ext))
                    if found:
                        img_path = found[0]; break
            if img_path is None:
                continue

            img = Image.open(img_path)
            W, H = img.size
            coords = np.array(dots)

            # Compute average spacing for DBSCAN eps
            from scipy.spatial.distance import cdist
            if len(coords) < 2:
                continue
            dists = cdist(coords, coords)
            np.fill_diagonal(dists, np.inf)
            min_dists = dists.min(axis=1)
            avg_spacing = np.mean(min_dists)
            eps = avg_spacing * 0.7  # per spec

            # Cluster dots into cells
            clustering = DBSCAN(eps=eps, min_samples=1).fit(coords)
            labels = clustering.labels_

            stats["dsbi"]["total"] += 1
            new_lines = []
            for cl in set(labels):
                if cl == -1:
                    continue
                cluster_pts = coords[labels == cl]
                if len(cluster_pts) < 1 or len(cluster_pts) > 6:
                    continue  # not a valid braille cell

                cx_abs = cluster_pts[:, 0].mean()
                cy_abs = cluster_pts[:, 1].mean()

                # Determine cell bounding box (estimate cell size from spacing)
                cell_w = avg_spacing * 2.5
                cell_h = avg_spacing * 3.5

                # Determine 6-bit pattern from dot positions within the cell
                # Sort dots relative to cell center
                rel = cluster_pts - np.array([cx_abs - cell_w/2, cy_abs - cell_h/2])
                # Normalize to cell coordinates
                rel_norm = rel / np.array([cell_w, cell_h])

                # Assign dots to 6 positions
                pattern = [0, 0, 0, 0, 0, 0]
                for dx, dy in rel_norm:
                    col = 0 if dx < 0.5 else 1
                    if dy < 0.33:
                        row = 0
                    elif dy < 0.67:
                        row = 1
                    else:
                        row = 2
                    pos = row + col * 3  # positions: 0,1,2 (left), 3,4,5 (right)
                    pattern[pos] = 1

                pattern_tuple = tuple(pattern)
                char = ENGLISH_BRAILLE_MAP.get(pattern_tuple)
                if char is None or char not in ENGLISH_CHARS:
                    continue

                cls_id = CLASS_TO_IDX[char]
                # YOLO bbox
                x1 = max(0, cx_abs - cell_w/2) / W
                y1 = max(0, cy_abs - cell_h/2) / H
                x2 = min(W, cx_abs + cell_w/2) / W
                y2 = min(H, cy_abs + cell_h/2) / H
                bx = (x1 + x2) / 2
                by = (y1 + y2) / 2
                bw = x2 - x1
                bh = y2 - y1
                # Clamp to [0,1]
                bx = max(0, min(1, bx))
                by = max(0, min(1, by))
                bw = max(0, min(1, bw))
                bh = max(0, min(1, bh))
                new_lines.append(f"{cls_id} {bx:.6f} {by:.6f} {bw:.6f} {bh:.6f}")

            if new_lines:
                dst_img = out / "images" / f"dsbi_{idx:06d}{img_path.suffix.lower()}"
                dst_lbl = out / "labels" / f"dsbi_{idx:06d}.txt"
                shutil.copy2(img_path, dst_img)
                dst_lbl.write_text("\n".join(new_lines) + "\n")
                stats["dsbi"]["kept"] += 1
                idx += 1
            else:
                stats["dsbi"]["skipped"] += 1

        except Exception as e:
            print(f"    WARNING: failed processing {af}: {e}")
            stats["dsbi"]["skipped"] += 1

    print(f"  DSBI: kept {stats['dsbi']['kept']}/{stats['dsbi']['total']}")


# ─────────────────────────────────────────────────────────────────────────────
# 4. AngelinaDataset: LabelMe JSON → English filter → YOLO bbox
# ─────────────────────────────────────────────────────────────────────────────
def convert_angelina():
    print("\n── Converting AngelinaDataset (English filter) ──")
    ang_dir = RAW / "github_angelina"
    out = CONV / "angelina"; ensure_dirs(out)

    if not ang_dir.exists():
        print("  WARNING: AngelinaDataset directory not found, skipping.")
        return

    json_files = list(ang_dir.rglob("*.json"))
    print(f"  Found {len(json_files)} JSON annotation files")

    idx = 0
    total_annos = 0
    kept_annos = 0

    for jf in sorted(json_files):
        try:
            with open(jf) as f:
                data = json.load(f)
        except Exception as e:
            print(f"    WARNING: failed to parse {jf}: {e}")
            continue

        # LabelMe format: {"shapes": [...], "imagePath": "..."}
        shapes = data.get("shapes", [])
        if not shapes:
            continue

        img_rel = data.get("imagePath", "")
        img_path = jf.parent / img_rel
        if not img_path.exists():
            # Try common variations
            for ext in [".jpg",".png",".jpeg"]:
                candidate = jf.parent / (jf.stem + ext)
                if candidate.exists():
                    img_path = candidate; break
        if not img_path.exists():
            continue

        img_w = data.get("imageWidth", 0)
        img_h = data.get("imageHeight", 0)
        if img_w == 0 or img_h == 0:
            try:
                from PIL import Image
                im = Image.open(img_path)
                img_w, img_h = im.size
            except Exception:
                continue

        stats["angelina"]["total"] += 1
        new_lines = []

        for shape in shapes:
            total_annos += 1
            label_raw = shape.get("label", "").strip().lower()
            cls = normalize_label(label_raw)
            if cls is None or cls not in ENGLISH_CHARS:
                continue
            kept_annos += 1
            cls_id = CLASS_TO_IDX[cls]

            points = shape.get("points", [])
            if not points:
                continue
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            x1, x2 = min(xs), max(xs)
            y1, y2 = min(ys), max(ys)
            bx = ((x1 + x2) / 2) / img_w
            by = ((y1 + y2) / 2) / img_h
            bw = (x2 - x1) / img_w
            bh = (y2 - y1) / img_h
            bx = max(0, min(1, bx))
            by = max(0, min(1, by))
            bw = max(0, min(1, bw))
            bh = max(0, min(1, bh))
            new_lines.append(f"{cls_id} {bx:.6f} {by:.6f} {bw:.6f} {bh:.6f}")

        if new_lines:
            dst_img = out / "images" / f"angelina_{idx:06d}{img_path.suffix.lower()}"
            dst_lbl = out / "labels" / f"angelina_{idx:06d}.txt"
            shutil.copy2(img_path, dst_img)
            dst_lbl.write_text("\n".join(new_lines) + "\n")
            stats["angelina"]["kept"] += 1
            idx += 1
        else:
            stats["angelina"]["skipped"] += 1

    print(f"  kept {stats['angelina']['kept']} of {stats['angelina']['total']} images after English filter")
    print(f"  Annotations: kept {kept_annos} of {total_annos}")


# ─────────────────────────────────────────────────────────────────────────────
# 5. User data: validate class IDs 0-39, copy as-is
# ─────────────────────────────────────────────────────────────────────────────
def convert_user():
    print("\n── Converting user data ──")
    user_dir = Path("./data/user_letters")
    out = CONV / "user"; ensure_dirs(out)

    if not user_dir.exists():
        print("  WARNING: ./data/user_letters/ not found, skipping.")
        return

    img_dir = user_dir / "images" if (user_dir / "images").exists() else user_dir
    lbl_dir = user_dir / "labels" if (user_dir / "labels").exists() else user_dir

    idx = 0
    for img_f in sorted(img_dir.iterdir()):
        if img_f.suffix.lower() not in IMG_EXT:
            continue
        lbl_f = lbl_dir / (img_f.stem + ".txt")
        stats["user"]["total"] += 1
        if not lbl_f.exists():
            stats["user"]["skipped"] += 1
            continue
        # Validate all class IDs are 0-39
        valid = True
        for line in lbl_f.read_text().strip().split("\n"):
            if not line.strip():
                continue
            cls_id = int(line.strip().split()[0])
            if cls_id < 0 or cls_id >= 40:
                print(f"    WARNING: invalid class ID {cls_id} in {lbl_f}")
                valid = False; break
        if not valid:
            stats["user"]["skipped"] += 1
            continue
        dst_img = out / "images" / f"user_{idx:06d}{img_f.suffix.lower()}"
        dst_lbl = out / "labels" / f"user_{idx:06d}.txt"
        shutil.copy2(img_f, dst_img)
        shutil.copy2(lbl_f, dst_lbl)
        stats["user"]["kept"] += 1
        idx += 1
    print(f"  User: kept {stats['user']['kept']}/{stats['user']['total']}")


# ─────────────────────────────────────────────────────────────────────────────
# Run all
# ─────────────────────────────────────────────────────────────────────────────
convert_kaggle()
convert_roboflow()
convert_dsbi()
convert_angelina()
convert_user()

print("\n" + "="*60 + "\nConversion Summary:\n" + "="*60)
for src in ["kaggle","roboflow","dsbi","angelina","user"]:
    s = stats[src]
    print(f"  {src:12s}: kept {s['kept']:>6} / total {s['total']:>6}  (skipped {s['skipped']})")
print("=== convert_annotations.py complete ===")
