import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.ml.risk_scoring import (
    ECOLOGICALLY_SENSITIVE_CLASSES,
    KNOWN_TRAINING_DEVICES,
    KNOWN_TRAINING_SITES,
    SIZE_REFERENCE_M2,
    explain_weights,
)
from app.models.detection import Detection
from app.models.risk_score import RiskScore
from app.models.survey import Survey
from app.models.sonar_file import SonarFile
from app.models.user import User, UserRole
from app.schemas.detection import RiskScoreRead

router = APIRouter(prefix="/risk-scores", tags=["risk-scores"])


@router.get("/formula")
def get_formula():
    """Exposes the risk-scoring formula so the frontend can render an inspectable explanation
    next to every risk tier badge, instead of a black-box number."""
    return {
        "weights": explain_weights(),
        "tiers": {
            "ignore": "score < 0.25",
            "human_review": "0.25 <= score < 0.50",
            "probable_debris": "0.50 <= score < 0.75",
            "high_confidence_hazard": "score >= 0.75",
        },
        "ecological_override": {
            "classes": sorted(ECOLOGICALLY_SENSITIVE_CLASSES),
            "rule": "never auto-dismissed as 'ignore' regardless of composite score",
        },
        "size_reference_m2": SIZE_REFERENCE_M2,
        "known_training_devices": sorted(KNOWN_TRAINING_DEVICES),
        "known_training_sites": sorted(KNOWN_TRAINING_SITES),
    }


@router.get("/{detection_id}", response_model=RiskScoreRead)
def get_risk_score(detection_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = (
        db.query(RiskScore)
        .join(Detection, RiskScore.detection_id == Detection.id)
        .join(SonarFile, Detection.sonar_file_id == SonarFile.id)
        .join(Survey, SonarFile.survey_id == Survey.id)
        .filter(RiskScore.detection_id == detection_id)
    )
    if current_user.role != UserRole.admin:
        q = q.filter(Survey.user_id == current_user.id)
    risk_score = q.first()
    if risk_score is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Risk score not found."})
    return risk_score
