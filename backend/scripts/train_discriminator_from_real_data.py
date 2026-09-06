"""Retrains the natural-vs-artificial discrimination classifier (app/ml/discriminator.py) on REAL
derived labels from the user-supplied crop dataset, replacing the synthetic-prior bootstrap.

Each crop in the dataset is treated as a single candidate object filling the whole image (there's
no bounding-box ground truth, but these are already single-object crops, so a full-image bbox is
the correct region to extract shape/shadow/texture features from). Label is derived from the
class folder: engineering_platform / pipeline_or_cable / plane_real -> artificial;
underwater_residual_mound -> natural. seabed_surface (background, no object) is excluded - it
isn't a natural *object*, it's the absence of one.

Usage:
    python -m scripts.train_discriminator_from_real_data --dataset ml_artifacts/datasets/ocean_eye_cls
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.classifier import ARTIFICIAL_CLASSES, BACKGROUND_CLASSES, NATURAL_CLASSES
from app.ml.discriminator import FEATURE_NAMES, extract_features
from app.ml.types import BBox

logger = get_logger(__name__)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dataset", required=True, help="Ultralytics-format classification dataset (train/<class>/*.jpg)")
    parser.add_argument("--out", default=settings.DISCRIMINATOR_WEIGHTS_PATH)
    args = parser.parse_args()

    dataset_dir = Path(args.dataset)
    X, y = [], []
    skipped_background = 0
    skipped_unlabeled = 0

    for split in ("train", "val"):
        split_dir = dataset_dir / split
        if not split_dir.exists():
            continue
        for class_dir in sorted(split_dir.iterdir()):
            if not class_dir.is_dir():
                continue
            class_name = class_dir.name
            if class_name in BACKGROUND_CLASSES:
                skipped_background += len(list(class_dir.iterdir()))
                continue
            if class_name in ARTIFICIAL_CLASSES:
                label = 1
            elif class_name in NATURAL_CLASSES:
                label = 0
            else:
                skipped_unlabeled += len(list(class_dir.iterdir()))
                continue

            for img_path in class_dir.iterdir():
                if img_path.name.startswith("."):
                    continue
                image = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
                if image is None:
                    continue
                h, w = image.shape[:2]
                shape_reg, shadow_len, tex_var = extract_features(image, BBox(x=0, y=0, w=w, h=h))
                X.append([shape_reg, shadow_len, tex_var])
                y.append(label)

    X, y = np.array(X), np.array(y)
    logger.info(
        "real_discriminator_dataset_built",
        n_samples=len(y),
        n_artificial=int(y.sum()),
        n_natural=int(len(y) - y.sum()),
        skipped_background=skipped_background,
        skipped_unlabeled=skipped_unlabeled,
    )

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    clf = GradientBoostingClassifier(n_estimators=150, max_depth=3, learning_rate=0.08, random_state=42)
    clf.fit(X_train, y_train)

    train_acc = clf.score(X_train, y_train)
    val_acc = clf.score(X_val, y_val)
    print(f"Train accuracy: {train_acc:.3f} ({len(y_train)} samples)")
    print(f"Val accuracy:   {val_acc:.3f} ({len(y_val)} samples)")
    print("Feature importances:", dict(zip(FEATURE_NAMES, clf.feature_importances_.round(3).tolist())))

    # Refit on all data before shipping, now that val accuracy has been honestly measured above.
    clf.fit(X, y)
    joblib.dump(clf, args.out)
    print(f"Discriminator retrained on real data and saved to {args.out}")


if __name__ == "__main__":
    main()
