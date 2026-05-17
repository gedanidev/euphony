# Smart Playlists + Rating + Favoritas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add smart playlists (rule-based, iTunes-style builder), song/album rating (1–10, shown as 5 stars), favorite songs (♥), and preferred artists (★) to Euphony.

**Architecture:** New columns on `songs`, `albums`, `artists`. New `smart_playlists` table with conditions stored as JSONB. A query engine builds SQLAlchemy filters dynamically. Frontend adds a Smart tab to Playlists page with a modal builder; rating/favorite icons are inline in Library and Artists pages.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend); React + Tailwind + i18next (frontend); existing pattern: `models.py` → `schemas.py` → `routers/*.py` → `api/*.js` → pages.

---

## File Map

**Backend — create:**
- `backend/app/routers/smart_playlists.py` — all CRUD + preview + M3U export endpoints
- `backend/alembic/versions/0005_rating_favorites_smart_playlists.py` — migration

**Backend — modify:**
- `backend/app/models.py` — add `rating`, `is_favorite` to Song; `rating` to Album; `is_preferred` to Artist; add `SmartPlaylist` model
- `backend/app/schemas.py` — update Song/Album/Artist schemas; add SmartPlaylist schemas
- `backend/app/routers/songs.py` — add PATCH `/songs/{id}/rating` and `/songs/{id}/favorite`
- `backend/app/routers/albums.py` — add PATCH `/albums/{id}/rating`
- `backend/app/routers/artists.py` — add PATCH `/artists/{id}/preferred`
- `backend/app/main.py` — register smart_playlists router

**Frontend — create:**
- `frontend/src/api/smart_playlists.js` — API client functions
- `frontend/src/components/RatingStars.jsx` — reusable 5-star + number input component
- `frontend/src/components/SmartPlaylistBuilder.jsx` — modal with condition rows

**Frontend — modify:**
- `frontend/src/pages/Playlists.jsx` — add Smart tab
- `frontend/src/pages/Library.jsx` — add ♥ favorite and ★★★☆☆ rating per row
- `frontend/src/pages/Artists.jsx` — add ★ preferred toggle per artist row
- `frontend/src/pages/ArtistDetail.jsx` — add ★ preferred toggle in header
- `frontend/src/i18n/locales/es.json` — new keys
- `frontend/src/i18n/locales/en.json` — new keys
- `frontend/src/i18n/locales/ja.json` — new keys

---

## Task 1: Database migration — rating, favorites, smart_playlists

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/alembic/versions/0005_rating_favorites_smart_playlists.py`

- [ ] **Step 1: Add new columns and SmartPlaylist model to models.py**

In `backend/app/models.py`, add these imports at the top if not present:
```python
from sqlalchemy import JSON
```

Then add `rating` and `is_favorite` to `Song`:
```python
class Song(Base):
    # ... existing columns ...
    rating = Column(Integer, nullable=True)
    is_favorite = Column(Boolean, nullable=False, default=False)
```

Add `rating` to `Album`:
```python
class Album(Base):
    # ... existing columns ...
    rating = Column(Integer, nullable=True)
```

Add `is_preferred` to `Artist`:
```python
class Artist(Base):
    # ... existing columns ...
    is_preferred = Column(Boolean, nullable=False, default=False)
```

Add `SmartPlaylist` model after the existing playlist models:
```python
class SmartPlaylist(Base):
    __tablename__ = "smart_playlists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    match_all = Column(Boolean, nullable=False, default=True)  # True=AND, False=OR
    conditions = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)
```

- [ ] **Step 2: Generate migration**

```bash
cd backend
docker compose -f ../docker-compose.euphony.yml exec backend alembic revision --autogenerate -m "add_rating_favorites_smart_playlists"
```

If running locally without Docker:
```bash
cd backend
alembic revision --autogenerate -m "add_rating_favorites_smart_playlists"
```

The generated file will be in `backend/alembic/versions/`. Rename it to `0005_rating_favorites_smart_playlists.py`.

- [ ] **Step 3: Verify migration content**

Open the generated file. It should contain `op.add_column` for:
- `songs.rating` (Integer, nullable)
- `songs.is_favorite` (Boolean, not null, server_default='false')
- `albums.rating` (Integer, nullable)
- `artists.is_preferred` (Boolean, not null, server_default='false')
- `op.create_table('smart_playlists', ...)` with all columns

If any are missing, add them manually using this pattern:
```python
op.add_column('songs', sa.Column('rating', sa.Integer(), nullable=True))
op.add_column('songs', sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default='false'))
op.add_column('albums', sa.Column('rating', sa.Integer(), nullable=True))
op.add_column('artists', sa.Column('is_preferred', sa.Boolean(), nullable=False, server_default='false'))
```

- [ ] **Step 4: Apply migration**

```bash
# In Docker (production path):
ssh contabo "cd /root/euphony && docker compose -f docker-compose.euphony.yml exec backend alembic upgrade head"

# Or locally:
cd backend && alembic upgrade head
```

Expected output ends with: `Running upgrade ... -> ..., add_rating_favorites_smart_playlists`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/alembic/versions/0005_rating_favorites_smart_playlists.py
git commit -m "feat: add rating, is_favorite, is_preferred columns and smart_playlists table"
```

---

## Task 2: Schemas for new fields and SmartPlaylist

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Update SongBase and SongUpdate to include rating and is_favorite**

In `SongBase`, add:
```python
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
```

In `SongUpdate`, add:
```python
    rating: Optional[int] = None
    is_favorite: Optional[bool] = None
```

In `SongRead`, add (it inherits from SongBase so rating and is_favorite are already there — just verify they appear in the model_config block).

- [ ] **Step 2: Update AlbumBase and AlbumUpdate to include rating**

In `AlbumBase`, add:
```python
    rating: Optional[int] = None
```

In `AlbumUpdate`, add:
```python
    rating: Optional[int] = None
```

- [ ] **Step 3: Update ArtistBase and ArtistUpdate to include is_preferred**

In `ArtistBase`, add:
```python
    is_preferred: bool = False
```

In `ArtistUpdate`, add:
```python
    is_preferred: Optional[bool] = None
```

