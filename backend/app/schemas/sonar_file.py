import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.sonar_file import IngestStatus, SonarFileType


class SonarFileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: uuid.UUID
    survey_id: uuid.UUID
    file_path: str
    file_type: SonarFileType
    ingested_at: datetime
    status: IngestStatus
    status_message: str | None
    has_nav_metadata: bool
    # Populated once detection has run (see routers/uploads.py) so the frontend can show which
    # detector actually produced these results - honest about the classical-CV fallback rather
    # than implying a validated fine-tuned model ran when it didn't.
    model_name: str | None = None
    model_is_fallback: bool | None = None
    model_provenance: str | None = None


class UploadResponse(BaseModel):
    sonar_file: SonarFileRead
    job_id: str


class JobStatus(BaseModel):
    job_id: str
    sonar_file_id: uuid.UUID
    status: IngestStatus
    progress_pct: int
    message: str | None = None
    detection_count: int | None = None
