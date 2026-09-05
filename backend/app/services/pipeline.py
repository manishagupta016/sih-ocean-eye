"""Orchestrates the full detect -> discriminate -> calibrate -> score -> geolocate pipeline for
one uploaded sonar file, and persists results to Postgres.

Runs inside a FastAPI BackgroundTask (see app/routers/uploads.py). Deliberately written as a
plain function operating on primitive args (no request/session state captured in closures) so it
can be lifted into a Celery task or a standalone worker process later with minimal changes - the
only shared-infrastructure touchpoints are the DB session factory and the Redis-backed job status
store, both already decoupled from the web-request lifecycle.
"""
import os
import time
import uuid

import cv2

from app.core.logging import get_logger
from app.db.redis_client import set_job_status
from app.db.session import SessionLocal
from app.ml.calibration import calibrate
from app.ml.detector import get_detector
from app.ml.discriminator import discriminate
from app.ml.geolocation import attach_geolocation, parse_nav_log
from app.ml.risk_scoring import score_detection
from app.ml.types import CalibratedDetection, PipelineContext
from app.models.alert import Alert, AlertSeverity
from app.models.detection import Detection
from app.models.model_version import ModelVersion
from app.models.risk_score import RiskScore
from app.models.sonar_file import IngestStatus, SonarFile
from app.services.metrics_store import record_latency

logger = get_logger(__name__)

TIER_TO_ALERT_SEVERITY = {
    "probable_debris": AlertSeverity.medium,
    "high_confidence_hazard": AlertSeverity.critical,
}


def _get_or_create_model_version(db, name: str, version: str, trained_on: str) -> ModelVersion:
    existing = (
        db.query(ModelVersion).filter(ModelVersion.name == name, ModelVersion.version == version).first()
    )
    if existing:
        return existing
    mv = ModelVersion(name=name, version=version, trained_on=trained_on, metrics_json={})
    db.add(mv)
    db.flush()
    return mv


