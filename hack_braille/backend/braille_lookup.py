#!/usr/bin/env python3
"""
=== FILE 2: braille_lookup.py ===
Single source of truth for English Grade 1 Braille.

Dot layout (standard Braille cell):
    1 4
    2 5
    3 6

Each character is a 6-bit tuple: (d1, d2, d3, d4, d5, d6)
  1 = raised dot, 0 = flat.

40 classes: a–z, 0–9, period, comma, question mark, exclamation mark.
  (26 letters + 10 digits + 4 punctuation = 40)
Space is NOT a detectable class — it is inferred from gaps between cells
during inference.
Digits use the Braille number indicator convention but here each digit is
its own class with the letter-sign dots (a–j pattern) for simplicity.
"""

print("=== FILE 2: braille_lookup.py ===")

# ── English Braille Map: 6-bit tuple → character ─────────────────────────────
# Letters a-z
ENGLISH_BRAILLE_MAP = {
    (1, 0, 0, 0, 0, 0): "a",
    (1, 1, 0, 0, 0, 0): "b",
    (1, 0, 0, 1, 0, 0): "c",
    (1, 0, 0, 1, 1, 0): "d",
    (1, 0, 0, 0, 1, 0): "e",
    (1, 1, 0, 1, 0, 0): "f",
    (1, 1, 0, 1, 1, 0): "g",
    (1, 1, 0, 0, 1, 0): "h",
    (0, 1, 0, 1, 0, 0): "i",
    (0, 1, 0, 1, 1, 0): "j",
    (1, 0, 1, 0, 0, 0): "k",
    (1, 1, 1, 0, 0, 0): "l",
    (1, 0, 1, 1, 0, 0): "m",
    (1, 0, 1, 1, 1, 0): "n",
    (1, 0, 1, 0, 1, 0): "o",
    (1, 1, 1, 1, 0, 0): "p",
    (1, 1, 1, 1, 1, 0): "q",
    (1, 1, 1, 0, 1, 0): "r",
    (0, 1, 1, 1, 0, 0): "s",
    (0, 1, 1, 1, 1, 0): "t",
    (1, 0, 1, 0, 0, 1): "u",
    (1, 1, 1, 0, 0, 1): "v",
    (0, 1, 0, 1, 1, 1): "w",
    (1, 0, 1, 1, 0, 1): "x",
    (1, 0, 1, 1, 1, 1): "y",
    (1, 0, 1, 0, 1, 1): "z",
}

# Punctuation (space is NOT a class — inferred from inter-cell gaps at inference)
ENGLISH_BRAILLE_MAP[(0, 1, 0, 0, 1, 1)] = "period"     # dots 2,5,6
ENGLISH_BRAILLE_MAP[(0, 1, 0, 0, 0, 0)] = "comma"      # dot 2
ENGLISH_BRAILLE_MAP[(0, 1, 0, 0, 1, 0)] = "question"   # dots 2,6  — Grade 1 English
ENGLISH_BRAILLE_MAP[(0, 1, 1, 0, 1, 0)] = "exclamation" # dots 2,3,5

# Digits 0-9 (use the letter-pattern: a=1 … j=0 convention with number indicator omitted)
# We treat each digit as a distinct class; the dot pattern mirrors the letter but class is different.
_DIGIT_PATTERNS = {
    "one":   (1, 0, 0, 0, 0, 0),  # same dots as 'a'
    "two":   (1, 1, 0, 0, 0, 0),  # same dots as 'b'
    "three": (1, 0, 0, 1, 0, 0),  # same dots as 'c'
    "four":  (1, 0, 0, 1, 1, 0),  # same dots as 'd'
    "five":  (1, 0, 0, 0, 1, 0),  # same dots as 'e'
    "six":   (1, 1, 0, 1, 0, 0),  # same dots as 'f'
    "seven": (1, 1, 0, 1, 1, 0),  # same dots as 'g'
    "eight": (1, 1, 0, 0, 1, 0),  # same dots as 'h'
    "nine":  (0, 1, 0, 1, 0, 0),  # same dots as 'i'
    "zero":  (0, 1, 0, 1, 1, 0),  # same dots as 'j'
}
# Note: digits share dot patterns with letters a-j. Disambiguation requires
# the number-indicator prefix in context; for detection the class label
# is what disambiguates them — the model learns from labelled examples.

# ── Reverse map: character → tuple ────────────────────────────────────────────
REVERSE_MAP = {v: k for k, v in ENGLISH_BRAILLE_MAP.items()}
for digit_name, pattern in _DIGIT_PATTERNS.items():
    REVERSE_MAP[digit_name] = pattern

# ── Class names: fixed ordering ──────────────────────────────────────────────
# 26 letters + 10 digits + 4 punctuation = 40
# Space is NOT included — it is inferred from gaps during post-processing
CLASS_NAMES = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j",
    "k", "l", "m", "n", "o", "p", "q", "r", "s", "t",
    "u", "v", "w", "x", "y", "z",
    "zero", "one", "two", "three", "four", "five", "six",
    "seven", "eight", "nine",
    "period", "comma", "question", "exclamation",
]

# ── Index mappings ────────────────────────────────────────────────────────────
CLASS_TO_IDX = {name: idx for idx, name in enumerate(CLASS_NAMES)}
IDX_TO_CLASS = {idx: name for idx, name in enumerate(CLASS_NAMES)}

# ── Set of valid English characters (class names) ────────────────────────────
ENGLISH_CHARS = frozenset(CLASS_NAMES)

# ── Hard assertion — fail loudly if wrong ─────────────────────────────────────
assert len(CLASS_NAMES) == 40, (
    f"CLASS_NAMES must have exactly 40 entries, got {len(CLASS_NAMES)}"
)
assert len(CLASS_TO_IDX) == 40
assert len(IDX_TO_CLASS) == 40

print(f"  Classes defined: {len(CLASS_NAMES)}")
print(f"  Letters: a-z ({sum(1 for c in CLASS_NAMES if len(c)==1)})")
print(f"  Digits: zero-nine (10)")
print(f"  Punctuation: period, comma, question, exclamation (4)")
print("=== braille_lookup.py loaded ===")
