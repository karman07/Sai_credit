@echo off
echo === Braille YOLOv11n Windows Environment Setup ===

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3 is not installed or not in PATH.
    pause
    exit /b 1
)

echo.
echo [1/5] Creating Python virtual environment (venv)...
python -m venv venv
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
)

echo.
echo [2/5] Activating virtual environment and upgrading pip...
call venv\Scripts\activate
python -m pip install --upgrade pip

echo.
echo [3/5] Installing core dependencies (PyTorch, Ultralytics, OpenCV, etc.)...
:: Using standard PyTorch with CUDA 12.4 for Windows
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
pip install ultralytics roboflow albumentations kaggle Pillow tqdm pyyaml wandb opencv-python scipy scikit-learn nltk onnxruntime

echo.
echo [4/5] Downloading required NLTK data...
python -c "import nltk; nltk.download('brown', quiet=True); nltk.download('punkt', quiet=True); nltk.download('punkt_tab', quiet=True); print('NLTK data downloaded successfully.')"

echo.
echo [5/5] Checking Kaggle credentials setup...
if not exist "%USERPROFILE%\.kaggle\kaggle.json" (
    echo [WARNING] Kaggle credentials not found at %USERPROFILE%\.kaggle\kaggle.json
    echo Please download your kaggle.json and place it in that directory before running download_datasets.py
) else (
    echo [OK] Kaggle credentials found.
)

echo.
echo === Setup Complete ===
echo.
echo To begin working, activate your environment:
echo     venv\Scripts\activate
echo.
echo Then proceed with the pipeline:
echo     python download_datasets.py
echo     python convert_annotations.py
echo     python synthetic_sentence_generator.py
echo     python augment_real_data.py
echo     python merge_and_split.py
echo     python train_stage1.py
echo.
pause
