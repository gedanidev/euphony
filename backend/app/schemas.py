from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime


# ── Song ────────────────────────────────────────────────────────────────────

class SongBase(BaseModel):
    title: str
    artist_display: str
    album: Optional[str] = None
    duration: Optional[int] = None  # seconds
    year: Optional[int] = None
    version_type: Optional[str] = None


class SongCreate(SongBase):
    pass


class SongUpdate(BaseModel):
    title: Optional[str] = None
    artist_display: Optional[str] = None
    album: Optional[str] = None
    duration: Optional[int] = None
    year: Optional[int] = None
    version_type: Optional[str] = None


class SongRead(SongBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Playlist ─────────────────────────────────────────────────────────────────

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

    model_config = ConfigDict(from_attributes=True)


class PlaylistRead(PlaylistBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    song_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class PlaylistDetailRead(PlaylistRead):
    songs: List[PlaylistSongRead] = []


# ── Operations ───────────────────────────────────────────────────────────────

class BatchAddSongs(BaseModel):
    song_ids: List[UUID]


class ReorderItem(BaseModel):
    song_id: UUID
    position: int


class ReorderRequest(BaseModel):
    order: List[ReorderItem]


# ── Paginated ────────────────────────────────────────────────────────────────

class PaginatedSongs(BaseModel):
    items: List[SongRead]
    total: int
    page: int
    limit: int


class PaginatedPlaylists(BaseModel):
    items: List[PlaylistRead]
    total: int
    page: int
    limit: int
