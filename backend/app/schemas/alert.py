import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.alert import AlertSeverity


class AlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    detection_id: uuid.UUID
    severity: AlertSeverity
    message: str
    acknowledged: bool
    created_at: datetime


class AlertWithContext(AlertRead):
    survey_id: uuid.UUID
    survey_name: str
    class_label: str
    risk_tier: str | None = None
