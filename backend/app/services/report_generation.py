"""Generates downloadable CSV/JSON survey reports from persisted detections + risk scores."""
import csv
import json
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.detection import Detection
from app.models.report import Report, ReportFormat
from app.models.risk_score import RiskScore
from app.models.sonar_file import SonarFile


def _collect_rows(db: Session, survey_id: uuid.UUID) -> list[dict]:
    rows = (
        db.query(Detection, RiskScore, SonarFile)
        .join(SonarFile, Detection.sonar_file_id == SonarFile.id)
        .outerjoin(RiskScore, RiskScore.detection_id == Detection.id)
        .filter(SonarFile.survey_id == survey_id)
        .all()
    )
    out = []
    for detection, risk, sonar_file in rows:
        out.append(
            {
                "detection_id": str(detection.id),
                "sonar_file": os.path.basename(sonar_file.file_path),
                "class_label": detection.class_label,
                "calibrated_confidence": detection.calibrated_confidence,
                "raw_confidence": detection.raw_confidence,
                "is_artificial": detection.is_artificial,
                "artificial_score": detection.artificial_score,
                "risk_tier": risk.risk_tier.value if risk else None,
                "computed_risk_score": risk.computed_score if risk else None,
                "size_estimate_m2": risk.size_estimate if risk else None,
                "domain_shift_penalty": risk.domain_shift_penalty if risk else None,
                "ecological_flag": risk.ecological_flag if risk else None,
                "bbox": detection.bbox,
                "latitude": detection.latitude,
                "longitude": detection.longitude,
                "geolocation_status": "geolocated" if detection.has_geo_metadata else "image-space only",
                "detected_at": detection.created_at.isoformat(),
            }
        )
    return out


def generate_report(db: Session, survey_id: uuid.UUID, fmt: ReportFormat) -> Report:
    rows = _collect_rows(db, survey_id)
    os.makedirs(settings.REPORTS_DIR, exist_ok=True)

    report_id = uuid.uuid4()
    filename = f"survey_{survey_id}_{report_id}.{fmt.value}"
    file_path = os.path.join(settings.REPORTS_DIR, filename)

    if fmt == ReportFormat.json:
        with open(file_path, "w") as f:
            json.dump(
                {
                    "survey_id": str(survey_id),
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "detection_count": len(rows),
                    "detections": rows,
                },
                f,
                indent=2,
                default=str,
            )
    else:
        fieldnames = list(rows[0].keys()) if rows else [
            "detection_id", "sonar_file", "class_label", "calibrated_confidence", "raw_confidence",
            "is_artificial", "artificial_score", "risk_tier", "computed_risk_score",
            "size_estimate_m2", "domain_shift_penalty", "ecological_flag", "bbox",
            "latitude", "longitude", "geolocation_status", "detected_at",
        ]
        with open(file_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                writer.writerow({**row, "bbox": json.dumps(row["bbox"])})

    report = Report(id=report_id, survey_id=survey_id, format=fmt, file_path=file_path)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
