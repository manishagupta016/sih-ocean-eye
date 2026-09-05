import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.risk_score import RiskTier


class BoundingBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class RiskScoreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    size_estimate: float
    domain_shift_penalty: float
    ecological_flag: bool
    risk_tier: RiskTier
    computed_score: float


class DetectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sonar_file_id: uuid.UUID
    bbox: BoundingBox
    class_label: str
    raw_confidence: float
    calibrated_confidence: float
    is_artificial: bool
    artificial_score: float
    has_geo_metadata: bool
    latitude: float | None
    longitude: float | None
    created_at: datetime
    risk_score: RiskScoreRead | None = None


class DetectionWithContext(DetectionRead):
    survey_id: uuid.UUID
    survey_name: str
    sonar_file_path: str
