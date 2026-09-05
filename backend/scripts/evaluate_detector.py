"""Computes precision/recall/mAP@0.5/mAP@0.5:0.95/false-positive-rate for a fine-tuned SSS
detector against a held-out SSS validation split, and writes the result into the matching
`ModelVersion.metrics_json['performance']` row so the Analytics page picks it up automatically
(see app/ml/evaluation.py::get_performance_metrics, which prefers a stored value over the
illustrative fallback numbers).

Requires a trained checkpoint (see scripts/train_yolo.py) and a labeled validation set - neither
is available in this environment, so this script is provided for the real training pipeline to
run, not executed here.

Usage:
    python -m scripts.evaluate_detector --weights ml_artifacts/yolov8n_sss.pt \
        --data /path/to/sss_data.yaml --model-name yolov8n-sss --model-version v0.1.0
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--weights", required=True)
    parser.add_argument("--data", required=True, help="Ultralytics data.yaml with a held-out 'val' split")
    parser.add_argument("--model-name", default="yolov8n-sss")
    parser.add_argument("--model-version", required=True)
    parser.add_argument("--conf-for-fpr", type=float, default=0.25, help="Confidence threshold at which to report false-positive rate")
    args = parser.parse_args()

    from ultralytics import YOLO

    from app.db.session import SessionLocal
    from app.models.model_version import ModelVersion

    model = YOLO(args.weights)
    metrics = model.val(data=args.data, conf=args.conf_for_fpr)

    per_class = {}
    names = metrics.names
    for i, name in names.items():
        per_class[name] = {
            "precision": float(metrics.box.p[i]) if i < len(metrics.box.p) else None,
            "recall": float(metrics.box.r[i]) if i < len(metrics.box.r) else None,
            "map50": float(metrics.box.ap50[i]) if i < len(metrics.box.ap50) else None,
        }

    false_positive_rate = 1.0 - float(metrics.box.p.mean()) if len(metrics.box.p) else None

    performance = {
        "source": "measured",
        "precision": float(metrics.box.p.mean()),
        "recall": float(metrics.box.r.mean()),
        "map50": float(metrics.box.map50),
        "map50_95": float(metrics.box.map),
        "false_positive_rate": false_positive_rate,
        "per_class": per_class,
    }

    db = SessionLocal()
    try:
        mv = (
            db.query(ModelVersion)
            .filter(ModelVersion.name == args.model_name, ModelVersion.version == args.model_version)
            .first()
        )
        if mv is None:
            print(f"No ModelVersion row found for {args.model_name}=={args.model_version}; create it first (see scripts/seed_demo_data.py for the shape).")
            return
        mv.metrics_json = {**mv.metrics_json, "performance": performance}
        db.commit()
        print(f"Stored measured performance metrics on ModelVersion {args.model_name}=={args.model_version}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
