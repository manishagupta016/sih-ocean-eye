import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sonar_file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sonar_files.id", ondelete="CASCADE"), nullable=False)

    # bbox stored as {"x": int, "y": int, "w": int, "h": int} in image pixel space
    bbox: Mapped[dict] = mapped_column(JSON, nullable=False)
    class_label: Mapped[str] = mapped_column(String(80), nullable=False)

    raw_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    calibrated_confidence: Mapped[float] = mapped_column(Float, nullable=False)

    is_artificial: Mapped[bool] = mapped_column(Boolean, nullable=False)
    artificial_score: Mapped[float] = mapped_column(Float, nullable=False)

    # Only populated when has_geo_metadata is True — never interpolated/fabricated.
    geom = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    has_geo_metadata: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sonar_file: Mapped["SonarFile"] = relationship(back_populates="detections")
    risk_score: Mapped["RiskScore"] = relationship(back_populates="detection", uselist=False, cascade="all, delete-orphan")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="detection", cascade="all, delete-orphan")
