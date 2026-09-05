"""Evaluation report generation for the Analytics page.

Real precision/recall/mAP and cross-domain numbers must come from running
`scripts/evaluate_detector.py` / `scripts/cross_domain_eval.py` against an actual held-out SSS
validation set (Ultralytics `model.val()` under the hood) - there is no such labeled dataset
available in this environment. Until that has been run at least once and its output stored on a
`ModelVersion.metrics_json` row, these functions return clearly-labeled illustrative numbers
(`"source": "illustrative_demo"`) so the Analytics dashboard has something honest to render in the
meantime, rather than either crashing or silently pretending a real evaluation happened.
"""
from app.ml.calibration import compute_validation_ece_report

ILLUSTRATIVE_PERFORMANCE = {
    "source": "illustrative_demo",
    "note": "Run scripts/evaluate_detector.py against a real held-out SSS validation set to replace these numbers.",
    "precision": 0.81,
    "recall": 0.76,
    "map50": 0.78,
    "map50_95": 0.52,
    "false_positive_rate": 0.11,
    "per_class": {
        "ghost_net": {"precision": 0.74, "recall": 0.69, "map50": 0.71},
        "pipe": {"precision": 0.85, "recall": 0.80, "map50": 0.83},
        "cylinder": {"precision": 0.88, "recall": 0.82, "map50": 0.86},
        "container": {"precision": 0.90, "recall": 0.85, "map50": 0.89},
        "vessel_wreckage": {"precision": 0.79, "recall": 0.73, "map50": 0.76},
        "anchor_chain": {"precision": 0.70, "recall": 0.65, "map50": 0.68},
        "rock_outcrop": {"precision": 0.83, "recall": 0.79, "map50": 0.81},
        "sediment_ripple": {"precision": 0.77, "recall": 0.74, "map50": 0.75},
        "debris_unknown": {"precision": 0.66, "recall": 0.60, "map50": 0.63},
    },
}

ILLUSTRATIVE_CROSS_DOMAIN = {
    "source": "illustrative_demo",
    "note": (
        "Run scripts/cross_domain_eval.py (train on one sonar/site source, test on a held-out "
        "different source) to replace these numbers. FLS data is never used as SSS ground truth "
        "here - only for optional pretraining/transfer-learning, tracked separately."
    ),
    "rows": [
        {
            "train_domain": "SeabedObjects-KLSG-style (Klein 3000, site A)",
            "test_domain": "AI4Shipwrecks-style (EdgeTech 4205, site B)",
            "map50_in_domain": 0.78,
            "map50_cross_domain": 0.58,
            "accuracy_drop_pct": 25.6,
            "note": "Different sonar frequency/beam geometry drives most of the drop.",
        },
        {
            "train_domain": "SeabedObjects-KLSG-style (Klein 3000, site A)",
            "test_domain": "Synthetic SSS augmentation (rare classes only)",
            "map50_in_domain": 0.78,
            "map50_cross_domain": 0.69,
            "accuracy_drop_pct": 11.5,
            "note": "Synthetic data narrows the gap for rare classes (ghost nets, pipes) but doesn't close it.",
        },
    ],
}


def get_performance_metrics(model_version: "ModelVersion | None" = None) -> dict:
    if model_version and model_version.metrics_json.get("performance"):
        return model_version.metrics_json["performance"]
    return ILLUSTRATIVE_PERFORMANCE


def get_cross_domain_report(model_version: "ModelVersion | None" = None) -> dict:
    if model_version and model_version.metrics_json.get("cross_domain"):
        return model_version.metrics_json["cross_domain"]
    return ILLUSTRATIVE_CROSS_DOMAIN


def get_calibration_report() -> dict:
    return compute_validation_ece_report()
