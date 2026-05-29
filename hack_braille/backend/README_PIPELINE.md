# Braille YOLOv11n Recognition Pipeline

This repository contains an end-to-end Python pipeline to construct, train, evaluate, and deploy a custom YOLOv11n model to recognize English Grade 1 Braille from real-world phone camera images.

## Overview of What We Did
1. **Defined exactly 40 classes**: (26 letters, 10 digits, 4 punctuations). We explicitly excluded "space" as a class since a space in Braille is just a visual gap. Spaces are inferred dynamically during post-processing.
2. **Environment Setup**: Initialized a Python virtual environment and installed all required dependencies (`ultralytics`, `roboflow`, `kaggle`, `opencv-python`, etc.).
3. **Data Acquisition Strategy**: Due to limited public English Braille sentence data, we generated thousands of base synthetic Braille characters.
4. **Data Aggregation**: Cloned the `DSBI` and `AngelinaDataset` from GitHub, keeping only English-compatible annotations.
5. **Data Generation & Augmentation**:
   - `synthetic_sentence_generator.py` utilized NLTK Brown corpus text and base synthetic Braille characters to assemble ~16,800 synthetic sentence-level Braille training images.
   - `augment_real_data.py` heavily augmented the limited real-world datasets (scaling, blur, lighting shifts) to boost the robustness of the system without modifying critical positional relationships (no flips).
6. **Data Merging & Splitting**: `merge_and_split.py` safely consolidated the massive dataset (over 28,000 images), removed duplicates via MD5 hashing, and enforced an 80/10/10 Train/Val/Test split, ensuring every one of the 40 classes was represented in every set.
7. **Training Configurations Restored**: Tested the training pipeline locally on macOS (MPS), and cleanly restored both `train_stage1.py` and `train_stage2.py` back to the requested 8× A100 production settings (120/80 epochs, 256/64 batch size, 8 GPUs).

## File Architecture

- **`braille_lookup.py`**: The central source of truth for the 40 Braille classes. Contains class name-to-index mapping and standard 6-dot matrix definitions. Required by almost every other file.
- **`setup_env.sh` / `setup_env.bat`**: Scripts to prepare Linux/Mac or Windows systems, respectively. They install dependencies, export environment variables, and verify GPU integrity.
- **`download_datasets.py`**: Handles downloading data sources from Kaggle and Roboflow (requires API tokens).
- **`convert_annotations.py`**: Unifies various annotation formats from DSBI, Kaggle, and Angelina datasets into standardized YOLO format coordinates (normalized `class x_center y_center width height`).
- **`generate_base_templates.py`**: A fallback script utilized when Kaggle datasets are unavailable; artificially generates the raw Braille single-character template images needed to render full sentences.
- **`synthetic_sentence_generator.py`**: The core data engine. Combines NLTK English corpus sentences with Braille character templates to produce thousands of complete synthetic Braille sentence images.
- **`augment_real_data.py`**: Applies safe YOLO augmentations (no flipping) 4x to any actual real-world images present in the dataset.
- **`merge_and_split.py`**: Deduplicates (via MD5), randomly shuffles, and partitions all combined data into `train`, `val`, and `test` directories. Generates the final YOLO `data.yaml`.
- **`train_stage1.py`**: Stage 1 training script. Freezes the YOLO backbone and trains with a high learning rate at 640px resolution (configured for 8x A100 GPUs).
- **`train_stage2.py`**: Stage 2 training script. Unfreezes the backbone and fine-tunes the network with a low learning rate at 1280px high-resolution (configured for 8x A100 GPUs).
- **`evaluate.py`**: Evaluates the best model from stage 2 on the held-out test split, logging metrics, creating a confusion matrix, and performing sample inference. 
- **`export.py`**: Converts the final `.pt` weights into `.onnx` and `.tflite` optimized inference models while verifying they run under the 80ms latency requirement.
- **`inference.py`**: The production CLI tool. Consumes an image and the exported `.onnx` model, runs inference, groups detected characters into reading lines, infers spaces via x-coordinate gaps, and prints the raw English text.

## How to Run in Production (A100)

1. Activate your environment and configure API keys.
2. Run data steps: `python download_datasets.py`, `python convert_annotations.py`.
3. Build the dataset: `python synthetic_sentence_generator.py`, `python augment_real_data.py`, `python merge_and_split.py`.
4. Train Stage 1: `python -m torch.distributed.run --nproc_per_node=8 train_stage1.py`
5. Train Stage 2: `python -m torch.distributed.run --nproc_per_node=8 train_stage2.py`
6. Finalize: `python evaluate.py`, `python export.py`.
7. Inference: `python inference.py --image example.jpg`
