"""Fine-tunes YOLOv8n/s on a side-scan sonar (SSS) dataset in Ultralytics format.

IMPORTANT data-governance rule for this project (PS 26057): Forward-Looking Sonar (FLS) datasets
must never be used as SSS ground truth. FLS may only be used for pretraining/transfer learning
(e.g. `--weights yolov8n.pt` pretrained on FLS+COCO, then fine-tuned here on real SSS labels). Log
whichever source you used in `trained_on` below - it is surfaced verbatim on the Analytics page.

No SSS-labeled dataset ships in this environment, so this script cannot be run here - point it at
your own `data.yaml` (images/, labels/ in YOLO format; classes matching app.ml.detector.CLASS_LABELS)
to actually produce fine-tuned weights.

Usage:
    python -m scripts.train_yolo --data /path/to/sss_data.yaml --weights yolov8n.pt \
        --epochs 100 --imgsz 640 --out ml_artifacts/yolov8n_sss.pt
"""
import argparse
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, help="Path to Ultralytics data.yaml for the SSS dataset")
    parser.add_argument("--weights", default="yolov8n.pt", help="Starting weights (pretrained COCO/FLS checkpoint, or previous SSS checkpoint)")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default="cpu", help="'cpu', '0' for first GPU, etc. CPU-friendly nano/small variants preferred for this prototype.")
    parser.add_argument("--out", default="ml_artifacts/yolov8n_sss.pt")
    args = parser.parse_args()

    from ultralytics import YOLO

    model = YOLO(args.weights)
    results = model.train(
        data=args.data, epochs=args.epochs, imgsz=args.imgsz, batch=args.batch, device=args.device,
    )
    best_weights = results.save_dir / "weights" / "best.pt"
    shutil.copy(best_weights, args.out)
    print(f"Fine-tuned SSS weights written to {args.out}")
    print("Remember to record the dataset provenance (SSS source vs. any FLS pretraining) in the ModelVersion.trained_on field.")


if __name__ == "__main__":
    main()
