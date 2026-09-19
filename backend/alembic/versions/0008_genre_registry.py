"""genre_registry

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-19

Adds a lightweight `genres` table so a genre name can exist as an empty
placeholder before any song is tagged with it. Song.primary_genre stays a
plain string column, matched by name — this is not a foreign key relation.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'genres',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('name', name='uq_genres_name'),
    )


def downgrade() -> None:
    op.drop_table('genres')
