import enum
import uuid

from sqlalchemy import Boolean, Enum, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RiskTier(str, enum.Enum):
    ignore = "ignore"
    human_review = "human_review"
    probable_debris = "probable_debris"
    high_confidence_hazard = "high_confidence_hazard"


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    detection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("detections.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    size_estimate: Mapped[float] = mapped_column(Float, nullable=False)  # meters^2, from bbox/segmentation
    domain_shift_penalty: Mapped[float] = mapped_column(Float, nullable=False)  # 0..1
    ecological_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    risk_tier: Mapped[RiskTier] = mapped_column(Enum(RiskTier, name="risk_tier"), nullable=False)
    computed_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0..1 weighted composite

    detection: Mapped["Detection"] = relationship(back_populates="risk_score")
