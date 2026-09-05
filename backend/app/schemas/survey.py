import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SurveyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    location_name: str | None = None
    sonar_format: str | None = None
    notes: str | None = None


class SurveyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    location_name: str | None
    uploaded_at: datetime
    sonar_format: str | None
    notes: str | None


class SurveySummary(SurveyRead):
    sonar_file_count: int = 0
    detection_count: int = 0
    high_risk_count: int = 0
