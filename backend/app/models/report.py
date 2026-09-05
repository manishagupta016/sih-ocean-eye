import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ReportFormat(str, enum.Enum):
    csv = "csv"
    json = "json"


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    format: Mapped[ReportFormat] = mapped_column(Enum(ReportFormat, name="report_format"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    survey: Mapped["Survey"] = relationship(back_populates="reports")
