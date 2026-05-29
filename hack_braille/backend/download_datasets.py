#!/usr/bin/env python3
"""
=== FILE 3: download_datasets.py ===
Downloads all Braille datasets into ./data/raw/{source}/.
"""
import os, sys, subprocess
from pathlib import Path

print("=== FILE 3: download_datasets.py ===")

RAW = Path("./data/raw")
RAW.mkdir(parents=True, exist_ok=True)

KU = os.environ.get("KAGGLE_USERNAME")
KK = os.environ.get("KAGGLE_KEY")
RK = os.environ.get("ROBOFLOW_API_KEY")
if not KU or not KK:
    print("ERROR: KAGGLE_USERNAME / KAGGLE_KEY not set"); sys.exit(1)
if not RK:
    print("ERROR: ROBOFLOW_API_KEY not set"); sys.exit(1)

IMG_EXT = {".jpg",".jpeg",".png",".bmp",".tif",".tiff",".webp"}

def count_img(d):
    return sum(1 for f in d.rglob("*") if f.suffix.lower() in IMG_EXT) if d.exists() else 0

def dl_kaggle(slug, name):
    dest = RAW / name; dest.mkdir(parents=True, exist_ok=True)
    print(f"\n── Kaggle: {slug}")
    try:
        subprocess.run(["kaggle","datasets","download","-d",slug,"-p",str(dest),"--unzip"],
                        check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        print(f"  ERROR: {e.stderr}"); return
    n = count_img(dest)
    print(f"  {'OK' if n else 'ERROR'}: {n} images")

def dl_roboflow(ws, proj, ver, name):
    dest = RAW / name; dest.mkdir(parents=True, exist_ok=True)
    print(f"\n── Roboflow: {ws}/{proj} v{ver}")
    try:
        from roboflow import Roboflow
        rf = Roboflow(api_key=RK)
        rf.workspace(ws).project(proj).version(ver).download("yolov11", location=str(dest))
    except Exception as e:
        print(f"  ERROR: {e}"); return
    n = count_img(dest)
    print(f"  {'OK' if n else 'ERROR'}: {n} images")

def dl_github(url, name):
    dest = RAW / name
    print(f"\n── GitHub: {url}")
    if not dest.exists():
        try:
            subprocess.run(["git","clone","--depth","1",url,str(dest)],
                            check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            print(f"  ERROR: {e.stderr}"); return
    n = count_img(dest)
    print(f"  Images: {n}" + (" (may use dot-coord data)" if n==0 else ""))

for s,n in [("shanks0465/braille-character-dataset","kaggle_shanks"),
            ("adviksharma/braille-images-for-english-characters","kaggle_advik"),
            ("mdismielhossenabir/braille-character-image-classification","kaggle_mdismiel"),
            ("changjianli/braille-dataset-for-scene-text-recognition","kaggle_changjian")]:
    dl_kaggle(s,n)

for ws,p,v,n in [("braille-kp","braille-alphabet-v2",1,"roboflow_braille_kp"),
                  ("satwika-paul-tr5id","more-detailed-braille",1,"roboflow_satwika"),
                  ("braille-gtfu9","braille-wvmcp",1,"roboflow_gtfu9"),
                  ("braille-jjezl","braille-detection-v2-xpwue",1,"roboflow_jjezl")]:
    dl_roboflow(ws,p,v,n)

dl_github("https://github.com/yeluo1994/DSBI.git","github_dsbi")
dl_github("https://github.com/IlyaOvodov/AngelinaDataset.git","github_angelina")

print("\n" + "="*60 + "\nDownload Summary:\n" + "="*60)
total=0
for d in sorted(RAW.iterdir()):
    if d.is_dir():
        n=count_img(d); total+=n
        print(f"  {d.name:30s} {n:>6} images  [{'OK' if n else 'ERROR'}]")
print(f"\nTotal: {total} images")
print("=== download_datasets.py complete ===")
