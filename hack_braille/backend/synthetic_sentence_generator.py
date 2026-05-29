#!/usr/bin/env python3
"""
=== FILE 5: synthetic_sentence_generator.py ===
PRIMARY training data source. Generates 15,000 synthetic Braille sentence
images from letter crop templates + NLTK Brown corpus sentences.
Output: ./data/synthetic/{images,labels}/
"""
import os, sys, random, math, hashlib
from pathlib import Path
from collections import defaultdict, Counter
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import numpy as np
from tqdm import tqdm

print("=== FILE 5: synthetic_sentence_generator.py ===")

from braille_lookup import CLASS_NAMES, CLASS_TO_IDX, IDX_TO_CLASS, ENGLISH_CHARS

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
CELL_W, CELL_H = 48, 72        # pixels per braille cell template
INTER_CELL_GAP = 8              # px between cells in a word
WORD_GAP = 24                   # px between words
LINE_GAP = 20                   # px between lines
MAX_LINE_W = 900                # px before line wrap
BG_COLOR = (242, 237, 224)      # cream background
NUM_IMAGES = 15_000
MIN_CLASS_COUNT = 500           # every class must appear at least this many times
OUT_DIR = Path("./data/synthetic")
TEMPLATE_SOURCES = [
    Path("./data/converted/kaggle"),
    Path("./data/converted/roboflow"),
    Path("./data/converted/user"),
]

# ─────────────────────────────────────────────────────────────────────────────
# 1. Load letter templates
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Loading letter templates ──")
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
templates = defaultdict(list)  # cls_name → [PIL images]

for src in TEMPLATE_SOURCES:
    img_dir = src / "images"
    lbl_dir = src / "labels"
    if not img_dir.exists():
        print(f"  WARNING: {img_dir} not found, skipping")
        continue
    for img_f in img_dir.iterdir():
        if img_f.suffix.lower() not in IMG_EXT:
            continue
        lbl_f = lbl_dir / (img_f.stem + ".txt")
        if not lbl_f.exists():
            continue
        # For single-class images (kaggle), take the class
        lines = [l.strip() for l in lbl_f.read_text().strip().split("\n") if l.strip()]
        if len(lines) == 1:
            cls_id = int(lines[0].split()[0])
            if 0 <= cls_id < 40:
                try:
                    img = Image.open(img_f).convert("L")
                    img = img.resize((CELL_W, CELL_H), Image.LANCZOS)
                    templates[IDX_TO_CLASS[cls_id]].append(img)
                except Exception:
                    pass

# Report template counts
print(f"  Loaded templates for {len(templates)} classes:")
missing = []
for cls in CLASS_NAMES:
    n = len(templates.get(cls, []))
    if n == 0:
        missing.append(cls)
    if n < 5:
        print(f"    {cls}: {n} templates {'⚠ LOW' if 0 < n < 5 else ''}")

if missing:
    print(f"\n  WARNING: {len(missing)} classes have 0 templates: {missing}")
    print("  Generating placeholder dot-pattern templates for missing classes...")
    # Generate synthetic dot-pattern templates for missing classes
    from braille_lookup import REVERSE_MAP
    for cls in missing:
        pattern = REVERSE_MAP.get(cls)
        if pattern is None:
            # Fallback: empty cell
            pattern = (0,0,0,0,0,0)
        for _ in range(20):  # 20 synthetic templates per missing class
            img = Image.new("L", (CELL_W, CELL_H), 230)
            draw = ImageDraw.Draw(img)
            dot_r = random.randint(4, 7)
            # Dot positions within cell
            positions = [
                (CELL_W*0.3, CELL_H*0.2),  # d1
                (CELL_W*0.3, CELL_H*0.5),  # d2
                (CELL_W*0.3, CELL_H*0.8),  # d3
                (CELL_W*0.7, CELL_H*0.2),  # d4
                (CELL_W*0.7, CELL_H*0.5),  # d5
                (CELL_W*0.7, CELL_H*0.8),  # d6
            ]
            for i, (px, py) in enumerate(positions):
                if pattern[i] == 1:
                    # Add jitter for variation
                    jx = random.uniform(-2, 2)
                    jy = random.uniform(-2, 2)
                    shade = random.randint(40, 100)
                    draw.ellipse(
                        [px-dot_r+jx, py-dot_r+jy, px+dot_r+jx, py+dot_r+jy],
                        fill=shade
                    )
            # Light noise
            arr = np.array(img).astype(np.float32)
            arr += np.random.normal(0, 5, arr.shape)
            arr = np.clip(arr, 0, 255).astype(np.uint8)
            templates[cls].append(Image.fromarray(arr))

total_templates = sum(len(v) for v in templates.values())
print(f"  Total templates: {total_templates}")

