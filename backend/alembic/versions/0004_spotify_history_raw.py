"""spotify history raw track data

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    # Make song_id nullable (Spotify entries don't need a library song)
    op.alter_column("listen_history", "song_id", nullable=True)

    # Change FK to SET NULL on delete instead of CASCADE
    op.drop_constraint("listen_history_song_id_fkey", "listen_history", type_="foreignkey")
    op.create_foreign_key(
        "listen_history_song_id_fkey",
        "listen_history", "songs",
        ["song_id"], ["id"],
        ondelete="SET NULL",
    )

    # Add raw track data columns
    op.add_column("listen_history", sa.Column("track_title", sa.String(500), nullable=True))
    op.add_column("listen_history", sa.Column("artist_name", sa.String(500), nullable=True))
    op.add_column("listen_history", sa.Column("album_name", sa.String(500), nullable=True))
    op.add_column("listen_history", sa.Column("spotify_track_id", sa.String(100), nullable=True))
    op.add_column("listen_history", sa.Column("cover_url", sa.Text(), nullable=True))
    op.add_column("listen_history", sa.Column("duration_ms", sa.Integer(), nullable=True))

    op.create_index("ix_listen_history_spotify_track_id", "listen_history", ["spotify_track_id"])


def downgrade():
    op.drop_index("ix_listen_history_spotify_track_id", "listen_history")
    op.drop_column("listen_history", "duration_ms")
    op.drop_column("listen_history", "cover_url")
    op.drop_column("listen_history", "spotify_track_id")
    op.drop_column("listen_history", "album_name")
    op.drop_column("listen_history", "artist_name")
    op.drop_column("listen_history", "track_title")

    op.drop_constraint("listen_history_song_id_fkey", "listen_history", type_="foreignkey")
    op.create_foreign_key(
        "listen_history_song_id_fkey",
        "listen_history", "songs",
        ["song_id"], ["id"],
        ondelete="CASCADE",
    )
    op.alter_column("listen_history", "song_id", nullable=False)
