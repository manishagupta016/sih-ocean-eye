import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SonarFileType(str, enum.Enum):
    image = "image"
    xtf = "xtf"
    jsf = "jsf"
    sdf = "sdf"


class IngestStatus(str, enum.Enum):
    queued = "queued"
    preprocessing = "preprocessing"
    detecting = "detecting"
    discriminating = "discriminating"
    calibrating = "calibrating"
    scoring = "scoring"
    geolocating = "geolocating"
    done = "done"
    failed = "failed"


class SonarFile(Base):
    __tablename__ = "sonar_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[SonarFileType] = mapped_column(Enum(SonarFileType, name="sonar_file_type"), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[IngestStatus] = mapped_column(Enum(IngestStatus, name="ingest_status"), default=IngestStatus.queued, nullable=False)
    status_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    has_nav_metadata: Mapped[bool] = mapped_column(default=False)
    model_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("model_versions.id"), nullable=True
    )

    survey: Mapped["Survey"] = relationship(back_populates="sonar_files")
    detections: Mapped[list["Detection"]] = relationship(back_populates="sonar_file", cascade="all, delete-orphan")
    model_version: Mapped["ModelVersion | None"] = relationship()
