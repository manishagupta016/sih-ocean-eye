"""Preprocessing stage: denoise + contrast-stretch the raw sonar waterfall image before detection.

Exposed separately from the detector so the Upload page can render an honest before/after preview
without running full inference.
"""
import cv2
import numpy as np


def preprocess(image: np.ndarray) -> np.ndarray:
    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=8, templateWindowSize=7, searchWindowSize=21)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    contrast_stretched = clahe.apply(denoised)
    return contrast_stretched


def encode_png(image: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", image)
    if not ok:
        raise ValueError("failed to encode image as PNG")
    return buf.tobytes()
