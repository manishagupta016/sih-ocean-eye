"""widen model_versions.trained_on to unbounded text

Revision ID: 0002_widen_trained_on
Revises: 0001_initial_schema
Create Date: 2026-09-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_widen_trained_on"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "model_versions",
        "trained_on",
        existing_type=sa.String(500),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "model_versions",
        "trained_on",
        existing_type=sa.Text(),
        type_=sa.String(500),
        existing_nullable=False,
    )
