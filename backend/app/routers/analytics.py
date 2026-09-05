from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.ml.evaluation import get_calibration_report, get_cross_domain_report, get_performance_metrics
from app.models.alert import Alert
from app.models.detection import Detection
from app.models.model_version import ModelVersion
from app.models.risk_score import RiskScore, RiskTier
from app.models.sonar_file import SonarFile
from app.models.survey import Survey
from app.models.user import User, UserRole
from app.schemas.analytics import (
    CalibrationBin,
    CalibrationReport,
    CrossDomainReport,
    CrossDomainRow,
    DashboardSummary,
    LatencyReport,
    LatencyStats,
    PerformanceMetrics,
)
from app.schemas.model_version import ModelVersionRead
from app.services.metrics_store import get_all_stage_stats, get_end_to_end_percentiles

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _scope_surveys(db: Session, current_user: User):
    q = db.query(Survey)
    if current_user.role != UserRole.admin:
        q = q.filter(Survey.user_id == current_user.id)
    return q


@router.get("/dashboard-summary", response_model=DashboardSummary)
def dashboard_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    survey_ids = [s.id for s in _scope_surveys(db, current_user).all()]
    surveys_processed = len(survey_ids)

    if not survey_ids:
        return DashboardSummary(surveys_processed=0, anomalies_found=0, high_risk_pending_review=0, active_alerts=0)

    anomalies_found = (
        db.query(func.count(Detection.id))
        .join(SonarFile, Detection.sonar_file_id == SonarFile.id)
        .filter(SonarFile.survey_id.in_(survey_ids))
        .scalar()
    ) or 0

    high_risk_pending = (
        db.query(func.count(RiskScore.id))
        .join(Detection, RiskScore.detection_id == Detection.id)
        .join(SonarFile, Detection.sonar_file_id == SonarFile.id)
        .filter(
            SonarFile.survey_id.in_(survey_ids),
            RiskScore.risk_tier.in_([RiskTier.high_confidence_hazard, RiskTier.probable_debris]),
        )
        .scalar()
    ) or 0

    active_alerts = (
        db.query(func.count(Alert.id))
        .join(Detection, Alert.detection_id == Detection.id)
        .join(SonarFile, Detection.sonar_file_id == SonarFile.id)
        .filter(SonarFile.survey_id.in_(survey_ids), Alert.acknowledged.is_(False))
        .scalar()
    ) or 0

    return DashboardSummary(
        surveys_processed=surveys_processed,
        anomalies_found=anomalies_found,
        high_risk_pending_review=high_risk_pending,
        active_alerts=active_alerts,
    )


@router.get("/model-versions", response_model=list[ModelVersionRead])
def model_versions(db: Session = Depends(get_db)):
    return db.query(ModelVersion).order_by(ModelVersion.name).all()


@router.get("/performance", response_model=PerformanceMetrics)
def performance(db: Session = Depends(get_db)):
    latest = db.query(ModelVersion).filter(ModelVersion.name == "yolov8n-sss").order_by(ModelVersion.version.desc()).first()
    metrics = get_performance_metrics(latest)
    return PerformanceMetrics(
        model_version=(latest.version if latest else "mock-cv-blob-detector"),
        source=metrics.get("source", "illustrative_demo"),
        note=metrics.get("note"),
        precision=metrics["precision"],
        recall=metrics["recall"],
        map50=metrics["map50"],
        map50_95=metrics["map50_95"],
        false_positive_rate=metrics["false_positive_rate"],
        per_class=metrics["per_class"],
    )


@router.get("/calibration", response_model=CalibrationReport)
def calibration():
    report = get_calibration_report()
    return CalibrationReport(
        model_version="isotonic-v1",
        expected_calibration_error=report["calibrated_ece"],
        bins=[CalibrationBin(**b) for b in report["calibrated_bins"]],
    )


@router.get("/cross-domain", response_model=CrossDomainReport)
def cross_domain(db: Session = Depends(get_db)):
    latest = db.query(ModelVersion).filter(ModelVersion.name == "yolov8n-sss").order_by(ModelVersion.version.desc()).first()
    report = get_cross_domain_report(latest)
    return CrossDomainReport(
        source=report.get("source", "illustrative_demo"),
        note=report.get("note"),
        rows=[CrossDomainRow(**r) for r in report["rows"]],
    )


@router.get("/latency", response_model=LatencyReport)
def latency(db: Session = Depends(get_db)):
    latest = db.query(ModelVersion).order_by(ModelVersion.version.desc()).first()
    stages = [LatencyStats(**s) for s in get_all_stage_stats() if s["stage"] != "end_to_end"]
    p50, p95 = get_end_to_end_percentiles()
    return LatencyReport(
        model_version=(latest.version if latest else "n/a"),
        stages=stages,
        end_to_end_p50_ms=p50,
        end_to_end_p95_ms=p95,
    )