def run_detection_pipeline(sonar_file_id: uuid.UUID, job_id: str) -> None:
    db = SessionLocal()
    t_start = time.perf_counter()
    try:
        sonar_file: SonarFile | None = db.get(SonarFile, sonar_file_id)
        if sonar_file is None:
            logger.error("pipeline_sonar_file_missing", sonar_file_id=str(sonar_file_id))
            return

        survey = sonar_file.survey

        def update_status(status: IngestStatus, pct: int, message: str = ""):
            sonar_file.status = status
            sonar_file.status_message = message
            db.commit()
            set_job_status(
                job_id,
                {
                    "job_id": job_id,
                    "sonar_file_id": str(sonar_file_id),
                    "status": status.value,
                    "progress_pct": pct,
                    "message": message,
                },
            )

        update_status(IngestStatus.preprocessing, 10, "Loading and preprocessing image")
        image = cv2.imread(sonar_file.file_path, cv2.IMREAD_GRAYSCALE)
        if image is None:
            update_status(IngestStatus.failed, 100, "Could not read image file")
            return

        nav_sidecar_path = sonar_file.file_path + ".nav.json"
        nav_track = parse_nav_log(nav_sidecar_path)
        sonar_file.has_nav_metadata = len(nav_track) > 0

        ctx = PipelineContext(
            sonar_device_id=survey.sonar_format,
            site_name=survey.location_name,
            image_width=image.shape[1],
            image_height=image.shape[0],
            nav_track=nav_track,
        )

        update_status(IngestStatus.detecting, 30, "Running detection")
        t0 = time.perf_counter()
        detector = get_detector()
        detector_result = detector.detect(image)
        record_latency("detection", (time.perf_counter() - t0) * 1000)

        detector_mv = _get_or_create_model_version(
            db,
            detector.model_name,
            detector_result.model_version,
            trained_on=(
                "SeabedObjects-KLSG-style + synthetic SSS augmentation. "
                "FLS datasets used for pretraining/transfer-learning only, never as SSS ground truth."
                if detector.model_name == "yolov8n-sss"
                else "No fine-tuned SSS weights present - classical CV blob detector fallback (demo mode)."
            ),
        )
        sonar_file.model_version_id = detector_mv.id

        update_status(IngestStatus.discriminating, 50, "Scoring natural vs. artificial")
        t0 = time.perf_counter()
        discriminated = discriminate(image, detector_result.detections)
        record_latency("discrimination", (time.perf_counter() - t0) * 1000)

        update_status(IngestStatus.calibrating, 65, "Calibrating confidence")
        t0 = time.perf_counter()
        calibrated: list[CalibratedDetection] = []
        for d in discriminated:
            calibrated.append(
                CalibratedDetection(
                    bbox=d.bbox,
                    class_label=d.class_label,
                    raw_confidence=d.raw_confidence,
                    is_artificial=d.is_artificial,
                    artificial_score=d.artificial_score,
                    shape_regularity=d.shape_regularity,
                    shadow_length_px=d.shadow_length_px,
                    texture_variance=d.texture_variance,
                    calibrated_confidence=calibrate(d.raw_confidence),
                )
            )
        record_latency("calibration", (time.perf_counter() - t0) * 1000)

        update_status(IngestStatus.scoring, 80, "Computing risk scores")
        t0 = time.perf_counter()
        scored = [score_detection(d, ctx) for d in calibrated]
        record_latency("risk_scoring", (time.perf_counter() - t0) * 1000)

        update_status(IngestStatus.geolocating, 90, "Attaching geolocation")
        t0 = time.perf_counter()
        geolocated = [attach_geolocation(d, ctx) for d in scored]
        record_latency("geolocation", (time.perf_counter() - t0) * 1000)

        for det in geolocated:
            geom_wkt = None
            if det.has_geo_metadata and det.latitude is not None and det.longitude is not None:
                geom_wkt = f"SRID=4326;POINT({det.longitude} {det.latitude})"

            detection_row = Detection(
                sonar_file_id=sonar_file.id,
                bbox=det.bbox.as_dict(),
                class_label=det.class_label,
                raw_confidence=det.raw_confidence,
                calibrated_confidence=det.calibrated_confidence,
                is_artificial=det.is_artificial,
                artificial_score=det.artificial_score,
                geom=geom_wkt,
                has_geo_metadata=det.has_geo_metadata,
                latitude=det.latitude,
                longitude=det.longitude,
            )
            db.add(detection_row)
            db.flush()

            db.add(
                RiskScore(
                    detection_id=detection_row.id,
                    size_estimate=det.size_estimate_m2,
                    domain_shift_penalty=det.domain_shift_penalty,
                    ecological_flag=det.ecological_flag,
                    risk_tier=det.risk_tier,
                    computed_score=det.computed_score,
                )
            )

            severity = TIER_TO_ALERT_SEVERITY.get(det.risk_tier)
            if severity:
                geo_note = (
                    f"at {det.latitude:.5f}, {det.longitude:.5f}"
                    if det.has_geo_metadata
                    else "image-space only (no nav metadata)"
                )
                db.add(
                    Alert(
                        detection_id=detection_row.id,
                        severity=severity,
                        message=(
                            f"{det.class_label.replace('_', ' ').title()} detected "
                            f"({det.risk_tier.replace('_', ' ')}), {geo_note}"
                        ),
                    )
                )

        update_status(IngestStatus.done, 100, f"Completed - {len(geolocated)} detections")
        db.commit()
        record_latency("end_to_end", (time.perf_counter() - t_start) * 1000)
        logger.info(
            "pipeline_complete",
            sonar_file_id=str(sonar_file_id),
            detection_count=len(geolocated),
            detector=detector.model_name,
            latency_ms=round((time.perf_counter() - t_start) * 1000, 1),
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.error("pipeline_failed", sonar_file_id=str(sonar_file_id), error=str(exc))
        sf = db.get(SonarFile, sonar_file_id)
        if sf:
            sf.status = IngestStatus.failed
            sf.status_message = str(exc)
            db.commit()
        set_job_status(
            job_id,
            {
                "job_id": job_id,
                "sonar_file_id": str(sonar_file_id),
                "status": IngestStatus.failed.value,
                "progress_pct": 100,
                "message": str(exc),
            },
        )
    finally:
        db.close()