# Final check
for cls in CLASS_NAMES:
    if len(templates.get(cls, [])) == 0:
        print(f"  FATAL: class '{cls}' has 0 templates even after generation")
        sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# 2. Load English corpus (NLTK Brown)
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Loading NLTK Brown corpus ──")
import nltk
try:
    from nltk.corpus import brown
    brown.words()  # trigger load
except LookupError:
    nltk.download("brown", quiet=True)
    nltk.download("punkt", quiet=True)
    nltk.download("punkt_tab", quiet=True)
    from nltk.corpus import brown

VALID_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789 .,?!")

def clean_sentence(words):
    """Join words, lowercase, filter to valid chars, normalize whitespace."""
    text = " ".join(words).lower()
    text = "".join(c for c in text if c in VALID_CHARS)
    text = " ".join(text.split())  # normalize whitespace
    return text

sentences = []
for sent_words in brown.sents():
    text = clean_sentence(sent_words)
    word_count = len(text.split())
    if 3 <= word_count <= 12 and len(text) >= 10:
        sentences.append(text)

print(f"  Filtered sentences: {len(sentences)}")
if len(sentences) < 1000:
    print("  WARNING: very few sentences available, results may lack diversity")

# ─────────────────────────────────────────────────────────────────────────────
# 3. Character-to-class mapping for sentence rendering
# ─────────────────────────────────────────────────────────────────────────────
CHAR_TO_CLS = {}
for c in "abcdefghijklmnopqrstuvwxyz":
    CHAR_TO_CLS[c] = c
# Space is NOT a class — it is rendered as a visual gap (WORD_GAP px)
CHAR_TO_CLS["."] = "period"
CHAR_TO_CLS[","] = "comma"
CHAR_TO_CLS["?"] = "question"
CHAR_TO_CLS["!"] = "exclamation"
for i in range(10):
    digit_names = ["zero","one","two","three","four","five","six","seven","eight","nine"]
    CHAR_TO_CLS[str(i)] = digit_names[i]


def render_sentence(text, num_lines_target=1):
    """
    Render a Braille sentence image from character templates.
    Returns: (PIL.Image, list of (cls_id, cx, cy, w, h) in normalized coords)
    """
    chars = list(text)
    words = text.split(" ")

    # Pre-compute word widths
    word_cells = []
    for word in words:
        cells = []
        for ch in word:
            cls = CHAR_TO_CLS.get(ch)
            if cls is None:
                continue
            tmpl = random.choice(templates[cls])
            cells.append((cls, tmpl))
        word_cells.append(cells)

    # Layout: wrap lines at MAX_LINE_W
    lines = []  # list of list of (cls, tmpl, x, y)
    cur_x = 0
    cur_y = 0
    cur_line = []

    for wi, cells in enumerate(word_cells):
        word_w = len(cells) * CELL_W + (len(cells) - 1) * INTER_CELL_GAP
        # Check wrap
        if cur_x > 0 and cur_x + WORD_GAP + word_w > MAX_LINE_W:
            lines.append(cur_line)
            cur_line = []
            cur_x = 0
            cur_y += CELL_H + LINE_GAP
        elif cur_x > 0:
            # Space is a visual gap only — no bounding box, no class label
            cur_x += WORD_GAP

        for cls, tmpl in cells:
            cur_line.append((cls, tmpl, cur_x, cur_y))
            cur_x += CELL_W + INTER_CELL_GAP

        # Remove trailing inter-cell gap
        if cells:
            cur_x -= INTER_CELL_GAP
            cur_x += 0  # next word starts after WORD_GAP

    if cur_line:
        lines.append(cur_line)

    # Compute image size
    all_items = [item for line in lines for item in line]
    if not all_items:
        # Fallback: single character
        cls = random.choice(CLASS_NAMES)
        tmpl = random.choice(templates[cls])
        all_items = [(cls, tmpl, 0, 0)]

    max_x = max(x + CELL_W for _, _, x, _ in all_items)
    max_y = max(y + CELL_H for _, _, _, y in all_items)

    # Add padding
    pad = random.randint(15, 40)
    img_w = max_x + 2 * pad
    img_h = max_y + 2 * pad

    img = Image.new("RGB", (img_w, img_h), BG_COLOR)
    labels = []

    for cls, tmpl, x, y in all_items:
        px = x + pad
        py = y + pad
        # Paste template
        tmpl_rgb = tmpl.convert("RGB") if tmpl.mode != "RGB" else tmpl
        img.paste(tmpl_rgb, (px, py))
        # YOLO label (normalized)
        cx = (px + CELL_W / 2) / img_w
        cy = (py + CELL_H / 2) / img_h
        bw = CELL_W / img_w
        bh = CELL_H / img_h
        cls_id = CLASS_TO_IDX[cls]
        labels.append((cls_id, cx, cy, bw, bh))

    return img, labels