- [ ] **Step 4: Add SmartPlaylist schemas at the end of schemas.py**

```python
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
```

Add `Any` to the imports at the top of schemas.py:
```python
from typing import Any, List, Optional
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add rating/favorite/preferred and SmartPlaylist schemas"
```

---

## Task 3: PATCH endpoints for rating, favorite, preferred

**Files:**
- Modify: `backend/app/routers/songs.py`
- Modify: `backend/app/routers/albums.py`
- Modify: `backend/app/routers/artists.py`

- [ ] **Step 1: Add PATCH /songs/{id}/rating and /songs/{id}/favorite in songs.py**

At the end of `backend/app/routers/songs.py`, add:

```python
class RatingBody(BaseModel):
    rating: Optional[int] = None  # null clears it

@router.patch("/{song_id}/rating", response_model=schemas.SongRead)
def set_song_rating(song_id: UUID, body: RatingBody, db: Session = Depends(get_db)):
    song = _load_song(db, song_id)
    if body.rating is not None and not (1 <= body.rating <= 10):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Rating must be between 1 and 10")
    song.rating = body.rating
    db.commit()
    db.refresh(song)
    return _load_song(db, song_id)

@router.patch("/{song_id}/favorite", response_model=schemas.SongRead)
def toggle_song_favorite(song_id: UUID, db: Session = Depends(get_db)):
    song = _load_song(db, song_id)
    song.is_favorite = not song.is_favorite
    db.commit()
    return _load_song(db, song_id)
```

Also add `Optional` to imports if not present:
```python
from typing import List, Optional
from pydantic import BaseModel
```

- [ ] **Step 2: Add PATCH /albums/{id}/rating in albums.py**

At the end of `backend/app/routers/albums.py`, add:

```python
from typing import Optional
from pydantic import BaseModel

class AlbumRatingBody(BaseModel):
    rating: Optional[int] = None

@router.patch("/{album_id}/rating", response_model=schemas.AlbumRead)
def set_album_rating(album_id: UUID, body: AlbumRatingBody, db: Session = Depends(get_db)):
    album = _load_album(db, album_id)
    if body.rating is not None and not (1 <= body.rating <= 10):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Rating must be between 1 and 10")
    album.rating = body.rating
    db.commit()
    db.refresh(album)
    return album
```

- [ ] **Step 3: Add PATCH /artists/{id}/preferred in artists.py**

At the end of `backend/app/routers/artists.py`, add:

```python
@router.patch("/{artist_id}/preferred", response_model=schemas.ArtistRead)
def toggle_artist_preferred(artist_id: UUID, db: Session = Depends(get_db)):
    artist = db.query(models.Artist).filter(models.Artist.id == artist_id).first()
    if not artist:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Artist not found")
    artist.is_preferred = not artist.is_preferred
    db.commit()
    db.refresh(artist)
    return artist
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/songs.py backend/app/routers/albums.py backend/app/routers/artists.py
git commit -m "feat: add PATCH endpoints for song rating/favorite and artist preferred"
```

---

## Task 4: Smart playlist query engine and router

**Files:**
- Create: `backend/app/routers/smart_playlists.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the router file**

Create `backend/app/routers/smart_playlists.py`:

```python
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/smart-playlists", tags=["smart-playlists"])


# ---------------------------------------------------------------------------
# Query engine
# ---------------------------------------------------------------------------

def _build_filter(condition: schemas.SmartPlaylistCondition):
    """Return a SQLAlchemy filter clause for one condition, or None if unsupported."""
    field = condition.field
    op = condition.op
    value = condition.value

    # ---- String fields on Song ----
    if field == "album":
        col = models.Song.title  # we join Album and filter on Album.title below
        return _str_filter(models.Album.title, op, value)

    if field == "genre":
        return _str_filter(models.Genre.name, op, value)

    if field == "mood":
        return _str_filter(models.Mood.name, op, value)

    if field == "artist":
        return _str_filter(models.Artist.name, op, value)

    # ---- Year ----
    if field == "year":
        return _int_filter(models.Song.year, op, value)

    # ---- Availability ----
    if field == "availability":
        if op == "is":
            return models.Song.availability == value
        if op == "is_not":
            return models.Song.availability != value

    # ---- Rating ----
    if field == "rating":
        return _int_filter(models.Song.rating, op, value)

    # ---- Favorite ----
    if field == "is_favorite":
        return models.Song.is_favorite == bool(value)

    # ---- Artist preferred ----
    if field == "artist_preferred":
        return models.Artist.is_preferred == bool(value)

    return None


def _str_filter(col, op, value):
    v = str(value)
    if op == "contains":      return col.ilike(f"%{v}%")
    if op == "not_contains":  return ~col.ilike(f"%{v}%")
    if op == "is":            return col.ilike(v)
    if op == "is_not":        return ~col.ilike(v)
    if op == "starts_with":   return col.ilike(f"{v}%")
    if op == "ends_with":     return col.ilike(f"%{v}")
    return None


def _int_filter(col, op, value):
    if op == "is":      return col == int(value)
    if op == "is_not":  return col != int(value)
    if op == "gt":      return col > int(value)
    if op == "lt":      return col < int(value)
    if op == "between":
        lo, hi = int(value[0]), int(value[1])
        return col.between(lo, hi)
    return None


def _execute_conditions(
    db: Session,
    conditions: List[schemas.SmartPlaylistCondition],
    match_all: bool,
) -> List[models.Song]:
    """Build and run the smart playlist query. Returns songs ordered by year ASC, nulls last."""
    from sqlalchemy.orm import selectinload

    q = (
        db.query(models.Song)
        .outerjoin(models.SongArtist, models.SongArtist.song_id == models.Song.id)
        .outerjoin(models.Artist, models.Artist.id == models.SongArtist.artist_id)
        .outerjoin(models.Album, models.Album.id == models.Song.album_id)
        .outerjoin(models.SongGenre, models.SongGenre.song_id == models.Song.id)
        .outerjoin(models.Genre, models.Genre.id == models.SongGenre.genre_id)
        .outerjoin(models.SongMood, models.SongMood.song_id == models.Song.id)
        .outerjoin(models.Mood, models.Mood.id == models.SongMood.mood_id)
        .options(
            selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist),
            selectinload(models.Song.album),
            selectinload(models.Song.song_genres).selectinload(models.SongGenre.genre),
            selectinload(models.Song.song_moods).selectinload(models.SongMood.mood),
        )
        .distinct()
    )

    clauses = [c for cond in conditions if (c := _build_filter(cond)) is not None]

    if clauses:
        combined = and_(*clauses) if match_all else or_(*clauses)
        q = q.filter(combined)

    return q.order_by(models.Song.year.asc().nulls_last()).all()


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=List[schemas.SmartPlaylistRead])
def list_smart_playlists(db: Session = Depends(get_db)):
    return db.query(models.SmartPlaylist).order_by(models.SmartPlaylist.name).all()


