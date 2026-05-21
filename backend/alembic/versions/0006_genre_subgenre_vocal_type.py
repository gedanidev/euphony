"""genre_subgenre_vocal_type

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to songs
    op.add_column('songs', sa.Column('primary_genre', sa.String(100), nullable=True))
    op.add_column('songs', sa.Column(
        'subgenres',
        postgresql.JSONB(),
        nullable=False,
        server_default='[]'
    ))
    op.add_column('songs', sa.Column('vocal_type', sa.String(20), nullable=True))

    # Drop junction table first (FK references genres)
    op.drop_table('song_genres')
    # Drop lookup table
    op.drop_table('genres')


def downgrade() -> None:
    # Recreate genres lookup table
    op.create_table(
        'genres',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    # Recreate junction table
    op.create_table(
        'song_genres',
        sa.Column('song_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('genre_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['genre_id'], ['genres.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['song_id'], ['songs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('song_id', 'genre_id')
    )
    op.drop_column('songs', 'vocal_type')
    op.drop_column('songs', 'subgenres')
    op.drop_column('songs', 'primary_genre')
