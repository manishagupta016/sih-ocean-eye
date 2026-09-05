"""Seeds a demo admin user, an operator user, model version rows, and one sample survey with
synthetic-but-pipeline-shaped detections/risk-scores/alerts, so the dashboard/map/analytics pages
have something to render on a fresh `docker-compose up`.

Run with:  python -m scripts.seed_demo_data
"""
import random
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.ml.evaluation import ILLUSTRATIVE_CROSS_DOMAIN, ILLUSTRATIVE_PERFORMANCE
from app.models.alert import Alert, AlertSeverity
from app.models.detection import Detection
from app.models.model_version import ModelVersion
from app.models.risk_score import RiskScore, RiskTier
from app.models.sonar_file import IngestStatus, SonarFile, SonarFileType
from app.models.survey import Survey
from app.models.user import User, UserRole

DEMO_CLASSES = ["ghost_net", "pipe", "cylinder", "container", "vessel_wreckage", "rock_outcrop", "debris_unknown"]


def main():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@sonarintel.demo").first()
        if not admin:
            admin = User(
                name="Demo Admin",
                email="admin@sonarintel.demo",
                password_hash=hash_password("ChangeMe123!"),
                role=UserRole.admin,
            )
            db.add(admin)

        operator = db.query(User).filter(User.email == "operator@sonarintel.demo").first()
        if not operator:
            operator = User(
                name="Demo Operator",
                email="operator@sonarintel.demo",
                password_hash=hash_password("ChangeMe123!"),
                role=UserRole.operator,
            )
            db.add(operator)
        db.flush()

        mock_mv = db.query(ModelVersion).filter(ModelVersion.name == "mock-cv-blob-detector").first()
        if not mock_mv:
            mock_mv = ModelVersion(
                name="mock-cv-blob-detector",
                version="heuristic-1",
                trained_on="No fine-tuned SSS weights present - classical CV blob detector fallback (demo mode).",
                metrics_json={},
            )
            db.add(mock_mv)

        yolo_mv = db.query(ModelVersion).filter(ModelVersion.name == "yolov8n-sss").first()
        if not yolo_mv:
            yolo_mv = ModelVersion(
                name="yolov8n-sss",
                version="v0.1.0-demo",
                trained_on=(
                    "SeabedObjects-KLSG-style + synthetic SSS augmentation. FLS datasets used for "
                    "pretraining/transfer-learning only, never as SSS ground truth."
                ),
                metrics_json={"performance": ILLUSTRATIVE_PERFORMANCE, "cross_domain": ILLUSTRATIVE_CROSS_DOMAIN},
            )
            db.add(yolo_mv)
        db.flush()

        survey = db.query(Survey).filter(Survey.name == "Gulf of Mannar Demo Survey").first()
        if not survey:
            survey = Survey(
                user_id=operator.id,
                name="Gulf of Mannar Demo Survey",
                location_name="seabedobjects-klsg",
                sonar_format="klein-3000",
                notes="Seed data for local demo - not a real survey.",
            )
            db.add(survey)
            db.flush()

            sonar_file = SonarFile(
                survey_id=survey.id,
                file_path="uploads/demo_seed_line_01.png",
                file_type=SonarFileType.image,
                status=IngestStatus.done,
                status_message="Completed - seeded demo data",
                has_nav_metadata=False,
                model_version_id=mock_mv.id,
            )
            db.add(sonar_file)
            db.flush()

            rng = random.Random(42)
            for i in range(14):
                raw_conf = round(rng.uniform(0.3, 0.95), 3)
                calibrated_conf = round(max(0.05, raw_conf - rng.uniform(0.05, 0.2)), 3)
                artificial_score = round(rng.uniform(0.1, 0.95), 3)
                class_label = rng.choice(DEMO_CLASSES)
                is_artificial = artificial_score >= 0.5
                size_estimate = round(rng.uniform(0.5, 18.0), 2)
                domain_shift_penalty = 0.0  # matches training device/site in seed data

                computed_score = round(
                    min(1.0, 0.40 * calibrated_conf + 0.30 * artificial_score + 0.15 * min(1.0, size_estimate / 25) + 0.15 * (1 - domain_shift_penalty)),
                    4,
                )
                if computed_score >= 0.75:
                    tier = RiskTier.high_confidence_hazard
                elif computed_score >= 0.50:
                    tier = RiskTier.probable_debris
                elif computed_score >= 0.25:
                    tier = RiskTier.human_review
                else:
                    tier = RiskTier.ignore
                ecological_flag = class_label in ("ghost_net", "anchor_chain")
                if ecological_flag and tier == RiskTier.ignore:
                    tier = RiskTier.human_review

                has_geo = i % 3 != 0  # a third stay "image-space only" to exercise that UI state
                lat = 9.05 + rng.uniform(-0.02, 0.02) if has_geo else None
                lon = 79.15 + rng.uniform(-0.02, 0.02) if has_geo else None

                detection = Detection(
                    sonar_file_id=sonar_file.id,
                    bbox={"x": rng.randint(0, 800), "y": rng.randint(0, 400), "w": rng.randint(20, 120), "h": rng.randint(20, 120)},
                    class_label=class_label,
                    raw_confidence=raw_conf,
                    calibrated_confidence=calibrated_conf,
                    is_artificial=is_artificial,
                    artificial_score=artificial_score,
                    geom=f"SRID=4326;POINT({lon} {lat})" if has_geo else None,
                    has_geo_metadata=has_geo,
                    latitude=lat,
                    longitude=lon,
                )
                db.add(detection)
                db.flush()

                db.add(
                    RiskScore(
                        detection_id=detection.id,
                        size_estimate=size_estimate,
                        domain_shift_penalty=domain_shift_penalty,
                        ecological_flag=ecological_flag,
                        risk_tier=tier,
                        computed_score=computed_score,
                    )
                )

                if tier in (RiskTier.probable_debris, RiskTier.high_confidence_hazard):
                    severity = AlertSeverity.critical if tier == RiskTier.high_confidence_hazard else AlertSeverity.medium
                    geo_note = f"at {lat:.5f}, {lon:.5f}" if has_geo else "image-space only (no nav metadata)"
                    db.add(
                        Alert(
                            detection_id=detection.id,
                            severity=severity,
                            message=f"{class_label.replace('_', ' ').title()} detected ({tier.value.replace('_', ' ')}), {geo_note}",
                        )
                    )

        db.commit()
        print("Seed complete.")
        print("  admin@sonarintel.demo / ChangeMe123!")
        print("  operator@sonarintel.demo / ChangeMe123!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
