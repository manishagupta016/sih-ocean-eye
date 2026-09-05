"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # create_type=False: these enums are created explicitly below (once, via .create()); without
    # this flag SQLAlchemy also tries to auto-create them again as part of op.create_table's own
    # DDL (which does not check for existing types the way metadata.create_all does), raising
    # "type already exists".
    user_role = postgresql.ENUM("operator", "admin", name="user_role", create_type=False)
    sonar_file_type = postgresql.ENUM("image", "xtf", "jsf", "sdf", name="sonar_file_type", create_type=False)
    ingest_status = postgresql.ENUM(
        "queued", "preprocessing", "detecting", "discriminating", "calibrating",
        "scoring", "geolocating", "done", "failed", name="ingest_status", create_type=False,
    )
    risk_tier = postgresql.ENUM(
        "ignore", "human_review", "probable_debris", "high_confidence_hazard", name="risk_tier", create_type=False
    )
    report_format = postgresql.ENUM("csv", "json", name="report_format", create_type=False)
    alert_severity = postgresql.ENUM("low", "medium", "high", "critical", name="alert_severity", create_type=False)

    bind = op.get_bind()
    for enum in (user_role, sonar_file_type, ingest_status, risk_tier, report_format, alert_severity):
        enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="operator"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("key_prefix", sa.String(12), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "surveys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("location_name", sa.String(200), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("sonar_format", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )

    op.create_table(
        "model_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("version", sa.String(40), nullable=False),
        sa.Column("trained_on", sa.String(500), nullable=False),
        sa.Column("metrics_json", postgresql.JSONB, nullable=False, server_default="{}"),
    )

    op.create_table(
        "sonar_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("survey_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_type", sonar_file_type, nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("status", ingest_status, nullable=False, server_default="queued"),
        sa.Column("status_message", sa.String(500), nullable=True),
        sa.Column("has_nav_metadata", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("model_version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("model_versions.id"), nullable=True),
    )

    op.create_table(
        "detections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sonar_file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sonar_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bbox", postgresql.JSON, nullable=False),
        sa.Column("class_label", sa.String(80), nullable=False),
        sa.Column("raw_confidence", sa.Float, nullable=False),
        sa.Column("calibrated_confidence", sa.Float, nullable=False),
        sa.Column("is_artificial", sa.Boolean, nullable=False),
        sa.Column("artificial_score", sa.Float, nullable=False),
        sa.Column("geom", Geography(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("has_geo_metadata", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_detections_sonar_file_id", "detections", ["sonar_file_id"])
    op.create_index("ix_detections_class_label", "detections", ["class_label"])

    op.create_table(
        "risk_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("detection_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("detections.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("size_estimate", sa.Float, nullable=False),
        sa.Column("domain_shift_penalty", sa.Float, nullable=False),
        sa.Column("ecological_flag", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("risk_tier", risk_tier, nullable=False),
        sa.Column("computed_score", sa.Float, nullable=False),
    )
    op.create_index("ix_risk_scores_risk_tier", "risk_scores", ["risk_tier"])

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("survey_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("format", report_format, nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
    )

    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("detection_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("detections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("severity", alert_severity, nullable=False),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("acknowledged", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("acknowledged_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_alerts_acknowledged", "alerts", ["acknowledged"])


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("reports")
    op.drop_table("risk_scores")
    op.drop_table("detections")
    op.drop_table("sonar_files")
    op.drop_table("model_versions")
    op.drop_table("surveys")
    op.drop_table("api_keys")
    op.drop_table("users")

    bind = op.get_bind()
    for enum_name in ("alert_severity", "report_format", "risk_tier", "ingest_status", "sonar_file_type", "user_role"):
        postgresql.ENUM(name=enum_name).drop(bind, checkfirst=True)
