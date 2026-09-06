"""Prepares a real, user-supplied per-class image folder (crops, no bounding boxes) into the
Ultralytics classification dataset layout:

    <out>/train/<class_name>/*.jpg
    <out>/val/<class_name>/*.jpg

Source layout expected: <source>/<Class Name>/*.jpg|png (one subfolder per class, arbitrary
capitalization/spacing - normalized to snake_case here). Split is stratified per class so small
classes still get a reasonable validation slice.

Split is grouped by *parent source image*, not by individual file: when multiple crops came from
the same original image (e.g. "10_c0.jpg".."10_c7.jpg" from scripts/generate_localizer_consistent_
crops.py, all derived from source image "10"), they are kept entirely within train OR val, never
split across both - otherwise near-duplicate/overlapping crops of the same source image would leak
between train and val and inflate the reported validation accuracy. Plain per-class datasets
(one crop per file, no shared parent) are unaffected - each file is its own group.

Usage:
    python -m scripts.prepare_classification_dataset \
        --source "/Users/manishagupta/Downloads/train" \
        --out ml_artifacts/datasets/ocean_eye_cls \
        --val-fraction 0.15
"""
import argparse
import random
import re
import shutil
from collections import defaultdict
from pathlib import Path

_CROP_SUFFIX_RE = re.compile(r"(_c\d+|_whole)$")


def normalize_class_name(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def parent_group_id(path: Path) -> str:
    return _CROP_SUFFIX_RE.sub("", path.stem)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", required=True, help="Folder containing one subfolder per class")
    parser.add_argument("--out", required=True, help="Output folder for the Ultralytics-format dataset")
    parser.add_argument("--val-fraction", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    source = Path(args.source)
    out = Path(args.out)
    rng = random.Random(args.seed)

    if out.exists():
        shutil.rmtree(out)

    summary = {}
    for class_dir in sorted(source.iterdir()):
        if not class_dir.is_dir() or class_dir.name.startswith("."):
            continue
        class_name = normalize_class_name(class_dir.name)
        images = [
            p for p in class_dir.iterdir()
            if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in (".jpg", ".jpeg", ".png")
        ]

        groups: dict[str, list[Path]] = defaultdict(list)
        for p in images:
            groups[parent_group_id(p)].append(p)
        group_ids = list(groups.keys())
        rng.shuffle(group_ids)

        n_val_groups = max(1, round(len(group_ids) * args.val_fraction)) if len(group_ids) > 4 else 1
        val_group_ids = set(group_ids[:n_val_groups])

        train_images = [p for gid in group_ids if gid not in val_group_ids for p in groups[gid]]
        val_images = [p for gid in val_group_ids for p in groups[gid]]

        for split, split_images in (("train", train_images), ("val", val_images)):
            dest_dir = out / split / class_name
            dest_dir.mkdir(parents=True, exist_ok=True)
            for img_path in split_images:
                shutil.copy2(img_path, dest_dir / img_path.name)

        summary[class_name] = (len(train_images), len(val_images))

    print(f"Dataset written to {out} (split grouped by parent source image - no leakage across train/val)")
    print(f"{'class':30s} {'train':>6s} {'val':>6s}")
    for class_name, (n_train, n_val) in summary.items():
        print(f"{class_name:30s} {n_train:6d} {n_val:6d}")


if __name__ == "__main__":
    main()
