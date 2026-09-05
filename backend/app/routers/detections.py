import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.detection import Detection
from app.models.risk_score import RiskTier
from app.models.sonar_file import SonarFile
from app.models.survey import Survey
from app.models.user import User, UserRole
from app.schemas.detection import DetectionRead, DetectionWithContext

router = APIRouter(prefix="/detections", tags=["detections"])


def _base_query(db: Session, current_user: User):
    q = (
        db.query(Detection, SonarFile, Survey)
        .join(SonarFile, Detection.sonar_file_id == SonarFile.id)
        .join(Survey, SonarFile.survey_id == Survey.id)
        .options(joinedload(Detection.risk_score))
    )
    if current_user.role != UserRole.admin:
        q = q.filter(Survey.user_id == current_user.id)
    return q


@router.get("", response_model=list[DetectionWithContext])
def list_detections(
    survey_id: uuid.UUID | None = None,
    sonar_file_id: uuid.UUID | None = None,
    min_calibrated_confidence: float = Query(default=0.0, ge=0.0, le=1.0),
    risk_tier: RiskTier | None = None,
    class_label: str | None = None,
    is_artificial: bool | None = None,
    has_geo_metadata: bool | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = _base_query(db, current_user)
    if survey_id:
        q = q.filter(Survey.id == survey_id)
    if sonar_file_id:
        q = q.filter(SonarFile.id == sonar_file_id)
    if class_label:
        q = q.filter(Detection.class_label == class_label)
    if is_artificial is not None:
        q = q.filter(Detection.is_artificial == is_artificial)
    if has_geo_metadata is not None:
        q = q.filter(Detection.has_geo_metadata == has_geo_metadata)
    q = q.filter(Detection.calibrated_confidence >= min_calibrated_confidence)

    rows = q.order_by(Detection.created_at.desc()).all()

    out = []
    for detection, sonar_file, survey in rows:
        if risk_tier and (detection.risk_score is None or detection.risk_score.risk_tier != risk_tier):
            continue
        out.append(
            DetectionWithContext(
                **DetectionRead.model_validate(detection).model_dump(),
                survey_id=survey.id,
                survey_name=survey.name,
                sonar_file_path=sonar_file.file_path,
            )
        )
    return out


@router.get("/{detection_id}", response_model=DetectionWithContext)
def get_detection(detection_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = _base_query(db, current_user).filter(Detection.id == detection_id)
    row = q.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Detection not found."})
    detection, sonar_file, survey = row
    return DetectionWithContext(
        **DetectionRead.model_validate(detection).model_dump(),
        survey_id=survey.id,
        survey_name=survey.name,
        sonar_file_path=sonar_file.file_path,
    )
