import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.report import Report
from app.models.survey import Survey
from app.models.user import User, UserRole
from app.schemas.report import ReportGenerateRequest, ReportRead
from app.services.report_generation import generate_report

router = APIRouter(prefix="/reports", tags=["reports"])


def _get_owned_survey(db: Session, current_user: User, survey_id: uuid.UUID) -> Survey:
    survey = db.get(Survey, survey_id)
    if survey is None or (current_user.role != UserRole.admin and survey.user_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Survey not found."})
    return survey


@router.get("", response_model=list[ReportRead])
def list_reports(survey_id: uuid.UUID | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Report).join(Survey, Report.survey_id == Survey.id)
    if current_user.role != UserRole.admin:
        q = q.filter(Survey.user_id == current_user.id)
    if survey_id:
        q = q.filter(Report.survey_id == survey_id)
    return q.order_by(Report.generated_at.desc()).all()


@router.post("/generate", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
def generate(payload: ReportGenerateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _get_owned_survey(db, current_user, payload.survey_id)
    return generate_report(db, payload.survey_id, payload.format)


@router.get("/{report_id}/download")
def download_report(report_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": "Report not found."})
    _get_owned_survey(db, current_user, report.survey_id)
    media_type = "application/json" if report.format.value == "json" else "text/csv"
    filename = f"report_{report.survey_id}.{report.format.value}"
    return FileResponse(report.file_path, media_type=media_type, filename=filename)
