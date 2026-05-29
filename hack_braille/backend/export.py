#!/usr/bin/env python3
"""
=== FILE 11: export.py ===
Exports the trained model to ONNX and TFLite INT8.
Benchmarks inference latency on single GPU (target: <80ms).
"""
import os, sys, time
from pathlib import Path
import numpy as np

print("=== FILE 11: export.py ===")

from braille_lookup import CLASS_NAMES

# ─────────────────────────────────────────────────────────────────────────────
# Load model
# ─────────────────────────────────────────────────────────────────────────────
weights = Path("./runs/stage2/weights/best.pt")
if not weights.exists():
    print(f"ERROR: Weights not found at {weights}")
    sys.exit(1)

from ultralytics import YOLO
model = YOLO(str(weights))
print(f"  Model loaded: {weights}")

export_dir = Path("./exports")
export_dir.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# Export ONNX
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Exporting ONNX ──")
onnx_path = model.export(
    format="onnx",
    imgsz=640,
    simplify=True,
    opset=17,
)
# Copy to exports dir
import shutil
onnx_dst = export_dir / "braille_yolo11n.onnx"
if onnx_path and Path(onnx_path).exists():
    shutil.copy2(onnx_path, onnx_dst)
    print(f"  ONNX saved: {onnx_dst}")
    print(f"  Size: {onnx_dst.stat().st_size / 1024 / 1024:.2f} MB")
else:
    print(f"  WARNING: ONNX export returned {onnx_path}")

# ─────────────────────────────────────────────────────────────────────────────
# Export TFLite INT8
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Exporting TFLite INT8 ──")
try:
    tflite_path = model.export(
        format="tflite",
        imgsz=640,
        int8=True,
    )
    tflite_dst = export_dir / "braille_yolo11n_int8.tflite"
    if tflite_path and Path(tflite_path).exists():
        shutil.copy2(tflite_path, tflite_dst)
        print(f"  TFLite saved: {tflite_dst}")
        print(f"  Size: {tflite_dst.stat().st_size / 1024 / 1024:.2f} MB")
    else:
        print(f"  WARNING: TFLite export returned {tflite_path}")
except Exception as e:
    print(f"  WARNING: TFLite export failed: {e}")
    print("  This may require tensorflow installed. Continuing with ONNX only.")

# ─────────────────────────────────────────────────────────────────────────────
# Benchmark: ONNX on single GPU
# ─────────────────────────────────────────────────────────────────────────────
print("\n── Benchmarking ONNX inference ──")

try:
    import onnxruntime as ort

    # Configure for GPU if available
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    available = ort.get_available_providers()
    if "CUDAExecutionProvider" not in available:
        print("  WARNING: CUDA not available for ONNX Runtime, using CPU")
        providers = ["CPUExecutionProvider"]

    sess = ort.InferenceSession(str(onnx_dst), providers=providers)
    input_name = sess.get_inputs()[0].name
    input_shape = sess.get_inputs()[0].shape  # e.g., [1, 3, 640, 640]

    # Generate dummy input
    dummy = np.random.randn(1, 3, 640, 640).astype(np.float32)

    # Warmup
    print("  Warmup: 100 runs...")
    for _ in range(100):
        sess.run(None, {input_name: dummy})

    # Timed runs
    print("  Timing: 500 runs...")
    times = []
    for _ in range(500):
        t0 = time.perf_counter()
        sess.run(None, {input_name: dummy})
        t1 = time.perf_counter()
        times.append((t1 - t0) * 1000)  # ms

    times = np.array(times)
    mean_ms = times.mean()
    std_ms = times.std()
    p50 = np.percentile(times, 50)
    p95 = np.percentile(times, 95)
    p99 = np.percentile(times, 99)

    print(f"\n  Inference Latency:")
    print(f"    Mean:  {mean_ms:.2f} ± {std_ms:.2f} ms")
    print(f"    P50:   {p50:.2f} ms")
    print(f"    P95:   {p95:.2f} ms")
    print(f"    P99:   {p99:.2f} ms")

    if mean_ms < 80:
        print(f"    ✓ PASS: Mean latency {mean_ms:.2f}ms < 80ms target")
    else:
        print(f"    ⚠ FAIL: Mean latency {mean_ms:.2f}ms >= 80ms target")

except Exception as e:
    print(f"  WARNING: Benchmark failed: {e}")
    print("  Install onnxruntime-gpu for GPU benchmarks.")

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("Export Summary:")
print("=" * 60)
for f in sorted(export_dir.iterdir()):
    size_mb = f.stat().st_size / 1024 / 1024
    print(f"  {f.name}: {size_mb:.2f} MB")
print("\n=== export.py complete ===")
