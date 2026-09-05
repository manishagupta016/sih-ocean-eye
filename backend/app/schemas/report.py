import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.report import ReportFormat


class ReportGenerateRequest(BaseModel):
    survey_id: uuid.UUID
    format: ReportFormat


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    survey_id: uuid.UUID
    generated_at: datetime
    format: ReportFormat
    file_path: str
