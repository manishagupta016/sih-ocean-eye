import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.detection import Detection
from app.models.risk_score import RiskScore
from app.models.sonar_file import SonarFile
from app.models.survey import Survey
from app.models.user import User, UserRole
from app.schemas.alert import AlertRead, AlertWithContext

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertWithContext])
def list_alerts(
    acknowledged: bool | None = None,
    severity: AlertSeverity | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Alert, Detection, Survey, RiskScore)
        .join(Detection, Alert.detection_id == Detection.id)
        .join(SonarFile, Detection.sonar_file_id == SonarFile.id)
        .join(Survey, SonarFile.survey_id == Survey.id)
        .outerjoin(RiskScore, RiskScore.detection_id == Detection.id)
    )
    if current_user.role != UserRole.admin:
        q = q.filter(Survey.user_id == current_user.id)
    if acknowledged is not None:
        q = q.filter(Alert.acknowledged == acknowledged)
    if severity:
        q = q.filter(Alert.severity == severity)

    rows = q.order_by(Alert.created_at.desc()).all()
    return [
        AlertWithContext(
            **AlertRead.model_validate(alert).model_dump(),
            survey_id=survey.id,
            survey_name=survey.name,
            class_label=detection.class_label,
            risk_tier=risk.risk_tier.value if risk else None,
        )
        for alert, detection, survey, risk in rows
    ]


@router.post("/{alert_id}/acknowledge", response_model=AlertRead)
def acknowledge_alert(alert_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Alert not found."})
    alert.acknowledged = True
    alert.acknowledged_by = current_user.id
    db.commit()
    db.refresh(alert)
    return alert
