"""walkman_sync_wishlist

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-23

"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add walkman columns to songs
    op.add_column('songs', sa.Column('walkman_status', sa.String(20), nullable=True))
    op.add_column('songs', sa.Column('walkman_path', sa.String(500), nullable=True))
    op.add_column('songs', sa.Column('walkman_play_count', sa.Integer, nullable=True))
    op.add_column('songs', sa.Column('walkman_skip_count', sa.Integer, nullable=True))
    op.add_column('songs', sa.Column('walkman_size', sa.BigInteger, nullable=True))
    op.add_column('songs', sa.Column('wishlist_notes', sa.String(500), nullable=True))

    op.create_index('ix_songs_walkman_path', 'songs', ['walkman_path'])
    op.create_index('ix_songs_walkman_status', 'songs', ['walkman_status'])

    # Modify playlist_songs: make song_id nullable, drop unique constraint, add raw columns
    op.drop_constraint('uq_playlist_song', 'playlist_songs', type_='unique')
    op.alter_column('playlist_songs', 'song_id', nullable=True)
    op.add_column('playlist_songs', sa.Column('raw_title', sa.String(500), nullable=True))
    op.add_column('playlist_songs', sa.Column('raw_artist', sa.String(500), nullable=True))
    op.add_column('playlist_songs', sa.Column('raw_path', sa.String(500), nullable=True))
    # Partial unique index: enforce uniqueness only when song_id IS NOT NULL
    op.execute(
        "CREATE UNIQUE INDEX uq_playlist_song_resolved "
        "ON playlist_songs (playlist_id, song_id) WHERE song_id IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index('uq_playlist_song_resolved', table_name='playlist_songs')
    op.drop_column('playlist_songs', 'raw_path')
    op.drop_column('playlist_songs', 'raw_artist')
    op.drop_column('playlist_songs', 'raw_title')
    op.alter_column('playlist_songs', 'song_id', nullable=False)
    op.create_unique_constraint('uq_playlist_song', 'playlist_songs', ['playlist_id', 'song_id'])
    op.drop_index('ix_songs_walkman_status', table_name='songs')
    op.drop_index('ix_songs_walkman_path', table_name='songs')
    op.drop_column('songs', 'wishlist_notes')
    op.drop_column('songs', 'walkman_size')
    op.drop_column('songs', 'walkman_skip_count')
    op.drop_column('songs', 'walkman_play_count')
    op.drop_column('songs', 'walkman_path')
    op.drop_column('songs', 'walkman_status')
