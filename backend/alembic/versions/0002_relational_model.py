"""relational model

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-03

NOTE: downgrade() is DESTRUCTIVE — backfilled artist/album data cannot be
recovered after dropping new tables. Do not run downgrade() in production.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    # ------------------------------------------------------------------
    # A) Create new standalone tables
    # ------------------------------------------------------------------
    op.create_table(
        "artists",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("bio", sa.Text()),
        sa.Column("country", sa.String(100)),
        sa.Column("region", sa.String(100)),
        sa.Column("image_url", sa.String(500)),
        sa.Column("mbid", sa.String(36), unique=True),
        sa.Column("spotify_id", sa.String(100), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_artists_name", "artists", ["name"])

    op.create_table(
        "genres",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
    )

    op.create_table(
        "moods",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
    )

    op.create_table(
        "albums",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("artist_id", UUID(as_uuid=True), sa.ForeignKey("artists.id", ondelete="SET NULL"), nullable=True),
        sa.Column("year", sa.Integer()),
        sa.Column("cover_url", sa.String(500)),
        sa.Column("mbid", sa.String(36), unique=True),
        sa.Column("spotify_id", sa.String(100), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_albums_title", "albums", ["title"])

    op.create_table(
        "user_connections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("service", sa.String(20), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text()),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    # ------------------------------------------------------------------
    # B) Add new columns to songs (nullable for backfill)
    # ------------------------------------------------------------------
    op.add_column("songs", sa.Column("album_id", UUID(as_uuid=True),
        sa.ForeignKey("albums.id", ondelete="SET NULL"), nullable=True))
    op.add_column("songs", sa.Column("original_song_id", UUID(as_uuid=True),
        sa.ForeignKey("songs.id", ondelete="SET NULL"), nullable=True))
    op.add_column("songs", sa.Column("lyrics", sa.Text()))
    op.add_column("songs", sa.Column("lyrics_lrc", sa.Text()))
    op.add_column("songs", sa.Column("file_path", sa.String(500)))
    op.add_column("songs", sa.Column("availability", sa.String(20),
        nullable=False, server_default="available"))
    op.add_column("songs", sa.Column("mbid", sa.String(36)))
    op.add_column("songs", sa.Column("spotify_id", sa.String(100)))

    # ------------------------------------------------------------------
    # C) Backfill: artists and albums from existing text fields
    # ------------------------------------------------------------------
    op.execute("""
        INSERT INTO artists (id, name, created_at, updated_at)
        SELECT gen_random_uuid(), artist_display, NOW(), NOW()
        FROM songs
        WHERE artist_display IS NOT NULL AND artist_display != ''
        GROUP BY artist_display
        ON CONFLICT DO NOTHING
    """)

    op.execute("""
        INSERT INTO albums (id, title, artist_id, created_at, updated_at)
        SELECT gen_random_uuid(), s.album, a.id, NOW(), NOW()
        FROM (
            SELECT DISTINCT album, artist_display
            FROM songs
            WHERE album IS NOT NULL AND album != ''
        ) s
        JOIN artists a ON a.name = s.artist_display
        ON CONFLICT DO NOTHING
    """)

    op.execute("""
        UPDATE songs SET album_id = (
            SELECT alb.id FROM albums alb
            JOIN artists art ON art.id = alb.artist_id
            WHERE alb.title = songs.album
              AND art.name = songs.artist_display
        )
        WHERE songs.album IS NOT NULL AND songs.album != ''
    """)

    # ------------------------------------------------------------------
    # D) Create association tables + backfill song_artists
    # ------------------------------------------------------------------
    op.create_table(
        "song_artists",
        sa.Column("song_id", UUID(as_uuid=True), sa.ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("artist_id", UUID(as_uuid=True), sa.ForeignKey("artists.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="principal"),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("song_id", "artist_id", name="uq_song_artist"),
    )

    op.execute("""
        INSERT INTO song_artists (song_id, artist_id, role, "order")
        SELECT s.id, a.id, 'principal', 0
        FROM songs s
        JOIN artists a ON a.name = s.artist_display
        WHERE s.artist_display IS NOT NULL AND s.artist_display != ''
        ON CONFLICT DO NOTHING
    """)

    op.create_table(
        "song_composers",
        sa.Column("song_id", UUID(as_uuid=True), sa.ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("artist_id", UUID(as_uuid=True), sa.ForeignKey("artists.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("song_id", "artist_id", name="uq_song_composer"),
    )

    op.create_table(
        "artist_relations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("artist1_id", UUID(as_uuid=True), sa.ForeignKey("artists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("artist2_id", UUID(as_uuid=True), sa.ForeignKey("artists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relation_type", sa.String(30), nullable=False),
    )

    op.create_table(
        "song_genres",
        sa.Column("song_id", UUID(as_uuid=True), sa.ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("genre_id", UUID(as_uuid=True), sa.ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "song_moods",
        sa.Column("song_id", UUID(as_uuid=True), sa.ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("mood_id", UUID(as_uuid=True), sa.ForeignKey("moods.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "listen_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("song_id", UUID(as_uuid=True), sa.ForeignKey("songs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("played_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
    )
    op.create_index("ix_listen_history_song_id", "listen_history", ["song_id"])
    op.create_index("ix_listen_history_played_at", "listen_history", ["played_at"])

    # ------------------------------------------------------------------
    # E) Drop old text columns from songs
    # ------------------------------------------------------------------
    op.drop_index("ix_songs_artist_display", table_name="songs")
    op.drop_index("ix_songs_album", table_name="songs")
    op.drop_column("songs", "artist_display")
    op.drop_column("songs", "album")


def downgrade():
    # WARNING: This downgrade is destructive. Artist/album data backfilled
    # in upgrade() will be lost.

    # Restore old columns
    op.add_column("songs", sa.Column("artist_display", sa.String(255), nullable=True))
    op.add_column("songs", sa.Column("album", sa.String(255), nullable=True))

    # Attempt partial restore from song_artists / albums
    op.execute("""
        UPDATE songs SET artist_display = (
            SELECT a.name FROM artists a
            JOIN song_artists sa ON sa.artist_id = a.id
            WHERE sa.song_id = songs.id AND sa.role = 'principal'
            ORDER BY sa."order" LIMIT 1
        )
    """)
    op.execute("""
        UPDATE songs SET album = (
            SELECT alb.title FROM albums alb WHERE alb.id = songs.album_id
        )
    """)

    op.alter_column("songs", "artist_display", nullable=False)
    op.create_index("ix_songs_artist_display", "songs", ["artist_display"])
    op.create_index("ix_songs_album", "songs", ["album"])

    # Drop new tables (reverse dependency order)
    op.drop_table("listen_history")
    op.drop_table("song_moods")
    op.drop_table("song_genres")
    op.drop_table("artist_relations")
    op.drop_table("song_composers")
    op.drop_table("song_artists")

    op.drop_column("songs", "spotify_id")
    op.drop_column("songs", "mbid")
    op.drop_column("songs", "availability")
    op.drop_column("songs", "file_path")
    op.drop_column("songs", "lyrics_lrc")
    op.drop_column("songs", "lyrics")
    op.drop_column("songs", "original_song_id")
    op.drop_column("songs", "album_id")

    op.drop_table("user_connections")
    op.drop_index("ix_albums_title", table_name="albums")
    op.drop_table("albums")
    op.drop_table("moods")
    op.drop_table("genres")
    op.drop_index("ix_artists_name", table_name="artists")
    op.drop_table("artists")
