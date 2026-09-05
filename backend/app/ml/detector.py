"""Detection stage.

Wraps a YOLOv8 (Ultralytics) model fine-tuned on side-scan sonar (SSS) imagery. Forward-looking
sonar (FLS) datasets must never be used as SSS ground truth for this model - at most for
pretraining/transfer learning - and that provenance is recorded on the ModelVersion row
(`trained_on`) surfaced on the Analytics page, per the project's data-governance requirement.

No fine-tuned SSS weights ship with this prototype (no GPU/dataset access in this environment).
When `settings.YOLO_WEIGHTS_PATH` does not exist, we fall back to `MockSonarDetector`, a classical
computer-vision blob detector that runs adaptive thresholding + contour analysis on the *actual*
uploaded sonar image to produce real, image-grounded bounding boxes and heuristic class guesses -
not randomly fabricated results. Every response reports which detector produced it
(`model_version`) so the frontend/analytics page can show the provenance honestly.
"""
import os
import time
from dataclasses import dataclass

import cv2
import numpy as np

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.types import BBox, RawDetection

logger = get_logger(__name__)

CLASS_LABELS = [
    "ghost_net",
    "pipe",
    "cylinder",
    "container",
    "vessel_wreckage",
    "anchor_chain",
    "rock_outcrop",
    "sediment_ripple",
    "debris_unknown",
]

# Rough prior on which classes are man-made vs seabed/geological - used only by the mock
# detector's heuristic label guess. The real discrimination stage (app/ml/discriminator.py) does
# NOT use this table; it re-derives natural-vs-artificial from shape/shadow/texture features.
ARTIFICIAL_PRIOR_CLASSES = {
    "ghost_net", "pipe", "cylinder", "container", "vessel_wreckage", "anchor_chain",
}


@dataclass
class DetectorResult:
    detections: list[RawDetection]
    model_name: str
    model_version: str
    inference_latency_ms: float


class BaseDetector:
    model_name = "base"
    model_version = "0"

    def detect(self, image: np.ndarray) -> DetectorResult:
        raise NotImplementedError


class Yolov8SonarDetector(BaseDetector):
    """Real detector path - loads Ultralytics YOLOv8 weights fine-tuned on SSS imagery."""

    model_name = "yolov8n-sss"

    def __init__(self, weights_path: str):
        from ultralytics import YOLO  # imported lazily - heavy optional dependency

        self._model = YOLO(weights_path)
        self.model_version = os.path.basename(weights_path)

    def detect(self, image: np.ndarray) -> DetectorResult:
        t0 = time.perf_counter()
        results = self._model.predict(
            source=image, conf=settings.DETECTION_CONFIDENCE_THRESHOLD, verbose=False
        )
        latency_ms = (time.perf_counter() - t0) * 1000

        detections: list[RawDetection] = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = result.names.get(cls_id, f"class_{cls_id}")
                detections.append(
                    RawDetection(
                        bbox=BBox(x=int(x1), y=int(y1), w=int(x2 - x1), h=int(y2 - y1)),
                        class_label=label,
                        raw_confidence=conf,
                    )
                )
        return DetectorResult(
            detections=detections,
            model_name=self.model_name,
            model_version=self.model_version,
            inference_latency_ms=latency_ms,
        )


class MockSonarDetector(BaseDetector):
    """Classical-CV fallback: adaptive threshold + contour analysis on the real input image.

    Produces bounding boxes grounded in actual bright-return / shadow blobs in the sonar image
    (not randomly generated), so demos still look and behave like a real detector end-to-end.
    Confidence is derived deterministically from contrast and size so scores are stable across
    reruns of the same image (this is a heuristic score, not a learned one).
    """

    model_name = "mock-cv-blob-detector"
    model_version = "heuristic-1"

    MIN_AREA_PX = 120
    MAX_DETECTIONS = 12

    def detect(self, image: np.ndarray) -> DetectorResult:
        t0 = time.perf_counter()
        gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 25, -5
        )
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []
        h_img, w_img = gray.shape[:2]
        bg_mean = float(gray.mean())
        for c in contours:
            area = cv2.contourArea(c)
            if area < self.MIN_AREA_PX:
                continue
            x, y, w, h = cv2.boundingRect(c)
            if w >= w_img * 0.9 and h >= h_img * 0.9:
                continue  # skip whole-frame contour artifacts
            roi = gray[y : y + h, x : x + w]
            local_contrast = abs(float(roi.mean()) - bg_mean) / (bg_mean + 1e-6)
            perimeter = cv2.arcLength(c, True) or 1.0
            circularity = 4 * np.pi * area / (perimeter**2)
            confidence = float(np.clip(0.35 + 0.4 * local_contrast + 0.25 * (area / (w_img * h_img) * 40), 0.05, 0.97))
            candidates.append((area, x, y, w, h, circularity, confidence))

        candidates.sort(key=lambda t: t[0], reverse=True)
        candidates = candidates[: self.MAX_DETECTIONS]

        detections: list[RawDetection] = []
        for area, x, y, w, h, circularity, confidence in candidates:
            elongation = max(w, h) / max(1, min(w, h))
            if circularity > 0.7:
                label = "cylinder" if elongation < 2 else "pipe"
            elif elongation > 3.5:
                label = "anchor_chain"
            elif area > (w_img * h_img) * 0.01:
                label = "vessel_wreckage" if confidence > 0.6 else "rock_outcrop"
            else:
                label = "debris_unknown" if confidence > 0.5 else "sediment_ripple"

            detections.append(
                RawDetection(
                    bbox=BBox(x=int(x), y=int(y), w=int(w), h=int(h)),
                    class_label=label,
                    raw_confidence=round(confidence, 4),
                )
            )

        latency_ms = (time.perf_counter() - t0) * 1000
        return DetectorResult(
            detections=detections,
            model_name=self.model_name,
            model_version=self.model_version,
            inference_latency_ms=latency_ms,
        )


_detector_instance: BaseDetector | None = None


def get_detector() -> BaseDetector:
    global _detector_instance
    if _detector_instance is not None:
        return _detector_instance

    if os.path.exists(settings.YOLO_WEIGHTS_PATH):
        try:
            _detector_instance = Yolov8SonarDetector(settings.YOLO_WEIGHTS_PATH)
            logger.info("detector_loaded", detector="yolov8-sss", weights=settings.YOLO_WEIGHTS_PATH)
            return _detector_instance
        except Exception as exc:  # noqa: BLE001
            logger.warning("yolo_weights_load_failed_falling_back_to_mock", error=str(exc))

    logger.info(
        "detector_loaded",
        detector="mock-cv-blob-detector",
        reason="no fine-tuned SSS weights present at YOLO_WEIGHTS_PATH",
    )
    _detector_instance = MockSonarDetector()
    return _detector_instance