@router.post("", response_model=schemas.SmartPlaylistRead, status_code=201)
def create_smart_playlist(data: schemas.SmartPlaylistCreate, db: Session = Depends(get_db)):
    pl = models.SmartPlaylist(
        name=data.name,
        match_all=data.match_all,
        conditions=[c.model_dump() for c in data.conditions],
    )
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return pl


@router.get("/{playlist_id}", response_model=schemas.SmartPlaylistPreviewResponse)
def get_smart_playlist(playlist_id: UUID, db: Session = Depends(get_db)):
    pl = db.query(models.SmartPlaylist).filter(models.SmartPlaylist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    conditions = [schemas.SmartPlaylistCondition(**c) for c in pl.conditions]
    songs = _execute_conditions(db, conditions, pl.match_all)
    return schemas.SmartPlaylistPreviewResponse(song_count=len(songs), songs=songs)


@router.put("/{playlist_id}", response_model=schemas.SmartPlaylistRead)
def update_smart_playlist(
    playlist_id: UUID, data: schemas.SmartPlaylistUpdate, db: Session = Depends(get_db)
):
    pl = db.query(models.SmartPlaylist).filter(models.SmartPlaylist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    if data.name is not None:
        pl.name = data.name
    if data.match_all is not None:
        pl.match_all = data.match_all
    if data.conditions is not None:
        pl.conditions = [c.model_dump() for c in data.conditions]
    db.commit()
    db.refresh(pl)
    return pl


@router.delete("/{playlist_id}", status_code=204)
def delete_smart_playlist(playlist_id: UUID, db: Session = Depends(get_db)):
    pl = db.query(models.SmartPlaylist).filter(models.SmartPlaylist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    db.delete(pl)
    db.commit()


@router.post("/preview", response_model=schemas.SmartPlaylistPreviewResponse)
def preview_smart_playlist(data: schemas.SmartPlaylistPreviewRequest, db: Session = Depends(get_db)):
    """Stateless preview — evaluates conditions without saving. Used by the builder UI."""
    songs = _execute_conditions(db, data.conditions, data.match_all)
    return schemas.SmartPlaylistPreviewResponse(song_count=len(songs), songs=songs)


@router.get("/{playlist_id}/export/m3u", response_class=PlainTextResponse)
def export_smart_playlist_m3u(playlist_id: UUID, db: Session = Depends(get_db)):
    pl = db.query(models.SmartPlaylist).filter(models.SmartPlaylist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    conditions = [schemas.SmartPlaylistCondition(**c) for c in pl.conditions]
    songs = _execute_conditions(db, conditions, pl.match_all)

    lines = ["#EXTM3U"]
    for song in songs:
        principals = [sa.artist.name for sa in song.song_artists if sa.role == "principal"]
        artist_str = ", ".join(principals) if principals else "Unknown"
        duration = song.duration if song.duration else -1
        lines.append(f"#EXTINF:{duration},{artist_str} - {song.title}")
        lines.append(song.title)  # no local path available

    content = "\n".join(lines)
    filename = pl.name.replace(" ", "_")
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f'attachment; filename="{filename}.m3u"'},
    )
```

- [ ] **Step 2: Register the router in main.py**

In `backend/app/main.py`, add the import:
```python
from app.routers import songs, playlists, artists, albums, genres, moods, import_routes, enrich, auth, smart_playlists
```

And register it with the protected routes:
```python
app.include_router(smart_playlists.router, prefix="/api", dependencies=_auth_dep)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/smart_playlists.py backend/app/main.py
git commit -m "feat: smart playlist query engine and CRUD/preview/M3U endpoints"
```

---

## Task 5: Frontend API client

**Files:**
- Create: `frontend/src/api/smart_playlists.js`
- Modify: `frontend/src/api/songs.js`
- Modify: `frontend/src/api/albums.js`
- Modify: `frontend/src/api/artists.js`

- [ ] **Step 1: Create smart_playlists.js**

Create `frontend/src/api/smart_playlists.js`:

```js
import api from './client'

export const getSmartPlaylists = () =>
  api.get('/smart-playlists').then(r => r.data)

export const createSmartPlaylist = (data) =>
  api.post('/smart-playlists', data).then(r => r.data)

export const getSmartPlaylist = (id) =>
  api.get(`/smart-playlists/${id}`).then(r => r.data)

export const updateSmartPlaylist = (id, data) =>
  api.put(`/smart-playlists/${id}`, data).then(r => r.data)

export const deleteSmartPlaylist = (id) =>
  api.delete(`/smart-playlists/${id}`)

export const previewSmartPlaylist = (data) =>
  api.post('/smart-playlists/preview', data).then(r => r.data)

export const exportSmartPlaylistM3U = async (id, name) => {
  const res = await api.get(`/smart-playlists/${id}/export/m3u`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.m3u`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Add rating/favorite to songs.js**

Append to `frontend/src/api/songs.js`:

```js
export const setSongRating  = (id, rating) => api.patch(`/songs/${id}/rating`, { rating }).then(r => r.data)
export const toggleSongFavorite = (id) => api.patch(`/songs/${id}/favorite`).then(r => r.data)
```

- [ ] **Step 3: Add rating to albums.js**

Append to `frontend/src/api/albums.js`:

```js
export const setAlbumRating = (id, rating) => api.patch(`/albums/${id}/rating`, { rating }).then(r => r.data)
```

- [ ] **Step 4: Add preferred to artists.js**

Append to `frontend/src/api/artists.js`:

```js
export const toggleArtistPreferred = (id) => api.patch(`/artists/${id}/preferred`).then(r => r.data)
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/smart_playlists.js frontend/src/api/songs.js frontend/src/api/albums.js frontend/src/api/artists.js
git commit -m "feat: API client functions for smart playlists, rating, and favorites"
```

---

## Task 6: RatingStars reusable component

**Files:**
- Create: `frontend/src/components/RatingStars.jsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/RatingStars.jsx`:

```jsx
import { useState } from 'react'

/**
 * RatingStars — 5 stars visual + optional number input.
 * rating: 1–10 or null
 * onChange(newRating): called with 1–10 or null (cleared)
 * compact: if true, hide the number input
 */
export default function RatingStars({ rating, onChange, compact = false }) {
  const [hovered, setHovered] = useState(null)

  // 5 stars, each star = 2 points (1★=2, 2★=4 ... 5★=10)
  const filledStars = rating ? Math.round(rating / 2) : 0
  const displayStars = hovered !== null ? hovered : filledStars

  const handleStarClick = (starIndex) => {
    // starIndex is 1–5. clicking the same filled star clears rating
    const newRating = starIndex * 2
    if (newRating === rating) {
      onChange(null)
    } else {
      onChange(newRating)
    }
  }

  const handleNumberChange = (e) => {
    const val = parseInt(e.target.value, 10)
    if (!e.target.value) { onChange(null); return }
    if (val >= 1 && val <= 10) onChange(val)
  }

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => handleStarClick(star)}
          className="text-lg leading-none transition-colors focus:outline-none"
          style={{ color: star <= displayStars ? '#f59e0b' : '#3d3d5c' }}
          aria-label={`${star * 2} / 10`}
        >
          {star <= displayStars ? '★' : '☆'}
        </button>
      ))}
      {!compact && (
        <input
          type="number"
          min="1"
          max="10"
          value={rating ?? ''}
          onChange={handleNumberChange}
          onClick={e => e.stopPropagation()}
          placeholder="—"
          className="w-10 text-center text-xs bg-transparent border border-[#2e2e4a] rounded px-1 py-0.5 text-[#94a3b8] focus:outline-none focus:border-purple-500"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/RatingStars.jsx
git commit -m "feat: RatingStars component (5 stars + numeric input, 1-10 scale)"
```

---

## Task 7: SmartPlaylistBuilder modal component

**Files:**
- Create: `frontend/src/components/SmartPlaylistBuilder.jsx`

- [ ] **Step 1: Create the builder component**

Create `frontend/src/components/SmartPlaylistBuilder.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { previewSmartPlaylist, createSmartPlaylist, updateSmartPlaylist } from '../api/smart_playlists'

const FIELDS = [
  { value: 'artist',          labelKey: 'smartPlaylist.fields.artist',        type: 'string' },
  { value: 'album',           labelKey: 'smartPlaylist.fields.album',         type: 'string' },
  { value: 'genre',           labelKey: 'smartPlaylist.fields.genre',         type: 'string' },
  { value: 'mood',            labelKey: 'smartPlaylist.fields.mood',          type: 'string' },
  { value: 'year',            labelKey: 'smartPlaylist.fields.year',          type: 'int' },
  { value: 'availability',    labelKey: 'smartPlaylist.fields.availability',  type: 'availability' },
  { value: 'rating',          labelKey: 'smartPlaylist.fields.rating',        type: 'rating' },
  { value: 'is_favorite',     labelKey: 'smartPlaylist.fields.isFavorite',    type: 'bool' },
  { value: 'artist_preferred',labelKey: 'smartPlaylist.fields.artistPreferred', type: 'bool' },
]

const STRING_OPS = [
  { value: 'contains',     labelKey: 'smartPlaylist.ops.contains' },
  { value: 'not_contains', labelKey: 'smartPlaylist.ops.notContains' },
  { value: 'is',           labelKey: 'smartPlaylist.ops.is' },
  { value: 'is_not',       labelKey: 'smartPlaylist.ops.isNot' },
  { value: 'starts_with',  labelKey: 'smartPlaylist.ops.startsWith' },
  { value: 'ends_with',    labelKey: 'smartPlaylist.ops.endsWith' },
]

const INT_OPS = [
  { value: 'is',      labelKey: 'smartPlaylist.ops.is' },
  { value: 'is_not',  labelKey: 'smartPlaylist.ops.isNot' },
  { value: 'gt',      labelKey: 'smartPlaylist.ops.gt' },
  { value: 'lt',      labelKey: 'smartPlaylist.ops.lt' },
  { value: 'between', labelKey: 'smartPlaylist.ops.between' },
]

function getOpsForType(type) {
  if (type === 'string') return STRING_OPS
  if (type === 'int' || type === 'rating') return INT_OPS
  return []
}

function defaultCondition() {
  return { field: 'artist', op: 'contains', value: '' }
}

function ConditionRow({ cond, onChange, onRemove, t }) {
  const fieldDef = FIELDS.find(f => f.value === cond.field) || FIELDS[0]
  const ops = getOpsForType(fieldDef.type)

  const handleFieldChange = (newField) => {
    const newDef = FIELDS.find(f => f.value === newField)
    const newOp = getOpsForType(newDef.type)[0]?.value || 'is'
    const newValue = newDef.type === 'bool' ? true
      : newDef.type === 'availability' ? 'available'
      : newDef.type === 'int' || newDef.type === 'rating' ? 0
      : ''
    onChange({ field: newField, op: newOp, value: newValue })
  }

  const handleOpChange = (newOp) => {
    const newValue = newOp === 'between' ? [cond.value || 0, cond.value || 0] : (Array.isArray(cond.value) ? cond.value[0] : cond.value)
    onChange({ ...cond, op: newOp, value: newValue })
  }

  const renderValue = () => {
    if (fieldDef.type === 'string') {
      return (
        <input
          type="text"
          value={cond.value}
          onChange={e => onChange({ ...cond, value: e.target.value })}
          className="flex-1 px-3 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
        />
      )
    }
    if ((fieldDef.type === 'int' || fieldDef.type === 'rating') && cond.op === 'between') {
      const vals = Array.isArray(cond.value) ? cond.value : [0, 0]
      return (
        <div className="flex items-center gap-2 flex-1">
          <input type="number" value={vals[0]} onChange={e => onChange({ ...cond, value: [parseInt(e.target.value) || 0, vals[1]] })}
            className="w-20 px-2 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
          <span className="text-[#94a3b8] text-sm">—</span>
          <input type="number" value={vals[1]} onChange={e => onChange({ ...cond, value: [vals[0], parseInt(e.target.value) || 0] })}
            className="w-20 px-2 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
        </div>
      )
    }
    if (fieldDef.type === 'int' || fieldDef.type === 'rating') {
      return (
        <input type="number" value={cond.value} onChange={e => onChange({ ...cond, value: parseInt(e.target.value) || 0 })}
          className="w-24 px-3 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
      )
    }
    if (fieldDef.type === 'availability') {
      return (
        <select value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })}
          className="flex-1 px-3 py-1.5 bg-[#1e1e30] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
          <option value="available">{t('smartPlaylist.availability.available')}</option>
          <option value="wishlist">{t('smartPlaylist.availability.wishlist')}</option>
          <option value="not_available">{t('smartPlaylist.availability.notAvailable')}</option>
        </select>
      )
    }
    if (fieldDef.type === 'bool') {
      return (
        <select value={String(cond.value)} onChange={e => onChange({ ...cond, value: e.target.value === 'true' })}
          className="flex-1 px-3 py-1.5 bg-[#1e1e30] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </select>
      )
    }
    return null
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <select value={cond.field} onChange={e => handleFieldChange(e.target.value)}
        className="w-36 px-2 py-1.5 bg-[#1e1e30] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
        {FIELDS.map(f => <option key={f.value} value={f.value}>{t(f.labelKey)}</option>)}
      </select>

      {ops.length > 0 && (
        <select value={cond.op} onChange={e => handleOpChange(e.target.value)}
          className="w-32 px-2 py-1.5 bg-[#1e1e30] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
          {ops.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
        </select>
      )}

      {renderValue()}

      <button onClick={onRemove} className="px-2 py-1 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors text-sm">×</button>
    </div>
  )
}

export default function SmartPlaylistBuilder({ existing, onClose, onSaved }) {
  const { t } = useTranslation()
  const [name, setName] = useState(existing?.name || '')
  const [matchAll, setMatchAll] = useState(existing?.match_all ?? true)
  const [conditions, setConditions] = useState(existing?.conditions?.length ? existing.conditions : [defaultCondition()])
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  const runPreview = useCallback(async () => {
    try {
      const res = await previewSmartPlaylist({ match_all: matchAll, conditions })
      setPreview(res.song_count)
    } catch { setPreview(null) }
  }, [matchAll, conditions])

  useEffect(() => {
    const t = setTimeout(runPreview, 400)
    return () => clearTimeout(t)
  }, [runPreview])

  const updateCondition = (i, updated) => {
    setConditions(prev => prev.map((c, idx) => idx === i ? updated : c))
  }

  const removeCondition = (i) => {
    setConditions(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const payload = { name, match_all: matchAll, conditions }
      const result = existing
        ? await updateSmartPlaylist(existing.id, payload)
        : await createSmartPlaylist(payload)
      onSaved(result)
    } catch { alert('Error saving smart playlist') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">
          {existing ? t('smartPlaylist.edit') : t('smartPlaylist.new')}
        </h2>

        {/* Name */}
        <div className="mb-4">
          <label className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1 block">{t('common.name')}</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Match toggle */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-[#94a3b8]">{t('smartPlaylist.match')}</span>
          <button
            onClick={() => setMatchAll(true)}
            className={`px-3 py-1 rounded-lg transition-colors ${matchAll ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'}`}
          >
            {t('smartPlaylist.matchAll')}
          </button>
          <button
            onClick={() => setMatchAll(false)}
            className={`px-3 py-1 rounded-lg transition-colors ${!matchAll ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'}`}
          >
            {t('smartPlaylist.matchAny')}
          </button>
        </div>

        {/* Conditions */}
        <div className="mb-2">
          <label className="text-xs text-[#94a3b8] uppercase tracking-wider mb-2 block">{t('smartPlaylist.conditions')}</label>
          {conditions.map((cond, i) => (
            <ConditionRow
              key={i}
              cond={cond}
              onChange={updated => updateCondition(i, updated)}
              onRemove={() => removeCondition(i)}
              t={t}
            />
          ))}
          <button
            onClick={() => setConditions(prev => [...prev, defaultCondition()])}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors mt-1"
          >
            {t('smartPlaylist.addCondition')}
          </button>
        </div>

        {/* Preview */}
        {preview !== null && (
          <div className="my-4 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
            {t('smartPlaylist.preview', { n: preview })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SmartPlaylistBuilder.jsx
git commit -m "feat: SmartPlaylistBuilder modal with iTunes-style condition rows and live preview"
```

---

## Task 8: Playlists page — add Smart tab

**Files:**
- Modify: `frontend/src/pages/Playlists.jsx`

- [ ] **Step 1: Rewrite Playlists.jsx to add Smart tab**

Replace the contents of `frontend/src/pages/Playlists.jsx`. Keep the existing `CreateModal` component unchanged. Add this after it:

```jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getPlaylists, createPlaylist, deletePlaylist } from '../api/playlists'
import { getSmartPlaylists, deleteSmartPlaylist, exportSmartPlaylistM3U } from '../api/smart_playlists'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import SmartPlaylistBuilder from '../components/SmartPlaylistBuilder'

// ... keep existing CreateModal unchanged ...

function SmartTab() {
  const [smartPlaylists, setSmartPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editing, setEditing] = useState(null)
  const { t } = useTranslation()

  const load = async () => {
    try {
      setLoading(true); setError(null)
      setSmartPlaylists(await getSmartPlaylists())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm(t('smartPlaylist.deleteConfirm'))) return
    await deleteSmartPlaylist(id)
    load()
  }

  const handleExport = async (e, id, name) => {
    e.stopPropagation()
    await exportSmartPlaylistM3U(id, name)
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { setEditing(null); setShowBuilder(true) }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('smartPlaylist.new')}
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && smartPlaylists.length === 0 && (
        <EmptyState
          title={t('smartPlaylist.empty.title')}
          description={t('smartPlaylist.empty.desc')}
          action={
            <button onClick={() => setShowBuilder(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
              {t('smartPlaylist.new')}
            </button>
          }
        />
      )}

      {!loading && !error && smartPlaylists.length > 0 && (
        <div className="space-y-2">
          {smartPlaylists.map(pl => (
            <div key={pl.id} className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl px-4 py-3 flex items-center justify-between hover:border-purple-500/30 transition-colors">
              <div>
                <p className="font-medium text-sm text-[#e2e8f0]">{pl.name}</p>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  {pl.conditions.length} {t('smartPlaylist.conditionCount')} · {pl.match_all ? t('smartPlaylist.matchAll') : t('smartPlaylist.matchAny')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => handleExport(e, pl.id, pl.name)}
                  className="px-3 py-1.5 text-xs bg-[#1e1e30] hover:bg-[#2e2e4a] text-[#94a3b8] hover:text-white rounded-lg transition-colors"
                >
                  M3U ↓
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setEditing(pl); setShowBuilder(true) }}
                  className="px-3 py-1.5 text-xs bg-[#1e1e30] hover:bg-[#2e2e4a] text-[#94a3b8] hover:text-white rounded-lg transition-colors"
                >
                  {t('common.edit')}
                </button>
                <button
                  onClick={e => handleDelete(e, pl.id)}
                  className="px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <SmartPlaylistBuilder
          existing={editing}
          onClose={() => { setShowBuilder(false); setEditing(null) }}
          onSaved={() => { setShowBuilder(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

export default function Playlists() {
  const [tab, setTab] = useState('normal')
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getPlaylists({ search, limit: 100 })
      setPlaylists(data.items)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this playlist?')) return
    await deletePlaylist(id)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('playlists.title')}</h1>
        {tab === 'normal' && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('playlists.new')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('normal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'normal' ? 'bg-purple-600 text-white' : 'bg-[#1a1a24] text-[#94a3b8] hover:text-white hover:bg-[#22223a]'}`}
        >
          {t('playlists.tab.normal')}
        </button>
        <button
          onClick={() => setTab('smart')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'smart' ? 'bg-purple-600 text-white' : 'bg-[#1a1a24] text-[#94a3b8] hover:text-white hover:bg-[#22223a]'}`}
        >
          {t('smartPlaylist.tab')}
        </button>
      </div>

      {tab === 'smart' ? (
        <SmartTab />
      ) : (
        <>
          <input
            type="text"
            placeholder={t('playlists.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm mb-6 px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
          />

          {loading && <LoadingSpinner />}
          {error && <ErrorState message={error} onRetry={load} />}

          {!loading && !error && playlists.length === 0 && (
            <EmptyState
              title={t('playlists.empty.title')}
              description={t('playlists.empty.desc')}
              action={
                <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
                  {t('playlists.new')}
                </button>
              }
            />
          )}

          {!loading && !error && playlists.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {playlists.map(pl => (
                <div
                  key={pl.id}
                  onClick={() => navigate(`/playlists/${pl.id}`)}
                  className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-4 cursor-pointer hover:border-purple-500/50 hover:bg-[#22223a] transition-all group"
                >
                  <div className="w-full aspect-square rounded-lg bg-purple-700/20 flex items-center justify-center mb-3">
                    <svg className="w-10 h-10 text-purple-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <p className="font-medium text-sm truncate">{pl.name}</p>
                  <p className="text-[#94a3b8] text-xs mt-0.5">{pl.song_count} {t('common.songs')}</p>
                  {pl.description && <p className="text-[#94a3b8] text-xs mt-1 truncate">{pl.description}</p>}
                  <button
                    onClick={e => handleDelete(e, pl.id)}
                    className="mt-2 text-xs text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {showCreate && (
            <CreateModal
              onClose={() => setShowCreate(false)}
              onCreate={(pl) => navigate(`/playlists/${pl.id}`)}
            />
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Playlists.jsx
git commit -m "feat: add Smart tab to Playlists page with list, edit, delete, M3U export"
```

---

## Task 9: Library — add ♥ favorite and rating per row

**Files:**
- Modify: `frontend/src/pages/Library.jsx`

- [ ] **Step 1: Import new dependencies at top of Library.jsx**

Add to the imports section:
```jsx
import { setSongRating, toggleSongFavorite } from '../api/songs'
import RatingStars from '../components/RatingStars'
```

- [ ] **Step 2: Add handlers for rating and favorite**

Inside the `Library` component, after existing state declarations, add:
```jsx
const handleRating = async (songId, rating) => {
  await setSongRating(songId, rating)
  // optimistically update local state
  setSongs(prev => prev.map(s => s.id === songId ? { ...s, rating } : s))
}

const handleFavorite = async (songId) => {
  const updated = await toggleSongFavorite(songId)
  setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_favorite: updated.is_favorite } : s))
}
```

- [ ] **Step 3: Add ♥ and rating to each song row**

Locate the song row rendering in Library.jsx (the `<tr>` or row `<div>` for each song). Add rating stars and heart icon. The exact location depends on the current row layout — find the row element and append before the action buttons:

```jsx
{/* Rating */}
<td className="px-2 py-2 whitespace-nowrap">
  <RatingStars
    rating={song.rating}
    onChange={(r) => handleRating(song.id, r)}
    compact
  />
</td>

{/* Favorite */}
<td className="px-2 py-2 whitespace-nowrap">
  <button
    onClick={e => { e.stopPropagation(); handleFavorite(song.id) }}
    className={`text-lg transition-colors ${song.is_favorite ? 'text-pink-500' : 'text-[#3d3d5c] hover:text-pink-400'}`}
    title={song.is_favorite ? t('favorite.remove') : t('favorite.add')}
  >
    {song.is_favorite ? '♥' : '♡'}
  </button>
</td>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Library.jsx
git commit -m "feat: add rating stars and favorite heart to Library song rows"
```

---

## Task 10: Artists — add ★ preferred toggle

**Files:**
- Modify: `frontend/src/pages/Artists.jsx`
- Modify: `frontend/src/pages/ArtistDetail.jsx`

- [ ] **Step 1: Add preferred toggle to Artists list**

In `frontend/src/pages/Artists.jsx`, add import:
```jsx
import { toggleArtistPreferred } from '../api/artists'
```

Add handler in the component:
```jsx
const handlePreferred = async (e, artistId) => {
  e.stopPropagation()
  const updated = await toggleArtistPreferred(artistId)
  setArtists(prev => prev.map(a => a.id === artistId ? { ...a, is_preferred: updated.is_preferred } : a))
}
```

In each artist row/card, add the star button:
```jsx
<button
  onClick={e => handlePreferred(e, artist.id)}
  className={`text-xl transition-colors ${artist.is_preferred ? 'text-amber-400' : 'text-[#3d3d5c] hover:text-amber-300'}`}
  title={artist.is_preferred ? t('artist.removePreferred') : t('artist.addPreferred')}
>
  {artist.is_preferred ? '★' : '☆'}
</button>
```

- [ ] **Step 2: Add preferred toggle to ArtistDetail**

In `frontend/src/pages/ArtistDetail.jsx`, add import:
```jsx
import { toggleArtistPreferred } from '../api/artists'
```

Find where the artist name/header is rendered and add the star next to it:
```jsx
<button
  onClick={async () => {
    const updated = await toggleArtistPreferred(artist.id)
    setArtist(a => ({ ...a, is_preferred: updated.is_preferred }))
  }}
  className={`text-2xl transition-colors ${artist.is_preferred ? 'text-amber-400' : 'text-[#3d3d5c] hover:text-amber-300'}`}
  title={artist.is_preferred ? t('artist.removePreferred') : t('artist.addPreferred')}
>
  {artist.is_preferred ? '★' : '☆'}
</button>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Artists.jsx frontend/src/pages/ArtistDetail.jsx
git commit -m "feat: add preferred artist star toggle to Artists list and ArtistDetail"
```

---

## Task 11: Translations

**Files:**
- Modify: `frontend/src/i18n/locales/es.json`
- Modify: `frontend/src/i18n/locales/en.json`
- Modify: `frontend/src/i18n/locales/ja.json`

- [ ] **Step 1: Add all new keys to es.json**

Add these keys (find a logical location, e.g. after `playlists.*` keys):
```json
  "playlists.tab.normal": "Playlists",

  "smartPlaylist.tab": "Smart ✨",
  "smartPlaylist.new": "Nueva Smart Playlist",
  "smartPlaylist.edit": "Editar Smart Playlist",
  "smartPlaylist.deleteConfirm": "¿Eliminar esta smart playlist?",
  "smartPlaylist.conditionCount": "condiciones",
  "smartPlaylist.match": "Cumplir",
  "smartPlaylist.matchAll": "TODAS",
  "smartPlaylist.matchAny": "CUALQUIERA",
  "smartPlaylist.conditions": "Condiciones",
  "smartPlaylist.addCondition": "+ Añadir condición",
  "smartPlaylist.preview": "{{n}} canciones coinciden",
  "smartPlaylist.export": "Exportar M3U",
  "smartPlaylist.empty.title": "No hay smart playlists",
  "smartPlaylist.empty.desc": "Crea tu primera smart playlist con reglas automáticas",

  "smartPlaylist.fields.artist": "Artista",
  "smartPlaylist.fields.album": "Álbum",
  "smartPlaylist.fields.genre": "Género",
  "smartPlaylist.fields.mood": "Mood",
  "smartPlaylist.fields.year": "Año",
  "smartPlaylist.fields.availability": "Disponibilidad",
  "smartPlaylist.fields.rating": "Rating",
  "smartPlaylist.fields.isFavorite": "Favorita",
  "smartPlaylist.fields.artistPreferred": "Artista preferido",

  "smartPlaylist.ops.contains": "contiene",
  "smartPlaylist.ops.notContains": "no contiene",
  "smartPlaylist.ops.is": "es",
  "smartPlaylist.ops.isNot": "no es",
  "smartPlaylist.ops.startsWith": "empieza en",
  "smartPlaylist.ops.endsWith": "acaba en",
  "smartPlaylist.ops.gt": "mayor que",
  "smartPlaylist.ops.lt": "menor que",
  "smartPlaylist.ops.between": "entre",

  "smartPlaylist.availability.available": "Disponible",
  "smartPlaylist.availability.wishlist": "Wishlist",
  "smartPlaylist.availability.notAvailable": "No disponible",

  "rating.label": "Rating",
  "favorite.add": "Marcar como favorita",
  "favorite.remove": "Quitar de favoritas",
  "artist.addPreferred": "Marcar como preferido",
  "artist.removePreferred": "Quitar de preferidos",
  "artist.preferred": "Preferido",

  "common.yes": "Sí",
  "common.no": "No",
  "common.name": "Nombre"
```

- [ ] **Step 2: Add all new keys to en.json**

```json
  "playlists.tab.normal": "Playlists",

  "smartPlaylist.tab": "Smart ✨",
  "smartPlaylist.new": "New Smart Playlist",
  "smartPlaylist.edit": "Edit Smart Playlist",
  "smartPlaylist.deleteConfirm": "Delete this smart playlist?",
  "smartPlaylist.conditionCount": "conditions",
  "smartPlaylist.match": "Match",
  "smartPlaylist.matchAll": "ALL",
  "smartPlaylist.matchAny": "ANY",
  "smartPlaylist.conditions": "Conditions",
  "smartPlaylist.addCondition": "+ Add condition",
  "smartPlaylist.preview": "{{n}} songs match",
  "smartPlaylist.export": "Export M3U",
  "smartPlaylist.empty.title": "No smart playlists yet",
  "smartPlaylist.empty.desc": "Create your first smart playlist with automatic rules",

  "smartPlaylist.fields.artist": "Artist",
  "smartPlaylist.fields.album": "Album",
  "smartPlaylist.fields.genre": "Genre",
  "smartPlaylist.fields.mood": "Mood",
  "smartPlaylist.fields.year": "Year",
  "smartPlaylist.fields.availability": "Availability",
  "smartPlaylist.fields.rating": "Rating",
  "smartPlaylist.fields.isFavorite": "Favorite",
  "smartPlaylist.fields.artistPreferred": "Preferred artist",

  "smartPlaylist.ops.contains": "contains",
  "smartPlaylist.ops.notContains": "does not contain",
  "smartPlaylist.ops.is": "is",
  "smartPlaylist.ops.isNot": "is not",
  "smartPlaylist.ops.startsWith": "starts with",
  "smartPlaylist.ops.endsWith": "ends with",
  "smartPlaylist.ops.gt": "greater than",
  "smartPlaylist.ops.lt": "less than",
  "smartPlaylist.ops.between": "between",

  "smartPlaylist.availability.available": "Available",
  "smartPlaylist.availability.wishlist": "Wishlist",
  "smartPlaylist.availability.notAvailable": "Not available",

  "rating.label": "Rating",
  "favorite.add": "Add to favorites",
  "favorite.remove": "Remove from favorites",
  "artist.addPreferred": "Mark as preferred",
  "artist.removePreferred": "Remove from preferred",
  "artist.preferred": "Preferred",

  "common.yes": "Yes",
  "common.no": "No",
  "common.name": "Name"
```

- [ ] **Step 3: Add all new keys to ja.json**

```json
  "playlists.tab.normal": "プレイリスト",

  "smartPlaylist.tab": "スマート ✨",
  "smartPlaylist.new": "新しいスマートプレイリスト",
  "smartPlaylist.edit": "スマートプレイリストを編集",
  "smartPlaylist.deleteConfirm": "このスマートプレイリストを削除しますか？",
  "smartPlaylist.conditionCount": "条件",
  "smartPlaylist.match": "一致条件",
  "smartPlaylist.matchAll": "すべて",
  "smartPlaylist.matchAny": "いずれか",
  "smartPlaylist.conditions": "条件",
  "smartPlaylist.addCondition": "+ 条件を追加",
  "smartPlaylist.preview": "{{n}}曲が一致",
  "smartPlaylist.export": "M3Uをエクスポート",
  "smartPlaylist.empty.title": "スマートプレイリストなし",
  "smartPlaylist.empty.desc": "自動ルールで最初のスマートプレイリストを作成",

  "smartPlaylist.fields.artist": "アーティスト",
  "smartPlaylist.fields.album": "アルバム",
  "smartPlaylist.fields.genre": "ジャンル",
  "smartPlaylist.fields.mood": "ムード",
  "smartPlaylist.fields.year": "年",
  "smartPlaylist.fields.availability": "入手可否",
  "smartPlaylist.fields.rating": "レーティング",
  "smartPlaylist.fields.isFavorite": "お気に入り",
  "smartPlaylist.fields.artistPreferred": "好きなアーティスト",

  "smartPlaylist.ops.contains": "含む",
  "smartPlaylist.ops.notContains": "含まない",
  "smartPlaylist.ops.is": "等しい",
  "smartPlaylist.ops.isNot": "等しくない",
  "smartPlaylist.ops.startsWith": "で始まる",
  "smartPlaylist.ops.endsWith": "で終わる",
  "smartPlaylist.ops.gt": "より大きい",
  "smartPlaylist.ops.lt": "より小さい",
  "smartPlaylist.ops.between": "の間",

  "smartPlaylist.availability.available": "入手可能",
  "smartPlaylist.availability.wishlist": "ウィッシュリスト",
  "smartPlaylist.availability.notAvailable": "入手不可",

  "rating.label": "レーティング",
  "favorite.add": "お気に入りに追加",
  "favorite.remove": "お気に入りから削除",
  "artist.addPreferred": "好きなアーティストに追加",
  "artist.removePreferred": "好きなアーティストから削除",
  "artist.preferred": "好きなアーティスト",

  "common.yes": "はい",
  "common.no": "いいえ",
  "common.name": "名前"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/locales/es.json frontend/src/i18n/locales/en.json frontend/src/i18n/locales/ja.json
git commit -m "feat: add translations for smart playlists, rating, and favorites (ES/EN/JA)"
```

---

## Task 12: Deploy to VPS

**Files:** none

- [ ] **Step 1: Sync all changed files to VPS**

```bash
rsync -av \
  backend/app/models.py \
  backend/app/schemas.py \
  backend/app/main.py \
  backend/app/routers/songs.py \
  backend/app/routers/albums.py \
  backend/app/routers/artists.py \
  backend/app/routers/smart_playlists.py \
  contabo:/root/euphony/backend/app/routers/smart_playlists.py

rsync -av backend/app/ contabo:/root/euphony/backend/app/
rsync -av backend/alembic/versions/ contabo:/root/euphony/backend/alembic/versions/
rsync -av frontend/src/ contabo:/root/euphony/frontend/src/
```

- [ ] **Step 2: Run migration on VPS**

```bash
ssh contabo "cd /root/euphony && docker compose -f docker-compose.euphony.yml exec backend alembic upgrade head"
```

Expected: `Running upgrade ... -> ..., add_rating_favorites_smart_playlists`

- [ ] **Step 3: Rebuild containers**

```bash
ssh contabo "cd /root/euphony && docker compose -f docker-compose.euphony.yml up -d --build frontend backend"
```

Expected output ends with: `Container euphony-backend-1  Started`

- [ ] **Step 4: Verify**

Open https://euphony.gedarc.com, go to Playlists → Smart tab, create a smart playlist with one condition and verify preview shows a count.

---

## Self-Review Notes

- Task 2 references `Any` from typing — added import instruction.
- `SmartPlaylistCondition.value` is typed as `Any` to handle str/int/bool/list — Pydantic v2 handles this.
- `_build_filter` for `album` field filters on `Album.title` via the join — the join is always present via `outerjoin`.
- `SongRead` includes `rating` and `is_favorite` via `SongBase` inheritance — no extra fields needed in the read schema.
- Task 9 (Library) gives guidance based on existing row structure but notes exact location depends on current code — the executor must read Library.jsx first.
