"""Cross-domain evaluation: train on one sonar/site data source, test on a held-out *different*
sonar/site data source, and report the accuracy/mAP drop explicitly - this is a hard project
requirement (PS 26057), not an optional nicety, since a model that only works on its training
sonar/site is not deployable across NIOT survey vessels.

Requires two labeled SSS validation splits from genuinely different sources (different sonar
device and/or survey site) plus a checkpoint trained on only one of them. Neither is available in
this environment; this script is provided for the real evaluation pipeline.

Usage:
    python -m scripts.cross_domain_eval --weights ml_artifacts/yolov8n_sss.pt \
        --in-domain-data /path/to/site_a_val.yaml --cross-domain-data /path/to/site_b_val.yaml \
        --train-domain "Klein 3000, site A" --test-domain "EdgeTech 4205, site B" \
        --model-name yolov8n-sss --model-version v0.1.0
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--weights", required=True)
    parser.add_argument("--in-domain-data", required=True)
    parser.add_argument("--cross-domain-data", required=True)
    parser.add_argument("--train-domain", required=True)
    parser.add_argument("--test-domain", required=True)
    parser.add_argument("--model-name", default="yolov8n-sss")
    parser.add_argument("--model-version", required=True)
    parser.add_argument("--note", default=None)
    args = parser.parse_args()

    from ultralytics import YOLO

    from app.db.session import SessionLocal
    from app.models.model_version import ModelVersion

    model = YOLO(args.weights)
    in_domain = model.val(data=args.in_domain_data)
    cross_domain = model.val(data=args.cross_domain_data)

    map50_in = float(in_domain.box.map50)
    map50_cross = float(cross_domain.box.map50)
    drop_pct = round((map50_in - map50_cross) / map50_in * 100, 2) if map50_in else 0.0

    row = {
        "train_domain": args.train_domain,
        "test_domain": args.test_domain,
        "map50_in_domain": map50_in,
        "map50_cross_domain": map50_cross,
        "accuracy_drop_pct": drop_pct,
        "note": args.note,
    }

    db = SessionLocal()
    try:
        mv = (
            db.query(ModelVersion)
            .filter(ModelVersion.name == args.model_name, ModelVersion.version == args.model_version)
            .first()
        )
        if mv is None:
            print(f"No ModelVersion row found for {args.model_name}=={args.model_version}; create it first.")
            return
        existing = mv.metrics_json.get("cross_domain", {"source": "measured", "rows": []})
        existing["source"] = "measured"
        existing["rows"] = [*existing.get("rows", []), row]
        mv.metrics_json = {**mv.metrics_json, "cross_domain": existing}
        db.commit()
        print(f"Cross-domain mAP@0.5 drop: {drop_pct}% ({map50_in} -> {map50_cross}). Stored on ModelVersion.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
