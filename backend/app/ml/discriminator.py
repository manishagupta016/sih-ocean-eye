"""Discrimination stage: natural vs. artificial classification.

This is intentionally a *separate* pipeline step from detection, per the project spec, so it can
be evaluated/ablated on its own. It does not use the detector's class label at all - it re-derives
an artificial-object probability purely from three explainable, hand-engineered features computed
on the candidate's image crop:

  1. shape_regularity  - circularity/rectilinearity of the candidate's silhouette. Man-made
                          objects (pipes, drums, containers) tend to be regular; rocks/sediment
                          are irregular.
  2. shadow_length_norm - normalized length of the acoustic shadow cast by the object. Sharp,
                          long, well-defined shadows are typical of raised, rigid artificial
                          structures; natural seabed features usually cast short/diffuse shadows.
  3. texture_variance   - local backscatter texture roughness inside the candidate region. Smooth
                          man-made surfaces have low variance; natural clutter/sediment has high
                          variance.

The classifier itself is a small GradientBoostingClassifier (scikit-learn) so its decision
boundary stays inspectable (feature importances) for a non-technical audience, per the
"explainable" requirement. No public SSS discrimination-labeled dataset ships in this
environment, so on first run we bootstrap the classifier on a synthetic feature distribution that
encodes the domain knowledge above, and persist it to disk; swap in a real labeled dataset by
retraining via `train_discriminator()` and this module picks up the saved weights transparently.
"""
import os

import cv2
import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.types import BBox, DiscriminatedDetection, RawDetection

logger = get_logger(__name__)

FEATURE_NAMES = ["shape_regularity", "shadow_length_norm", "texture_variance_norm"]


def extract_features(image: np.ndarray, bbox: BBox) -> tuple[float, float, float]:
    """Computes the three discrimination features for one candidate bbox on the full image."""
    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h_img, w_img = gray.shape[:2]

    x0, y0 = max(0, bbox.x), max(0, bbox.y)
    x1, y1 = min(w_img, bbox.x + bbox.w), min(h_img, bbox.y + bbox.h)
    crop = gray[y0:y1, x0:x1]
    if crop.size == 0:
        return 0.0, 0.0, 0.0

    # 1. shape regularity via largest contour circularity (1.0 = perfect circle/regular blob)
    _, thresh = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        perimeter = cv2.arcLength(largest, True) or 1.0
        shape_regularity = float(np.clip(4 * np.pi * area / (perimeter**2), 0.0, 1.0))
    else:
        shape_regularity = 0.0

    # 2. shadow length: scan the strip directly "below" the bbox (down-range) for a contiguous
    # run of pixels darker than the local background - a proxy for acoustic shadow length.
    shadow_strip_h = max(4, bbox.h)
    sy0 = y1
    sy1 = min(h_img, y1 + shadow_strip_h)
    shadow_len_px = 0
    if sy1 > sy0:
        strip = gray[sy0:sy1, x0:x1]
        local_bg = float(gray[max(0, y0 - shadow_strip_h) : y0, x0:x1].mean()) if y0 > 0 else float(gray.mean())
        dark_mask = strip.mean(axis=1) < (local_bg * 0.6)
        run = 0
        best_run = 0
        for is_dark in dark_mask:
            run = run + 1 if is_dark else 0
            best_run = max(best_run, run)
        shadow_len_px = best_run
    shadow_length_norm = float(np.clip(shadow_len_px / max(1, bbox.h * 2), 0.0, 1.0))

    # 3. texture variance inside the candidate region, normalized to a 0..1-ish range
    texture_variance_norm = float(np.clip(float(np.std(crop)) / 80.0, 0.0, 1.0))

    return shape_regularity, shadow_length_norm, texture_variance_norm


def _bootstrap_training_data(n_per_class: int = 1500, seed: int = 42):
    rng = np.random.default_rng(seed)

    # Artificial: regular shape, long/sharp shadow, smooth (low) texture variance
    artificial = np.column_stack(
        [
            np.clip(rng.normal(0.75, 0.12, n_per_class), 0, 1),
            np.clip(rng.normal(0.65, 0.15, n_per_class), 0, 1),
            np.clip(rng.normal(0.25, 0.12, n_per_class), 0, 1),
        ]
    )
    # Natural: irregular shape, short/diffuse shadow, rough (high) texture variance
    natural = np.column_stack(
        [
            np.clip(rng.normal(0.35, 0.15, n_per_class), 0, 1),
            np.clip(rng.normal(0.25, 0.15, n_per_class), 0, 1),
            np.clip(rng.normal(0.65, 0.15, n_per_class), 0, 1),
        ]
    )
    X = np.vstack([artificial, natural])
    y = np.concatenate([np.ones(n_per_class), np.zeros(n_per_class)])
    return X, y


def train_discriminator(save_path: str | None = None) -> GradientBoostingClassifier:
    """Trains (or retrains) the discrimination classifier and persists it to disk."""
    X, y = _bootstrap_training_data()
    clf = GradientBoostingClassifier(n_estimators=150, max_depth=3, learning_rate=0.08, random_state=42)
    clf.fit(X, y)

    path = save_path or settings.DISCRIMINATOR_WEIGHTS_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    joblib.dump(clf, path)
    logger.info(
        "discriminator_trained",
        path=path,
        feature_importances=dict(zip(FEATURE_NAMES, clf.feature_importances_.round(3).tolist())),
        note="bootstrapped on synthetic shape/shadow/texture priors - replace with a labeled SSS dataset for production",
    )
    return clf


_discriminator: GradientBoostingClassifier | None = None


def get_discriminator() -> GradientBoostingClassifier:
    global _discriminator
    if _discriminator is not None:
        return _discriminator

    path = settings.DISCRIMINATOR_WEIGHTS_PATH
    if os.path.exists(path):
        _discriminator = joblib.load(path)
    else:
        _discriminator = train_discriminator(path)
    return _discriminator


def discriminate(image: np.ndarray, detections: list[RawDetection]) -> list[DiscriminatedDetection]:
    clf = get_discriminator()
    out: list[DiscriminatedDetection] = []
    for det in detections:
        shape_reg, shadow_len, tex_var = extract_features(image, det.bbox)
        proba = float(clf.predict_proba(np.array([[shape_reg, shadow_len, tex_var]]))[0, 1])
        out.append(
            DiscriminatedDetection(
                bbox=det.bbox,
                class_label=det.class_label,
                raw_confidence=det.raw_confidence,
                is_artificial=proba >= 0.5,
                artificial_score=round(proba, 4),
                shape_regularity=round(shape_reg, 4),
                shadow_length_px=shadow_len,
                texture_variance=tex_var,
            )
        )
    return out
