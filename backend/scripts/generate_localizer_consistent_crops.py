"""Regenerates classification training crops using the SAME classical-CV localizer that runs at
inference time (app/ml/detector.py's MockSonarDetector), instead of the user's original
whole-image crops.

Why this matters: the first version of the crop classifier was trained on clean, full-resolution
per-class images, but in production it only ever sees small candidate sub-regions the localizer
proposes - which get resized to 224x224 for classification. A small, low-information sub-crop of
pure seabed noise, heavily upscaled, looks structurally different from a properly-scaled full
"seabed_surface" training example, and the model had never seen that distribution - so it defaulted
to a confident wrong guess (observed: background noise classified as "plane_real" at high
confidence) instead of recognizing background. Training on localizer-proposed crops closes that
train/inference gap, including deliberately capturing what upscaled background noise looks like so
the model learns to reject it, rather than only ever seeing clean full-size background examples.

For object classes (not background), running the localizer on an already-cropped single-object
image mostly re-finds sub-regions of that same object - a reasonable form of augmentation, and
consistent with how those objects will actually be seen at inference (the localizer fragments large
objects into several candidate boxes, as observed on real plane-wreck crops).

Usage:
    python -m scripts.generate_localizer_consistent_crops \
        --source "training_data/raw" \
        --out ml_artifacts/localizer_crops \
        --max-crops-per-image 8
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2

from app.ml.detector import MockSonarDetector


def normalize_class_name(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", required=True, help="Original per-class folder (one subfolder per class)")
    parser.add_argument("--out", required=True, help="Output folder, one subfolder per class, localizer-cropped images")
    parser.add_argument("--max-crops-per-image", type=int, default=8, help="Cap candidates kept per source image")
    parser.add_argument("--padding-px", type=int, default=4, help="Padding added around each candidate box before cropping")
    args = parser.parse_args()

    source = Path(args.source)
    out = Path(args.out)
    localizer = MockSonarDetector()

    total_crops = 0
    total_fallback_whole_image = 0

    for class_dir in sorted(source.iterdir()):
        if not class_dir.is_dir() or class_dir.name.startswith("."):
            continue
        class_name = normalize_class_name(class_dir.name)
        dest_dir = out / class_name
        dest_dir.mkdir(parents=True, exist_ok=True)

        images = [
            p for p in class_dir.iterdir()
            if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in (".jpg", ".jpeg", ".png")
        ]
        for img_path in images:
            image = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
            if image is None:
                continue
            h, w = image.shape[:2]

            result = localizer.detect(image)
            candidates = result.detections[: args.max_crops_per_image]

            if not candidates:
                # No candidates found (e.g. a very uniform image) - keep the original whole image
                # so this source example isn't lost entirely.
                out_path = dest_dir / f"{img_path.stem}_whole.jpg"
                cv2.imwrite(str(out_path), image)
                total_fallback_whole_image += 1
                continue

            for i, det in enumerate(candidates):
                x0 = max(0, det.bbox.x - args.padding_px)
                y0 = max(0, det.bbox.y - args.padding_px)
                x1 = min(w, det.bbox.x + det.bbox.w + args.padding_px)
                y1 = min(h, det.bbox.y + det.bbox.h + args.padding_px)
                crop = image[y0:y1, x0:x1]
                if crop.size == 0:
                    continue
                out_path = dest_dir / f"{img_path.stem}_c{i}.jpg"
                cv2.imwrite(str(out_path), crop)
                total_crops += 1

        n_written = len(list(dest_dir.iterdir()))
        print(f"{class_name:30s} -> {n_written} localizer-consistent crops (from {len(images)} source images)")

    print(f"\nTotal localizer-proposed crops: {total_crops}, whole-image fallbacks: {total_fallback_whole_image}")
    print(f"Written to {out}")


if __name__ == "__main__":
    main()