# ─────────────────────────────────────────────────────────────────────────────
# 4. Augmentation pipeline (applied after rendering)
# ─────────────────────────────────────────────────────────────────────────────
def augment_image(img, labels):
    """
    Apply augmentations to rendered image. Updates bbox coords where needed.
    Returns: (augmented PIL.Image, updated labels)
    """
    arr = np.array(img).astype(np.float32)
    h, w = arr.shape[:2]

    # Paper grain noise (σ=8–15)
    sigma = random.uniform(8, 15)
    noise = np.random.normal(0, sigma, arr.shape)
    arr = arr + noise

    # Lighting gradient (0.7–1.3)
    direction = random.choice(["horizontal", "vertical", "diagonal"])
    low = random.uniform(0.7, 0.9)
    high = random.uniform(1.1, 1.3)
    if direction == "horizontal":
        gradient = np.linspace(low, high, w).reshape(1, w, 1)
    elif direction == "vertical":
        gradient = np.linspace(low, high, h).reshape(h, 1, 1)
    else:
        gx = np.linspace(low, high, w).reshape(1, w)
        gy = np.linspace(low, high, h).reshape(h, 1)
        gradient = ((gx + gy) / 2).reshape(h, w, 1)
    arr = arr * gradient

    arr = np.clip(arr, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr)

    # Rotation ±10° (15% of the time for variety, but always small)
    if random.random() < 0.5:
        angle = random.uniform(-10, 10)
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=BG_COLOR)
        new_w, new_h = img.size
        # Update labels for rotation
        rad = math.radians(-angle)
        cos_a, sin_a = math.cos(rad), math.sin(rad)
        new_labels = []
        for cls_id, cx, cy, bw, bh in labels:
            # Convert to absolute
            ax = cx * w - w/2
            ay = cy * h - h/2
            # Rotate
            rx = ax * cos_a - ay * sin_a
            ry = ax * sin_a + ay * cos_a
            # Convert back to normalized (new size)
            nx = (rx + new_w/2) / new_w
            ny = (ry + new_h/2) / new_h
            nw = bw * w / new_w
            nh = bh * h / new_h
            if 0 < nx < 1 and 0 < ny < 1:
                new_labels.append((cls_id, nx, ny, nw, nh))
        labels = new_labels
        w, h = new_w, new_h

    # Blur (15% chance)
    if random.random() < 0.15:
        radius = random.uniform(0.5, 1.5)
        img = img.filter(ImageFilter.GaussianBlur(radius=radius))

    # Shadow overlay (20% chance)
    if random.random() < 0.20:
        shadow = Image.new("L", img.size, 255)
        draw = ImageDraw.Draw(shadow)
        # Random dark rectangle
        sx = random.randint(0, max(1, img.size[0]//2))
        sy = random.randint(0, max(1, img.size[1]//2))
        sw = random.randint(img.size[0]//4, img.size[0])
        sh = random.randint(img.size[1]//4, img.size[1])
        opacity = random.randint(160, 220)
        draw.rectangle([sx, sy, sx+sw, sy+sh], fill=opacity)
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=15))
        img_arr = np.array(img).astype(np.float32)
        shadow_arr = np.array(shadow).astype(np.float32) / 255.0
        if len(img_arr.shape) == 3:
            shadow_arr = shadow_arr[:,:,np.newaxis]
        img_arr = img_arr * shadow_arr
        img = Image.fromarray(np.clip(img_arr, 0, 255).astype(np.uint8))

    # Perspective warp (apply occasionally)
    if random.random() < 0.3:
        try:
            coeffs = [random.uniform(-0.0005, 0.0005) for _ in range(8)]
            coeffs[6] = random.uniform(-0.0003, 0.0003)
            coeffs[7] = random.uniform(-0.0003, 0.0003)
            img = img.transform(img.size, Image.PERSPECTIVE, coeffs, Image.BICUBIC,
                                fillcolor=BG_COLOR)
        except Exception:
            pass  # perspective can fail on edge cases

    return img, labels


# ─────────────────────────────────────────────────────────────────────────────
# 5. Generate images
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Generating synthetic images ──")
(OUT_DIR / "images").mkdir(parents=True, exist_ok=True)
(OUT_DIR / "labels").mkdir(parents=True, exist_ok=True)

# Distribution: 60% single-line, 30% two-line, 10% three-line
line_dist = (
    [1] * int(NUM_IMAGES * 0.6) +
    [2] * int(NUM_IMAGES * 0.3) +
    [3] * int(NUM_IMAGES * 0.1)
)
random.shuffle(line_dist)

# Track class counts for balancing
class_counts = Counter()
generated = 0

# Phase 1: generate from corpus
for i in tqdm(range(NUM_IMAGES), desc="Generating"):
    target_lines = line_dist[i] if i < len(line_dist) else 1

    # Build text from 1+ sentences depending on line target
    text_parts = []
    for _ in range(target_lines):
        text_parts.append(random.choice(sentences))
    text = " ".join(text_parts)

    # Render
    img, labels = render_sentence(text, target_lines)

    # Augment
    img, labels = augment_image(img, labels)

    # Validate bboxes
    valid_labels = []
    for cls_id, cx, cy, bw, bh in labels:
        cx = max(0, min(1, cx))
        cy = max(0, min(1, cy))
        bw = max(0.001, min(1, bw))
        bh = max(0.001, min(1, bh))
        valid_labels.append((cls_id, cx, cy, bw, bh))
        class_counts[cls_id] += 1

    # Save
    img_path = OUT_DIR / "images" / f"synth_{i:06d}.jpg"
    lbl_path = OUT_DIR / "labels" / f"synth_{i:06d}.txt"
    img.save(str(img_path), "JPEG", quality=92)
    lbl_lines = [f"{c} {x:.6f} {y:.6f} {w:.6f} {h:.6f}" for c, x, y, w, h in valid_labels]
    lbl_path.write_text("\n".join(lbl_lines) + "\n")
    generated += 1

# Phase 2: boost under-represented classes
print("\n── Boosting under-represented classes ──")
boost_idx = generated
for cls_id, cls_name in enumerate(CLASS_NAMES):
    current = class_counts.get(cls_id, 0)
    needed = max(0, MIN_CLASS_COUNT - current)
    if needed > 0:
        print(f"  Boosting '{cls_name}': {current} → {current + needed}")
        for _ in range(needed):
            # Build a sentence featuring this character heavily
            if cls_name in CHAR_TO_CLS.values():
                # Find the actual char
                target_char = None
                for ch, cn in CHAR_TO_CLS.items():
                    if cn == cls_name:
                        target_char = ch; break
                if target_char and target_char != " ":
                    # Build text with this char repeated
                    base = random.choice(sentences)
                    words = base.split()
                    # Insert char into words
                    boosted = target_char.join(words[:3])
                    text = boosted + " " + " ".join(words[3:6])
                else:
                    text = random.choice(sentences)
            else:
                text = random.choice(sentences)

            img, labels = render_sentence(text, 1)
            img, labels = augment_image(img, labels)

            valid_labels = []
            for cid, cx, cy, bw, bh in labels:
                cx = max(0, min(1, cx)); cy = max(0, min(1, cy))
                bw = max(0.001, min(1, bw)); bh = max(0.001, min(1, bh))
                valid_labels.append((cid, cx, cy, bw, bh))
                class_counts[cid] += 1

            img_path = OUT_DIR / "images" / f"synth_{boost_idx:06d}.jpg"
            lbl_path = OUT_DIR / "labels" / f"synth_{boost_idx:06d}.txt"
            img.save(str(img_path), "JPEG", quality=92)
            lbl_lines = [f"{c} {x:.6f} {y:.6f} {w:.6f} {h:.6f}" for c,x,y,w,h in valid_labels]
            lbl_path.write_text("\n".join(lbl_lines) + "\n")
            boost_idx += 1

total_generated = boost_idx
print(f"\n  Total images generated: {total_generated}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. Validation
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Validation ──")

# Re-count from files
final_counts = Counter()
lbl_dir = OUT_DIR / "labels"
for lbl_f in lbl_dir.iterdir():
    if lbl_f.suffix != ".txt":
        continue
    for line in lbl_f.read_text().strip().split("\n"):
        if not line.strip():
            continue
        parts = line.strip().split()
        cls_id = int(parts[0])
        # Validate bbox in [0,1]
        vals = [float(v) for v in parts[1:5]]
        for v in vals:
            assert 0 <= v <= 1.0, f"Bbox value {v} out of [0,1] in {lbl_f}"
        final_counts[cls_id] += 1

print("\n  Class distribution:")
low_classes = []
for cls_id, cls_name in enumerate(CLASS_NAMES):
    count = final_counts.get(cls_id, 0)
    flag = ""
    if count < 300:
        flag = " ⚠ BELOW 300"
        low_classes.append(cls_name)
    print(f"    {cls_id:2d} {cls_name:12s}: {count:>6}")

if low_classes:
    print(f"\n  WARNING: classes below 300 threshold: {low_classes}")
else:
    print(f"\n  ✓ All classes have ≥300 instances")

total_labels = sum(final_counts.values())
total_images = len(list((OUT_DIR / "images").glob("*.jpg")))
print(f"\n  Total images: {total_images}")
print(f"  Total labels: {total_labels}")
print(f"  Avg labels/image: {total_labels/max(1,total_images):.1f}")
print("\n=== synthetic_sentence_generator.py complete ===")
