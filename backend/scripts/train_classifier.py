"""Fine-tunes YOLOv8n-cls on a prepared classification dataset (see
scripts/prepare_classification_dataset.py) and saves weights to the path app/ml/classifier.py
loads at startup.

Full reproduction of the crop classifier shipped in ml_artifacts/ocean_eye_cls.pt:

    # 1. Turn the user-supplied per-class crops into localizer-consistent training data (closes
    #    the train/inference distribution gap - see generate_localizer_consistent_crops.py's
    #    docstring for why this matters; skipping this step reproduces the *first*, buggier
    #    version that confidently misclassified background noise as high-confidence hazards).
    python -m scripts.generate_localizer_consistent_crops \
        --source "/Users/manishagupta/Downloads/train" --out ml_artifacts/localizer_crops

    # 2. Split into Ultralytics format, grouped by parent source image (no train/val leakage).
    python -m scripts.prepare_classification_dataset \
        --source ml_artifacts/localizer_crops --out ml_artifacts/datasets/ocean_eye_cls_v2

    # 3. Train.
    python -m scripts.train_classifier --data ml_artifacts/datasets/ocean_eye_cls_v2

    # 4. Retrain the discrimination + calibration stages on the same corrected dataset.
    python -m scripts.train_discriminator_from_real_data --dataset ml_artifacts/datasets/ocean_eye_cls_v2
    python -m scripts.train_calibrator_from_real_data --dataset ml_artifacts/datasets/ocean_eye_cls_v2 \
        --weights ml_artifacts/ocean_eye_cls.pt
"""
import argparse
import shutil
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, help="Ultralytics classification dataset (train/<class>/*, val/<class>/*)")
    parser.add_argument("--weights", default="yolov8n-cls.pt", help="Starting checkpoint")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--patience", type=int, default=15)
    parser.add_argument("--device", default="mps", help="'mps' for Apple Silicon GPU, 'cpu', or a CUDA device index")
    parser.add_argument("--out", default="ml_artifacts/ocean_eye_cls.pt")
    args = parser.parse_args()

    from ultralytics import YOLO

    model = YOLO(args.weights)
    results = model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        device=args.device,
        batch=args.batch,
        patience=args.patience,
        project="ml_artifacts/runs",
        name="ocean_eye_cls",
        exist_ok=True,
    )

    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(best_weights, args.out)
    print(f"Trained classifier saved to {args.out}")
    print("Run scripts/train_discriminator_from_real_data.py and scripts/train_calibrator_from_real_data.py next.")


if __name__ == "__main__":
    main()
