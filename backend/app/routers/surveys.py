import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.detection import Detection
from app.models.risk_score import RiskScore, RiskTier
from app.models.sonar_file import SonarFile
from app.models.survey import Survey
from app.models.user import User
from app.schemas.survey import SurveyCreate, SurveyRead, SurveySummary

router = APIRouter(prefix="/surveys", tags=["surveys"])


@router.get("", response_model=list[SurveySummary])
def list_surveys(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    surveys = db.query(Survey).filter(Survey.user_id == current_user.id).order_by(Survey.uploaded_at.desc()).all()
    out = []
    for survey in surveys:
        sonar_file_count = db.query(func.count(SonarFile.id)).filter(SonarFile.survey_id == survey.id).scalar()
        detection_count = (
            db.query(func.count(Detection.id))
            .join(SonarFile, Detection.sonar_file_id == SonarFile.id)
            .filter(SonarFile.survey_id == survey.id)
            .scalar()
        )
        high_risk_count = (
            db.query(func.count(RiskScore.id))
            .join(Detection, RiskScore.detection_id == Detection.id)
            .join(SonarFile, Detection.sonar_file_id == SonarFile.id)
            .filter(
                SonarFile.survey_id == survey.id,
                RiskScore.risk_tier == RiskTier.high_confidence_hazard,
            )
            .scalar()
        )
        out.append(
            SurveySummary(
                **SurveyRead.model_validate(survey).model_dump(),
                sonar_file_count=sonar_file_count or 0,
                detection_count=detection_count or 0,
                high_risk_count=high_risk_count or 0,
            )
        )
    return out


@router.post("", response_model=SurveyRead, status_code=status.HTTP_201_CREATED)
def create_survey(payload: SurveyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    survey = Survey(user_id=current_user.id, **payload.model_dump())
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return survey


@router.get("/{survey_id}", response_model=SurveyRead)
def get_survey(survey_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    survey = db.get(Survey, survey_id)
    if survey is None or survey.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Survey not found."})
    return survey


@router.delete("/{survey_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_survey(survey_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    survey = db.get(Survey, survey_id)
    if survey is None or survey.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Survey not found."})
    db.delete(survey)
    db.commit()
