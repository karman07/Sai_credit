#!/usr/bin/env bash
# === FILE 1: setup_env.sh ===
# Installs all Python dependencies and validates the GPU + credential environment.
set -euo pipefail

echo "=== FILE 1: setup_env.sh ==="

# ── Python packages ──────────────────────────────────────────────────────────
pip install --upgrade pip
pip install \
    ultralytics \
    roboflow \
    albumentations \
    kaggle \
    Pillow \
    tqdm \
    pyyaml \
    wandb \
    opencv-python \
    scipy \
    scikit-learn \
    nltk \
    onnxruntime-gpu

# Download NLTK corpora used by the synthetic generator
python -c "import nltk; nltk.download('brown', quiet=True); nltk.download('punkt', quiet=True); nltk.download('punkt_tab', quiet=True)"

# ── Credential checks ────────────────────────────────────────────────────────
MISSING=0

if [ -z "${KAGGLE_USERNAME:-}" ]; then
    echo "ERROR: KAGGLE_USERNAME is not set."
    MISSING=1
fi

if [ -z "${KAGGLE_KEY:-}" ]; then
    echo "ERROR: KAGGLE_KEY is not set."
    MISSING=1
fi

if [ -z "${ROBOFLOW_API_KEY:-}" ]; then
    echo "ERROR: ROBOFLOW_API_KEY is not set."
    MISSING=1
fi

if [ "$MISSING" -eq 1 ]; then
    echo "Set the missing environment variables and re-run."
    exit 1
fi

echo "All credentials present."

# ── GPU validation ────────────────────────────────────────────────────────────
echo ""
echo "─── nvidia-smi ───"
nvidia-smi

GPU_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l | tr -d ' ')
echo ""
echo "Detected GPUs: $GPU_COUNT"

if [ "$GPU_COUNT" -lt 8 ]; then
    echo "WARNING: Expected 8 GPUs, found $GPU_COUNT. Multi-GPU training may need adjustments."
else
    echo "All 8 GPUs confirmed."
fi

echo ""
echo "=== setup_env.sh complete ==="
