"""Crop classification stage - a REAL model trained on user-supplied side-scan sonar imagery
(see scripts/prepare_classification_dataset.py + scripts/train_classifier.py), not a synthetic
bootstrap like the discriminator/calibrator fall back to when no real data is available.

What this model does and does not do, stated plainly: it was trained on 499 single-object crops
across 5 classes with NO bounding-box ground truth, so it answers "what is this candidate region"
(a classification task) - it was not trained to answer "where in the image is something" (a
detection task). Localization (proposing candidate bounding boxes) still comes from the classical
CV blob detector in app/ml/detector.py; this stage re-classifies each proposed crop with a real
trained model, replacing the detector's heuristic class guess, and drops candidates the model
recognizes as plain seabed texture (no object) rather than reporting them as debris.
"""
import os

import numpy as np

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.types import BBox

logger = get_logger(__name__)

CLASSIFIER_WEIGHTS_PATH = os.path.join(settings.ML_ARTIFACTS_DIR, "ocean_eye_cls.pt")
MODEL_NAME = "oceaneye-crop-classifier"

# Classes the real classifier was trained on. "seabed_surface" is a background/no-object class:
# when it's the top prediction, the candidate is dropped rather than reported as a detection.
ARTIFICIAL_CLASSES = {"engineering_platform", "pipeline_or_cable", "plane_real"}
NATURAL_CLASSES = {"underwater_residual_mound"}
BACKGROUND_CLASSES = {"seabed_surface"}


class CropClassifier:
    def __init__(self, weights_path: str):
        from ultralytics import YOLO

        self._model = YOLO(weights_path)
        self.version = os.path.basename(weights_path)

    def classify(self, image: np.ndarray, bbox: BBox) -> tuple[str, float] | None:
        """Returns (class_label, confidence), or None if the model thinks this crop is just
        background (no object) and the candidate should be dropped entirely."""
        h_img, w_img = image.shape[:2]
        x0, y0 = max(0, bbox.x), max(0, bbox.y)
        x1, y1 = min(w_img, bbox.x + bbox.w), min(h_img, bbox.y + bbox.h)
        crop = image[y0:y1, x0:x1]
        if crop.size == 0:
            return None

        result = self._model.predict(source=crop, verbose=False)[0]
        label = result.names[int(result.probs.top1)]
        confidence = float(result.probs.top1conf)

        if label in BACKGROUND_CLASSES:
            return None
        return label, confidence


_classifier_instance: CropClassifier | None = None
_load_attempted = False


def get_classifier() -> CropClassifier | None:
    """Returns the trained classifier if weights are present, else None (caller falls back to
    the detector's heuristic class guess - same graceful-degradation pattern as the rest of the
    ML pipeline)."""
    global _classifier_instance, _load_attempted
    if _load_attempted:
        return _classifier_instance
    _load_attempted = True

    if not os.path.exists(CLASSIFIER_WEIGHTS_PATH):
        logger.info("crop_classifier_not_found", path=CLASSIFIER_WEIGHTS_PATH)
        return None
    try:
        _classifier_instance = CropClassifier(CLASSIFIER_WEIGHTS_PATH)
        logger.info("crop_classifier_loaded", path=CLASSIFIER_WEIGHTS_PATH)
    except Exception as exc:  # noqa: BLE001
        logger.warning("crop_classifier_load_failed", error=str(exc))
        _classifier_instance = None
    return _classifier_instance
