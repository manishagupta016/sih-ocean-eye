"""add shape_regularity, shadow_length_px, texture_variance to detections

These were already computed by the discriminator stage (app/ml/discriminator.py) on every real
uploaded image and threaded through CalibratedDetection/ScoredDetection, but were dropped instead
of persisted - the API and frontend had no way to show what made a detection look artificial
beyond the single artificial_score. Persisting them lets the UI show real, measured shape/shadow
evidence instead of nothing.

Revision ID: 0003_add_shape_features
Revises: 0002_widen_trained_on
Create Date: 2026-09-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_add_shape_features"
down_revision: Union[str, None] = "0002_widen_trained_on"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("detections", sa.Column("shape_regularity", sa.Float(), nullable=True))
    op.add_column("detections", sa.Column("shadow_length_px", sa.Float(), nullable=True))
    op.add_column("detections", sa.Column("texture_variance", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("detections", "texture_variance")
    op.drop_column("detections", "shadow_length_px")
    op.drop_column("detections", "shape_regularity")
