import uuid

from sqlalchemy import JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    trained_on: Mapped[str] = mapped_column(
        String(500), nullable=False
    )  # e.g. "SeabedObjects-KLSG-style + synthetic; FLS used for pretraining only"
    metrics_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
