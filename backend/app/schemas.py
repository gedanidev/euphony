from __future__ import annotations
from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field


# ---------------------------------------------------------------------------
# Genre
# ---------------------------------------------------------------------------

class GenreCreate(BaseModel):
    name: str

class GenreRead(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Mood
# ---------------------------------------------------------------------------

class MoodCreate(BaseModel):
    name: str
    description: Optional[str] = None

class MoodRead(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Artist
# ---------------------------------------------------------------------------

class ArtistBase(BaseModel):
    name: str
    bio: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    image_url: Optional[str] = None
    mbid: Optional[str] = None
    spotify_id: Optional[str] = None
    is_preferred: bool = False

class ArtistCreate(ArtistBase):
    pass

class ArtistUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    image_url: Optional[str] = None
    mbid: Optional[str] = None
    spotify_id: Optional[str] = None
    is_preferred: Optional[bool] = None

class ArtistRead(ArtistBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

class ArtistRelationRead(BaseModel):
    id: UUID
    artist1: ArtistRead
    artist2: ArtistRead
    relation_type: str

    model_config = {"from_attributes": True}

class ArtistRelationCreate(BaseModel):
    artist2_id: UUID
    relation_type: str


# ---------------------------------------------------------------------------
# Album
# ---------------------------------------------------------------------------

class AlbumBase(BaseModel):
    title: str
    artist_id: Optional[UUID] = None
    year: Optional[int] = None
    cover_url: Optional[str] = None
    mbid: Optional[str] = None
    spotify_id: Optional[str] = None
    rating: Optional[int] = None

class AlbumCreate(AlbumBase):
    pass

class AlbumUpdate(BaseModel):
    title: Optional[str] = None
    artist_id: Optional[UUID] = None
    year: Optional[int] = None
    cover_url: Optional[str] = None
    mbid: Optional[str] = None
    spotify_id: Optional[str] = None
    rating: Optional[int] = None

class AlbumRead(AlbumBase):
    id: UUID
    artist: Optional[ArtistRead] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Song
# ---------------------------------------------------------------------------

class SongArtistRead(BaseModel):
    artist: ArtistRead
    role: str
    order: int

    model_config = {"from_attributes": True}

class SongGenreRead(BaseModel):
    genre: GenreRead

    model_config = {"from_attributes": True}

class SongMoodRead(BaseModel):
    mood: MoodRead

    model_config = {"from_attributes": True}

class SongComposerRead(BaseModel):
    artist: ArtistRead
    order: int

    model_config = {"from_attributes": True}

class SongBase(BaseModel):
    title: str
    album_id: Optional[UUID] = None
    duration: Optional[int] = None
    year: Optional[int] = None
    version_type: Optional[str] = None
    original_song_id: Optional[UUID] = None
    lyrics: Optional[str] = None
    lyrics_lrc: Optional[str] = None
    file_path: Optional[str] = None
    availability: str = "available"
    mbid: Optional[str] = None
    spotify_id: Optional[str] = None
    rating: Optional[int] = None
    is_favorite: bool = False

class SongCreate(SongBase):
    # First artist in list becomes principal unless artist_roles overrides
    artist_ids: List[UUID]
    artist_roles: Optional[List[dict]] = None  # [{"artist_id": "...", "role": "colaborador"}]
    composer_ids: Optional[List[UUID]] = None
    genre_ids: Optional[List[UUID]] = None
    mood_ids: Optional[List[UUID]] = None

class SongUpdate(BaseModel):
    title: Optional[str] = None
    album_id: Optional[UUID] = None
    duration: Optional[int] = None
    year: Optional[int] = None
    version_type: Optional[str] = None
    original_song_id: Optional[UUID] = None
    lyrics: Optional[str] = None
    lyrics_lrc: Optional[str] = None
    file_path: Optional[str] = None
    availability: Optional[str] = None
    mbid: Optional[str] = None
    spotify_id: Optional[str] = None
    rating: Optional[int] = None
    is_favorite: Optional[bool] = None
    artist_ids: Optional[List[UUID]] = None
    artist_roles: Optional[List[dict]] = None
    composer_ids: Optional[List[UUID]] = None
    genre_ids: Optional[List[UUID]] = None
    mood_ids: Optional[List[UUID]] = None

class SongRead(SongBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    artists: List[SongArtistRead] = Field(default=[], validation_alias="song_artists")
    composers: List[SongComposerRead] = Field(default=[], validation_alias="song_composers")
    genres: List[SongGenreRead] = Field(default=[], validation_alias="song_genres")
    moods: List[SongMoodRead] = Field(default=[], validation_alias="song_moods")
    album: Optional[AlbumRead] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @computed_field
    @property
    def artist_display(self) -> str:
        """Backward-compat field used by PlaylistDetail.jsx and Library.jsx"""
        principals = [sa.artist.name for sa in self.artists if sa.role == "principal"]
        return ", ".join(principals) if principals else ""


# ---------------------------------------------------------------------------
# Album / Artist detail views
# ---------------------------------------------------------------------------

class AlbumWithSongs(AlbumRead):
    songs: List[SongRead] = []
    band_members: List[ArtistRelationRead] = []

class ArtistWithSongs(ArtistRead):
    songs: List[SongRead] = []
    relations: List[ArtistRelationRead] = []


# ---------------------------------------------------------------------------
# Playlist (unchanged structure)
# ---------------------------------------------------------------------------

class PlaylistBase(BaseModel):
    name: str
    description: Optional[str] = None

class PlaylistCreate(PlaylistBase):
    pass

class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class PlaylistSongRead(BaseModel):
    position: int
    song: SongRead

    model_config = {"from_attributes": True}

class PlaylistRead(PlaylistBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    song_count: int = 0

    model_config = {"from_attributes": True}

class PlaylistDetailRead(PlaylistRead):
    songs: List[PlaylistSongRead] = []


# ---------------------------------------------------------------------------
# Playlist operations (unchanged)
# ---------------------------------------------------------------------------

class BatchAddSongs(BaseModel):
    song_ids: List[UUID]

class ReorderItem(BaseModel):
    song_id: UUID
    position: int

class ReorderRequest(BaseModel):
    order: List[ReorderItem]


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------

class ImportSummary(BaseModel):
    created: int
    matched: int
    failed: int
    failed_lines: List[str] = []


# ---------------------------------------------------------------------------
# Listen history
# ---------------------------------------------------------------------------

class LyricsSave(BaseModel):
    lyrics: Optional[str] = None
    lyrics_lrc: Optional[str] = None


class ListenHistoryCreate(BaseModel):
    song_id: UUID
    played_at: datetime
    source: str = "manual"

class ListenHistoryRead(BaseModel):
    id: UUID
    song_id: Optional[UUID] = None
    played_at: datetime
    source: str

    model_config = {"from_attributes": True}


class SpotifyPlayEntry(BaseModel):
    played_at: datetime
    source: str


class SpotifyHistoryTrack(BaseModel):
    """A unique track from Spotify history with aggregated play info."""
    spotify_track_id: Optional[str] = None
    track_title: str
    artist_name: str
    album_name: Optional[str] = None
    cover_url: Optional[str] = None
    duration_ms: Optional[int] = None
    play_count: int
    last_played_at: datetime
    plays: List[SpotifyPlayEntry]
    # If the track has been added to library
    song_id: Optional[UUID] = None
    availability: Optional[str] = None


# ---------------------------------------------------------------------------
# User connection
# ---------------------------------------------------------------------------

class UserConnectionRead(BaseModel):
    id: UUID
    service: str
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginatedSongs(BaseModel):
    items: List[SongRead]
    total: int
    page: int
    limit: int

class PaginatedArtists(BaseModel):
    items: List[ArtistRead]
    total: int
    page: int
    limit: int

class PaginatedAlbums(BaseModel):
    items: List[AlbumRead]
    total: int
    page: int
    limit: int

class PaginatedPlaylists(BaseModel):
    items: List[PlaylistRead]
    total: int
    page: int
    limit: int


# ---------------------------------------------------------------------------
# User / Auth
# ---------------------------------------------------------------------------

class UserRead(BaseModel):
    id: UUID
    email: str
    display_name: Optional[str] = None
    is_superuser: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None


class UserUpdate(BaseModel):
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str
    turnstile_token: str


class ForgotPasswordRequest(BaseModel):
    email: str
    turnstile_token: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ---------------------------------------------------------------------------
# Smart Playlists
# ---------------------------------------------------------------------------

class SmartPlaylistCondition(BaseModel):
    field: str   # "artist", "album", "genre", "mood", "year", "availability", "rating", "is_favorite", "artist_preferred"
    op: str      # "contains", "not_contains", "is", "is_not", "starts_with", "ends_with", "gt", "lt", "between"
    value: Any   # str, int, bool, or list of two ints for "between"

class SmartPlaylistCreate(BaseModel):
    name: str
    match_all: bool = True
    conditions: List[SmartPlaylistCondition] = []

class SmartPlaylistUpdate(BaseModel):
    name: Optional[str] = None
    match_all: Optional[bool] = None
    conditions: Optional[List[SmartPlaylistCondition]] = None

class SmartPlaylistRead(BaseModel):
    id: UUID
    name: str
    match_all: bool
    conditions: List[SmartPlaylistCondition]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

class SmartPlaylistPreviewRequest(BaseModel):
    match_all: bool = True
    conditions: List[SmartPlaylistCondition] = []

class SmartPlaylistPreviewResponse(BaseModel):
    song_count: int
    songs: List[SongRead] = []
