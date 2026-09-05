"""Confidence calibration stage.

Raw YOLO/softmax-style confidences are notoriously overconfident, especially in the high range.
We fit an isotonic regression mapping raw_confidence -> calibrated probability of a true positive,
which is what actually gets shown to operators (never the raw score) throughout the frontend.

No labeled SSS validation set with (confidence, correct) pairs is available in this environment,
so the mapping is bootstrapped on a synthetic distribution that encodes the well-documented
overconfidence pattern of anchor-based detectors (accuracy < confidence above ~0.6, roughly
tracking confidence below that). Expected Calibration Error (ECE) is computed against a held-out
split of that same synthetic set and surfaced on the Analytics page, clearly labeled as a
bootstrap estimate - replace `train_calibrator()`'s data source with real validation logits before
using this for anything but a demo.
"""
import os

import joblib
import numpy as np
from sklearn.isotonic import IsotonicRegression

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _bootstrap_confidence_correctness(n: int = 4000, seed: int = 7) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    raw_confidence = rng.uniform(0.0, 1.0, n)
    # Ground-truth correctness probability rises slower than raw confidence above ~0.55
    # (classic overconfidence curve), with noise.
    true_accuracy = np.where(
        raw_confidence < 0.55,
        raw_confidence * 0.85,
        0.55 * 0.85 + (raw_confidence - 0.55) * 0.55,
    )
    true_accuracy = np.clip(true_accuracy + rng.normal(0, 0.04, n), 0, 1)
    correct = rng.binomial(1, true_accuracy)
    return raw_confidence, correct


def train_calibrator(save_path: str | None = None) -> IsotonicRegression:
    raw_confidence, correct = _bootstrap_confidence_correctness()
    model = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    model.fit(raw_confidence, correct)

    path = save_path or settings.CALIBRATOR_WEIGHTS_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    joblib.dump(model, path)
    logger.info(
        "calibrator_trained",
        path=path,
        note="bootstrapped on synthetic overconfidence distribution - replace with real validation logits for production",
    )
    return model


_calibrator: IsotonicRegression | None = None


def get_calibrator() -> IsotonicRegression:
    global _calibrator
    if _calibrator is not None:
        return _calibrator
    path = settings.CALIBRATOR_WEIGHTS_PATH
    if os.path.exists(path):
        _calibrator = joblib.load(path)
    else:
        _calibrator = train_calibrator(path)
    return _calibrator


def calibrate(raw_confidence: float) -> float:
    model = get_calibrator()
    return float(np.clip(model.predict([raw_confidence])[0], 0.0, 1.0))


def compute_ece(confidences: np.ndarray, corrects: np.ndarray, n_bins: int = 10):
    """Returns (ece: float, bins: list[dict]) - the standard binned |confidence - accuracy| estimator."""
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    bins = []
    ece = 0.0
    n = len(confidences)
    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        mask = (confidences >= lo) & (confidences < hi if i < n_bins - 1 else confidences <= hi)
        count = int(mask.sum())
        if count == 0:
            bins.append(
                {"bin_lower": float(lo), "bin_upper": float(hi), "confidence_mean": 0.0, "accuracy_mean": 0.0, "sample_count": 0}
            )
            continue
        conf_mean = float(confidences[mask].mean())
        acc_mean = float(corrects[mask].mean())
        bins.append(
            {"bin_lower": float(lo), "bin_upper": float(hi), "confidence_mean": conf_mean, "accuracy_mean": acc_mean, "sample_count": count}
        )
        ece += (count / n) * abs(conf_mean - acc_mean)
    return ece, bins


def compute_validation_ece_report(n_bins: int = 10):
    """Computes an ECE report against the same synthetic held-out distribution used for training,
    for both raw and calibrated confidences, so the Analytics page can show the before/after effect
    of calibration."""
    raw_confidence, correct = _bootstrap_confidence_correctness(n=2000, seed=99)  # different seed = held-out
    calibrator = get_calibrator()
    calibrated = np.clip(calibrator.predict(raw_confidence), 0.0, 1.0)

    raw_ece, raw_bins = compute_ece(raw_confidence, correct, n_bins)
    cal_ece, cal_bins = compute_ece(calibrated, correct, n_bins)
    return {
        "raw_ece": raw_ece,
        "calibrated_ece": cal_ece,
        "raw_bins": raw_bins,
        "calibrated_bins": cal_bins,
    }
