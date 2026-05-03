import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Text, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


def _now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Core lookup tables
# ---------------------------------------------------------------------------

class Artist(Base):
    __tablename__ = "artists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    bio = Column(Text)
    country = Column(String(100))
    region = Column(String(100))
    image_url = Column(String(500))
    mbid = Column(String(36), unique=True)
    spotify_id = Column(String(100), unique=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    albums = relationship("Album", back_populates="artist", cascade="all, delete-orphan")
    song_credits = relationship("SongArtist", back_populates="artist", cascade="all, delete-orphan")
    composer_credits = relationship("SongComposer", back_populates="artist", cascade="all, delete-orphan")
    relations_as_artist1 = relationship(
        "ArtistRelation", foreign_keys="ArtistRelation.artist1_id",
        back_populates="artist1", cascade="all, delete-orphan"
    )
    relations_as_artist2 = relationship(
        "ArtistRelation", foreign_keys="ArtistRelation.artist2_id",
        back_populates="artist2", cascade="all, delete-orphan"
    )


class Album(Base):
    __tablename__ = "albums"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False, index=True)
    artist_id = Column(UUID(as_uuid=True), ForeignKey("artists.id", ondelete="SET NULL"), nullable=True)
    year = Column(Integer)
    cover_url = Column(String(500))
    mbid = Column(String(36), unique=True)
    spotify_id = Column(String(100), unique=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    artist = relationship("Artist", back_populates="albums")
    songs = relationship("Song", back_populates="album")


class Genre(Base):
    __tablename__ = "genres"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)

    song_genres = relationship("SongGenre", back_populates="genre", cascade="all, delete-orphan")


class Mood(Base):
    __tablename__ = "moods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)

    song_moods = relationship("SongMood", back_populates="mood", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Song (relational redesign)
# ---------------------------------------------------------------------------

class Song(Base):
    __tablename__ = "songs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False, index=True)
    album_id = Column(UUID(as_uuid=True), ForeignKey("albums.id", ondelete="SET NULL"), nullable=True)
    duration = Column(Integer)  # seconds
    year = Column(Integer)
    version_type = Column(String(100))
    original_song_id = Column(UUID(as_uuid=True), ForeignKey("songs.id", ondelete="SET NULL"), nullable=True)
    lyrics = Column(Text)
    lyrics_lrc = Column(Text)
    file_path = Column(String(500))
    availability = Column(String(20), nullable=False, default="available")
    mbid = Column(String(36))
    spotify_id = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    album = relationship("Album", back_populates="songs")
    original_song = relationship("Song", remote_side="Song.id", foreign_keys=[original_song_id], back_populates="covers")
    covers = relationship("Song", foreign_keys=[original_song_id], back_populates="original_song")
    song_artists = relationship("SongArtist", back_populates="song", cascade="all, delete-orphan", order_by="SongArtist.order")
    song_composers = relationship("SongComposer", back_populates="song", cascade="all, delete-orphan", order_by="SongComposer.order")
    song_genres = relationship("SongGenre", back_populates="song", cascade="all, delete-orphan")
    song_moods = relationship("SongMood", back_populates="song", cascade="all, delete-orphan")
    playlist_songs = relationship("PlaylistSong", back_populates="song", cascade="all, delete-orphan")
    listen_history = relationship("ListenHistory", back_populates="song", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Association / junction tables
# ---------------------------------------------------------------------------

class SongArtist(Base):
    __tablename__ = "song_artists"
    __table_args__ = (UniqueConstraint("song_id", "artist_id", name="uq_song_artist"),)

    song_id = Column(UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True)
    artist_id = Column(UUID(as_uuid=True), ForeignKey("artists.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String(20), nullable=False, default="principal")
    order = Column(Integer, nullable=False, default=0)

    song = relationship("Song", back_populates="song_artists")
    artist = relationship("Artist", back_populates="song_credits")


class SongComposer(Base):
    __tablename__ = "song_composers"
    __table_args__ = (UniqueConstraint("song_id", "artist_id", name="uq_song_composer"),)

    song_id = Column(UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True)
    artist_id = Column(UUID(as_uuid=True), ForeignKey("artists.id", ondelete="CASCADE"), primary_key=True)
    order = Column(Integer, nullable=False, default=0)

    song = relationship("Song", back_populates="song_composers")
    artist = relationship("Artist", back_populates="composer_credits")


class ArtistRelation(Base):
    __tablename__ = "artist_relations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artist1_id = Column(UUID(as_uuid=True), ForeignKey("artists.id", ondelete="CASCADE"), nullable=False)
    artist2_id = Column(UUID(as_uuid=True), ForeignKey("artists.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String(30), nullable=False)

    artist1 = relationship("Artist", foreign_keys=[artist1_id], back_populates="relations_as_artist1")
    artist2 = relationship("Artist", foreign_keys=[artist2_id], back_populates="relations_as_artist2")


class SongGenre(Base):
    __tablename__ = "song_genres"

    song_id = Column(UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True)
    genre_id = Column(UUID(as_uuid=True), ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True)

    song = relationship("Song", back_populates="song_genres")
    genre = relationship("Genre", back_populates="song_genres")


class SongMood(Base):
    __tablename__ = "song_moods"

    song_id = Column(UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True)
    mood_id = Column(UUID(as_uuid=True), ForeignKey("moods.id", ondelete="CASCADE"), primary_key=True)

    song = relationship("Song", back_populates="song_moods")
    mood = relationship("Mood", back_populates="song_moods")


# ---------------------------------------------------------------------------
# User connections & listening history
# ---------------------------------------------------------------------------

class UserConnection(Base):
    __tablename__ = "user_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service = Column(String(20), nullable=False)  # spotify, lastfm
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text)
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class ListenHistory(Base):
    __tablename__ = "listen_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    song_id = Column(UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), nullable=False, index=True)
    played_at = Column(DateTime(timezone=True), nullable=False, index=True)
    source = Column(String(20), nullable=False, default="manual")  # walkman, spotify, manual, lastfm

    song = relationship("Song", back_populates="listen_history")


# ---------------------------------------------------------------------------
# Playlists (unchanged structure)
# ---------------------------------------------------------------------------

class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    playlist_songs = relationship(
        "PlaylistSong",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="PlaylistSong.position",
    )


class PlaylistSong(Base):
    __tablename__ = "playlist_songs"
    __table_args__ = (UniqueConstraint("playlist_id", "song_id", name="uq_playlist_song"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playlist_id = Column(UUID(as_uuid=True), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    song_id = Column(UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False, default=0)

    playlist = relationship("Playlist", back_populates="playlist_songs")
    song = relationship("Song", back_populates="playlist_songs")
