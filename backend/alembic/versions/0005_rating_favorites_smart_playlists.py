"""add_rating_favorites_smart_playlists

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add rating and is_favorite to songs
    op.add_column('songs', sa.Column('rating', sa.Integer(), nullable=True))
    op.add_column('songs', sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default='false'))

    # Add rating to albums
    op.add_column('albums', sa.Column('rating', sa.Integer(), nullable=True))

    # Add is_preferred to artists
    op.add_column('artists', sa.Column('is_preferred', sa.Boolean(), nullable=False, server_default='false'))

    # Create smart_playlists table
    op.create_table(
        'smart_playlists',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('match_all', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('conditions', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('smart_playlists')
    op.drop_column('artists', 'is_preferred')
    op.drop_column('albums', 'rating')
    op.drop_column('songs', 'is_favorite')
    op.drop_column('songs', 'rating')
