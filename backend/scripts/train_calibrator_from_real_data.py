"""Retrains the confidence calibrator (app/ml/calibration.py) on REAL (confidence, correct) pairs
from the trained crop classifier's predictions on its own held-out validation split, replacing the
synthetic overconfidence-curve bootstrap.

Also computes and prints the real Expected Calibration Error (ECE) - both raw (before this
script's fit) and calibrated (after) - so the improvement is honestly measured rather than
illustrative.

Usage:
    python -m scripts.train_calibrator_from_real_data --dataset ml_artifacts/datasets/ocean_eye_cls \
        --weights ml_artifacts/ocean_eye_cls.pt
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import numpy as np
from sklearn.isotonic import IsotonicRegression

from app.core.config import settings
from app.ml.calibration import REAL_VALIDATION_DATA_PATH, compute_ece


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--weights", required=True)
    parser.add_argument("--out", default=settings.CALIBRATOR_WEIGHTS_PATH)
    args = parser.parse_args()

    from ultralytics import YOLO

    model = YOLO(args.weights)
    val_dir = Path(args.dataset) / "val"

    confidences, corrects = [], []
    for class_dir in sorted(val_dir.iterdir()):
        if not class_dir.is_dir():
            continue
        true_label = class_dir.name
        for img_path in class_dir.iterdir():
            if img_path.name.startswith("."):
                continue
            result = model.predict(str(img_path), verbose=False)[0]
            pred_label = result.names[int(result.probs.top1)]
            confidences.append(float(result.probs.top1conf))
            corrects.append(1 if pred_label == true_label else 0)

    confidences, corrects = np.array(confidences), np.array(corrects)
    raw_ece, _ = compute_ece(confidences, corrects, n_bins=10)
    print(f"Raw ECE on {len(corrects)} held-out predictions: {raw_ece:.4f}")

    calibrator = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    calibrator.fit(confidences, corrects)

    calibrated = np.clip(calibrator.predict(confidences), 0.0, 1.0)
    calibrated_ece, _ = compute_ece(calibrated, corrects, n_bins=10)
    print(f"Calibrated ECE (in-sample, small val set - treat as directional): {calibrated_ece:.4f}")

    joblib.dump(calibrator, args.out)
    print(f"Calibrator retrained on real predictions and saved to {args.out}")

    with open(REAL_VALIDATION_DATA_PATH, "w") as f:
        json.dump({"confidences": confidences.tolist(), "corrects": corrects.tolist()}, f)
    print(f"Real validation data saved to {REAL_VALIDATION_DATA_PATH} (Analytics page reliability diagram picks this up automatically)")


if __name__ == "__main__":
    main()
