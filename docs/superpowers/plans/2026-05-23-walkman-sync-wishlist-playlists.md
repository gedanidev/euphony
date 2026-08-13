# Walkman Sync, Wishlist & Playlists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Walkman XML sync, wishlist management, and playlist import/export enhancements so the library reflects the real Walkman collection.

**Architecture:** `walkman_status` and companion columns added to `Song`. `PlaylistSong.song_id` made nullable to support unresolved playlist imports. XML parsing uses Python's built-in `plistlib`. Sync endpoint lives in `songs.py`. Playlist import is a new endpoint in `playlists.py`. Frontend gets a Wishlist page, Walkman sync UI in Settings, and multi-select in Library.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, React, Tailwind

**Spec:** `docs/superpowers/specs/2026-05-23-walkman-sync-wishlist-playlists.md`

---

## File Map

**Created:**
- `backend/alembic/versions/0007_walkman_sync_wishlist.py`
- `frontend/src/pages/Wishlist.jsx`
- `frontend/src/api/walkman.js`

**Modified:**
- `backend/app/models.py` — add 6 columns to Song, modify PlaylistSong
- `backend/app/schemas.py` — add walkman fields, new schemas
- `backend/app/routers/songs.py` — sync endpoint, wishlist endpoint, walkman_status filter
- `backend/app/routers/playlists.py` — playlist import endpoint, update M3U export
- `frontend/src/components/Layout.jsx` — add Wishlist nav item
- `frontend/src/pages/Settings.jsx` — add Walkman sync section
- `frontend/src/pages/Library.jsx` — add walkman_status filter + multi-select
- `frontend/src/api/songs.js` — add wishlist + walkman filter params
- `frontend/src/api/playlists.js` — add import endpoint call
- `frontend/src/i18n/locales/es.json` — new keys
- `frontend/src/i18n/locales/en.json` — new keys

---

## Task 1: Database Migration 0007

**Files:**
- Create: `backend/alembic/versions/0007_walkman_sync_wishlist.py`

- [ ] **Step 1: Write the migration file**

```python
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
```

- [ ] **Step 2: Apply migration**

```bash
cd backend && alembic upgrade head
```

Expected output: `Running upgrade 0006 -> 0007, walkman_sync_wishlist`

- [ ] **Step 3: Verify columns exist**

```bash
docker exec euphony-db-1 psql -U euphony euphony -c "\d songs" | grep walkman
docker exec euphony-db-1 psql -U euphony euphony -c "\d playlist_songs"
```

Expected: `walkman_status`, `walkman_path`, `walkman_play_count`, `walkman_skip_count`, `walkman_size`, `wishlist_notes` appear in songs; `raw_title`, `raw_artist`, `raw_path` appear in playlist_songs.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/0007_walkman_sync_wishlist.py
git commit -m "feat: add migration 0007 - walkman columns on songs, nullable song_id in playlist_songs"
```

---

## Task 2: Update models.py

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add walkman columns to Song**

In `backend/app/models.py`, after the `vocal_type` line in the `Song` class (around line 99), add:

```python
    walkman_status = Column(String(20), nullable=True)   # on_walkman | wishlist | removed
    walkman_path = Column(String(500), nullable=True, index=True)
    walkman_play_count = Column(Integer, nullable=True)
    walkman_skip_count = Column(Integer, nullable=True)
    walkman_size = Column(BigInteger, nullable=True)
    wishlist_notes = Column(String(500), nullable=True)
```

Add `BigInteger` to the SQLAlchemy import at the top of the file:
```python
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, UniqueConstraint, BigInteger
```

- [ ] **Step 2: Update PlaylistSong model**

Replace the `PlaylistSong` class:

```python
class PlaylistSong(Base):
    __tablename__ = "playlist_songs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playlist_id = Column(UUID(as_uuid=True), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    song_id = Column(UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    raw_title = Column(String(500), nullable=True)
    raw_artist = Column(String(500), nullable=True)
    raw_path = Column(String(500), nullable=True)

    playlist = relationship("Playlist", back_populates="playlist_songs")
    song = relationship("Song", back_populates="playlist_songs")
```

Note: unique constraint is now a partial index in the DB (handled by migration), not a Python-level `__table_args__`.

- [ ] **Step 3: Verify imports at top of models.py**

```python
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime,
    ForeignKey, UniqueConstraint, BigInteger
)
```

- [ ] **Step 4: Run a quick syntax check**

```bash
cd backend && python -c "from app.models import Song, PlaylistSong; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add walkman columns to Song, make PlaylistSong.song_id nullable"
```

---

## Task 3: Update schemas.py

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Add walkman fields to SongBase**

In `SongBase`, after `vocal_type`:

```python
    walkman_status: Optional[str] = None
    walkman_path: Optional[str] = None
    walkman_play_count: Optional[int] = None
    walkman_skip_count: Optional[int] = None
    walkman_size: Optional[int] = None
    wishlist_notes: Optional[str] = None
```

- [ ] **Step 2: Add walkman fields to SongUpdate**

In `SongUpdate`, after `vocal_type`:

```python
    walkman_status: Optional[str] = None
    walkman_path: Optional[str] = None
    walkman_play_count: Optional[int] = None
    walkman_skip_count: Optional[int] = None
    walkman_size: Optional[int] = None
    wishlist_notes: Optional[str] = None
```

- [ ] **Step 3: Update PlaylistSongRead to handle nullable song_id**

Replace `PlaylistSongRead`:

```python
class PlaylistSongRead(BaseModel):
    id: UUID
    position: int
    song: Optional[SongRead] = None
    raw_title: Optional[str] = None
    raw_artist: Optional[str] = None
    raw_path: Optional[str] = None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def is_resolved(self) -> bool:
        return self.song is not None
```

Add `computed_field` to the Pydantic import if not already there:
```python
from pydantic import BaseModel, Field, ConfigDict, computed_field
```

- [ ] **Step 4: Update PlaylistDetailRead**

Replace `songs: List[PlaylistSongRead]` field:

```python
class PlaylistDetailRead(PlaylistRead):
    playlist_songs: List[PlaylistSongRead] = []
```

Note: the frontend currently uses `songs` — this will be updated in Task 11.

- [ ] **Step 5: Add WalkmanSyncResult schema**

After the playlist schemas section:

```python
class WalkmanSyncResult(BaseModel):
    added: int
    updated: int
    wishlist_completed: int
    removed: int
    errors: List[str] = []
```

- [ ] **Step 6: Add WishlistCreate schema**

```python
class WishlistCreate(BaseModel):
    title: str
    artist_name: str
    album_name: Optional[str] = None
    wishlist_notes: Optional[str] = None
```

- [ ] **Step 7: Add PlaylistImportResult schema**

```python
class PlaylistImportResult(BaseModel):
    playlist_id: UUID
    playlist_name: str
    total: int
    matched: int
    unresolved: int
```

- [ ] **Step 8: Verify**

```bash
cd backend && python -c "from app.schemas import WalkmanSyncResult, WishlistCreate, PlaylistImportResult; print('OK')"
```

Expected: `OK`

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add walkman fields to SongBase/SongUpdate, update PlaylistSongRead, add sync/wishlist/import schemas"
```

---

## Task 4: Walkman XML Sync Endpoint

**Files:**
- Modify: `backend/app/routers/songs.py`

The sync endpoint parses the Walkman plist XML and upserts songs into the library.

- [ ] **Step 1: Add imports to songs.py**

At the top of `backend/app/routers/songs.py`, add:

```python
import plistlib
from fastapi import UploadFile, File, Query as QueryParam
```

- [ ] **Step 2: Add helper functions before the sync endpoint**

Add these functions near the top of songs.py (after existing helpers):

```python
def _get_or_create_artist_sync(db: Session, name: str) -> models.Artist:
    name = name.strip()
    artist = db.query(models.Artist).filter(models.Artist.name.ilike(name)).first()
    if not artist:
        artist = models.Artist(name=name)
        db.add(artist)
        db.flush()
    return artist


def _get_or_create_album_sync(db: Session, title: str, artist: models.Artist | None) -> models.Album:
    title = title.strip()
    q = db.query(models.Album).filter(models.Album.title.ilike(title))
    if artist:
        q = q.filter(models.Album.artist_id == artist.id)
    album = q.first()
    if not album:
        album = models.Album(title=title, artist_id=artist.id if artist else None)
        db.add(album)
        db.flush()
    return album
```

- [ ] **Step 3: Add sync endpoint — place BEFORE any `/{song_id}` route**

```python
@router.post("/walkman-sync", response_model=schemas.WalkmanSyncResult)
async def walkman_sync(
    file: UploadFile = File(...),
    clear_unlinked: bool = QueryParam(False, description="Delete songs with no walkman_path before sync (first-run cleanup)"),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        data = plistlib.loads(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid plist XML file")

    tracks = data.get("Tracks", {})
    if not tracks:
        raise HTTPException(status_code=400, detail="No tracks found in file")

    if clear_unlinked:
        db.query(models.Song).filter(
            models.Song.walkman_path.is_(None),
            models.Song.walkman_status.is_(None),
        ).delete(synchronize_session=False)
        db.commit()

    seen_paths: set[str] = set()
    seen_ids: set = set()
    added = 0
    updated = 0
    wishlist_completed = 0
    errors: list[str] = []

    for track_id, track in tracks.items():
        try:
            name = (track.get("Name") or "").strip()
            artist_name = (track.get("Artist") or "").strip()
            album_name = (track.get("Album") or "").strip()
            location = (track.get("Location") or "").strip()
            play_count = track.get("Play Count") or 0
            skip_count = track.get("Skip Count") or 0
            rating = track.get("Rating")
            size = track.get("Size")

            if not name:
                continue

            if location:
                seen_paths.add(location)

            # 1. Match by walkman_path
            song = None
            if location:
                song = db.query(models.Song).filter(
                    models.Song.walkman_path == location
                ).first()

            # 2. Fallback: match by title + artist
            if not song and name and artist_name:
                song = (
                    db.query(models.Song)
                    .join(models.SongArtist, models.SongArtist.song_id == models.Song.id, isouter=True)
                    .join(models.Artist, models.Artist.id == models.SongArtist.artist_id, isouter=True)
                    .filter(
                        models.Song.title.ilike(name),
                        models.Artist.name.ilike(artist_name),
                    )
                    .first()
                )

            if song:
                was_wishlist = song.walkman_status == "wishlist"
                song.walkman_status = "on_walkman"
                if location:
                    song.walkman_path = location
                song.walkman_play_count = play_count
                song.walkman_skip_count = skip_count
                if size is not None:
                    song.walkman_size = size
                if rating is not None:
                    song.rating = rating
                db.flush()
                seen_ids.add(song.id)
                if was_wishlist:
                    wishlist_completed += 1
                else:
                    updated += 1
            else:
                artist = _get_or_create_artist_sync(db, artist_name) if artist_name else None
                album = _get_or_create_album_sync(db, album_name, artist) if album_name else None
                new_song = models.Song(
                    title=name,
                    album_id=album.id if album else None,
                    walkman_status="on_walkman",
                    walkman_path=location or None,
                    walkman_play_count=play_count,
                    walkman_skip_count=skip_count,
                    walkman_size=size,
                    rating=rating,
                )
                db.add(new_song)
                db.flush()
                if artist:
                    db.add(models.SongArtist(
                        song_id=new_song.id,
                        artist_id=artist.id,
                        role="principal",
                        order=0,
                    ))
                db.flush()
                seen_ids.add(new_song.id)
                added += 1

        except Exception as e:
            if len(errors) < 10:
                errors.append(f"Track {track_id}: {e}")

    # Mark songs no longer in XML as removed
    removed_count = 0
    if seen_ids:
        to_remove = db.query(models.Song).filter(
            models.Song.walkman_status == "on_walkman",
            models.Song.id.notin_(seen_ids),
        )
        removed_count = to_remove.count()
        to_remove.update({"walkman_status": "removed"}, synchronize_session=False)

    db.commit()

    return schemas.WalkmanSyncResult(
        added=added,
        updated=updated,
        wishlist_completed=wishlist_completed,
        removed=removed_count,
        errors=errors,
    )
```

- [ ] **Step 4: Verify syntax**

```bash
cd backend && python -c "from app.routers.songs import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/songs.py
git commit -m "feat: add POST /songs/walkman-sync endpoint for Walkman XML import"
```

---

## Task 5: Wishlist & walkman_status Filter

**Files:**
- Modify: `backend/app/routers/songs.py`

- [ ] **Step 1: Add walkman_status filter to list_songs**

In the `list_songs` function, find where other filters are applied and add:

```python
walkman_status: Optional[str] = Query(None),
```

to the function signature, then in the query body add:

```python
    if walkman_status:
        q = q.filter(models.Song.walkman_status == walkman_status)
```

- [ ] **Step 2: Add wishlist create endpoint — place BEFORE `/{song_id}`**

```python
@router.post("/wishlist", response_model=schemas.SongRead, status_code=201)
def create_wishlist_item(body: schemas.WishlistCreate, db: Session = Depends(get_db)):
    artist = _get_or_create_artist_sync(db, body.artist_name)
    album = None
    if body.album_name:
        album = _get_or_create_album_sync(db, body.album_name, artist)

    song = models.Song(
        title=body.title,
        album_id=album.id if album else None,
        walkman_status="wishlist",
        wishlist_notes=body.wishlist_notes,
    )
    db.add(song)
    db.flush()
    db.add(models.SongArtist(song_id=song.id, artist_id=artist.id, role="principal", order=0))
    db.commit()
    db.refresh(song)
    return _load_song(song.id, db)
```

- [ ] **Step 3: Verify**

```bash
cd backend && python -c "from app.routers.songs import router; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/songs.py
git commit -m "feat: add walkman_status filter to songs list, add POST /songs/wishlist endpoint"
```

---

## Task 6: Playlist Import Endpoint & Update M3U Export

**Files:**
- Modify: `backend/app/routers/playlists.py`

- [ ] **Step 1: Add imports**

At the top of `playlists.py`, ensure:

```python
import re
import plistlib
from fastapi import UploadFile, File
```

- [ ] **Step 2: Add M3U parser helper**

```python
_EXTINF_RE = re.compile(r"^#EXTINF:\s*(-?\d+)\s*,\s*(.+)$")


def _parse_m3u(content: str) -> list[dict]:
    """Returns list of {title, artist, path} dicts."""
    lines = content.splitlines()
    entries = []
    pending = None
    for raw in lines:
        line = raw.strip()
        if not line or line == "#EXTM3U" or line.startswith("#PLAYLIST:"):
            continue
        if line.startswith("#EXTINF:"):
            m = _EXTINF_RE.match(line)
            if m:
                display = m.group(2).strip()
                if " - " in display:
                    artist, title = display.split(" - ", 1)
                else:
                    artist, title = "", display
                pending = {"title": title.strip(), "artist": artist.strip(), "path": ""}
            continue
        if not line.startswith("#"):
            if pending is not None:
                pending["path"] = line
                entries.append(pending)
                pending = None
            else:
                entries.append({"title": "", "artist": "", "path": line})
    return entries
```

- [ ] **Step 3: Add playlist import endpoint — place BEFORE `/{playlist_id}` routes**

```python
@router.post("/import", response_model=schemas.PlaylistImportResult, status_code=201)
async def import_playlist(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content_bytes = await file.read()
    filename = file.filename or "imported"
    playlist_name = filename.rsplit(".", 1)[0]

    # Parse file
    content = content_bytes.decode("utf-8", errors="replace")
    entries = _parse_m3u(content)

    if not entries:
        raise HTTPException(400, "No entries found in playlist file")

    # Create playlist
    pl = models.Playlist(name=playlist_name)
    db.add(pl)
    db.flush()

    matched = 0
    unresolved = 0

    for i, entry in enumerate(entries):
        song = None

        # Try match by walkman_path
        if entry["path"]:
            song = db.query(models.Song).filter(
                models.Song.walkman_path == entry["path"]
            ).first()

        # Fallback: title + artist
        if not song and entry["title"] and entry["artist"]:
            song = (
                db.query(models.Song)
                .join(models.SongArtist, models.SongArtist.song_id == models.Song.id, isouter=True)
                .join(models.Artist, models.Artist.id == models.SongArtist.artist_id, isouter=True)
                .filter(
                    models.Song.title.ilike(entry["title"]),
                    models.Artist.name.ilike(entry["artist"]),
                )
                .first()
            )

        ps = models.PlaylistSong(
            playlist_id=pl.id,
            song_id=song.id if song else None,
            position=i,
            raw_title=entry["title"] or None,
            raw_artist=entry["artist"] or None,
            raw_path=entry["path"] or None,
        )
        db.add(ps)

        if song:
            matched += 1
        else:
            unresolved += 1

    db.commit()

    return schemas.PlaylistImportResult(
        playlist_id=pl.id,
        playlist_name=playlist_name,
        total=len(entries),
        matched=matched,
        unresolved=unresolved,
    )
```

- [ ] **Step 4: Update M3U export to use walkman_path**

Find the `format == "m3u"` block in the `export_playlist` endpoint and replace:

```python
    if format == "m3u":
        lines = ["#EXTM3U", f"#PLAYLIST:{pl.name}"]
        skipped = 0
        for s in songs:
            path = s.walkman_path or s.file_path
            if not path:
                skipped += 1
                continue
            duration = s.duration if s.duration else -1
            artist = s.artist_display or ""
            title = s.title or ""
            lines.append(f"#EXTINF:{duration},{artist} - {title}")
            lines.append(path)
        if skipped:
            lines.insert(1, f"# WARNING: {skipped} song(s) excluded (no Walkman path)")
        content = "\n".join(lines) + "\n"
        safe_name = "".join(c for c in pl.name if c.isalnum() or c in " -_").strip()
        return StreamingResponse(
            iter([content]),
            media_type="audio/x-mpegurl",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.m3u"'},
        )
```

- [ ] **Step 5: Update _load_detail to load song in PlaylistSong**

The existing `_load_detail` uses `joinedload(models.PlaylistSong.song)` — verify this still works with nullable song_id. It should, since SQLAlchemy handles None relationships.

- [ ] **Step 6: Update _to_detail to populate songs correctly**

```python
def _to_detail(pl: models.Playlist) -> schemas.PlaylistDetailRead:
    result = schemas.PlaylistDetailRead.model_validate(pl)
    result.song_count = sum(1 for ps in pl.playlist_songs if ps.song_id is not None)
    result.songs = [schemas.PlaylistSongRead.model_validate(ps) for ps in sorted(pl.playlist_songs, key=lambda x: x.position)]
    return result
```

- [ ] **Step 7: Verify**

```bash
cd backend && python -c "from app.routers.playlists import router; print('OK')"
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers/playlists.py
git commit -m "feat: add POST /playlists/import endpoint, update M3U export to use walkman_path"
```

---

## Task 7: Frontend API Layer

**Files:**
- Create: `frontend/src/api/walkman.js`
- Modify: `frontend/src/api/songs.js`
- Modify: `frontend/src/api/playlists.js`

- [ ] **Step 1: Create walkman.js**

```js
import api from './index'

export const walkmanSync = (file, clearUnlinked = false) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/songs/walkman-sync?clear_unlinked=${clearUnlinked}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const createWishlistItem = (data) =>
  api.post('/songs/wishlist', data).then(r => r.data)
```

- [ ] **Step 2: Update songs.js — add walkman_status param to getSongs**

In `frontend/src/api/songs.js`, find the `getSongs` (or `getLibrary`) function and add `walkman_status` to the params:

```js
export const getSongs = (params = {}) =>
  api.get('/songs', { params }).then(r => r.data)
```

(If it already passes params through, no change needed — just confirm the param name matches the backend.)

- [ ] **Step 3: Update playlists.js — add import function**

```js
export const importPlaylist = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/playlists/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/walkman.js frontend/src/api/songs.js frontend/src/api/playlists.js
git commit -m "feat: add walkman API functions, playlist import, walkman_status param to getSongs"
```

---

## Task 8: i18n Keys

**Files:**
- Modify: `frontend/src/i18n/locales/es.json`
- Modify: `frontend/src/i18n/locales/en.json`

- [ ] **Step 1: Add keys to es.json**

Add the following section (merge into the existing JSON structure):

```json
"walkman": {
  "sync": "Sincronizar Walkman",
  "syncDesc": "Sube el archivo XML de backup del Walkman para actualizar tu librería.",
  "selectFile": "Seleccionar archivo XML",
  "clearUnlinked": "Primera vez: eliminar canciones sin ruta (borrar datos de prueba)",
  "syncing": "Sincronizando...",
  "syncDone": "Sincronización completada",
  "added": "añadidas",
  "updated": "actualizadas",
  "removed": "marcadas como eliminadas",
  "wishlistCompleted": "del wishlist conseguidas",
  "errors": "errores"
},
"wishlist": {
  "title": "Wishlist",
  "empty": "No tienes canciones en el wishlist",
  "emptyDesc": "Agrega canciones que quieres conseguir para el Walkman",
  "add": "Agregar al wishlist",
  "addTitle": "Artista",
  "addArtist": "Artista",
  "addAlbum": "Álbum (opcional)",
  "addNotes": "Notas (opcional)",
  "markAcquired": "Marcar como conseguida",
  "delete": "Eliminar",
  "pending": "pendientes"
},
"playlist": {
  "import": "Importar playlist",
  "importDesc": "Sube un archivo M3U para crear una playlist vinculada a tu librería.",
  "importDone": "Playlist importada",
  "matched": "canciones vinculadas",
  "unresolved": "no vinculadas"
},
"library": {
  "filterWalkman": "Estado Walkman",
  "onWalkman": "En el Walkman",
  "wishlist": "Wishlist",
  "removed": "Eliminadas",
  "allStatuses": "Todos"
}
```

- [ ] **Step 2: Add keys to en.json** (same structure, English values)

```json
"walkman": {
  "sync": "Sync Walkman",
  "syncDesc": "Upload the Walkman XML backup file to update your library.",
  "selectFile": "Select XML file",
  "clearUnlinked": "First time: delete songs with no path (clear test data)",
  "syncing": "Syncing...",
  "syncDone": "Sync complete",
  "added": "added",
  "updated": "updated",
  "removed": "marked as removed",
  "wishlistCompleted": "wishlist items completed",
  "errors": "errors"
},
"wishlist": {
  "title": "Wishlist",
  "empty": "Your wishlist is empty",
  "emptyDesc": "Add songs you want to get for your Walkman",
  "add": "Add to wishlist",
  "addTitle": "Title",
  "addArtist": "Artist",
  "addAlbum": "Album (optional)",
  "addNotes": "Notes (optional)",
  "markAcquired": "Mark as acquired",
  "delete": "Delete",
  "pending": "pending"
},
"playlist": {
  "import": "Import playlist",
  "importDesc": "Upload an M3U file to create a playlist linked to your library.",
  "importDone": "Playlist imported",
  "matched": "songs linked",
  "unresolved": "unlinked"
},
"library": {
  "filterWalkman": "Walkman status",
  "onWalkman": "On Walkman",
  "wishlist": "Wishlist",
  "removed": "Removed",
  "allStatuses": "All"
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/i18n/locales/es.json frontend/src/i18n/locales/en.json
git commit -m "feat: add i18n keys for walkman sync, wishlist, playlist import"
```

---

## Task 9: Walkman Sync UI in Settings

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`

- [ ] **Step 1: Add import**

```js
import { walkmanSync } from '../api/walkman'
```

- [ ] **Step 2: Add state in Settings component**

```js
const [xmlFile, setXmlFile] = useState(null)
const [clearUnlinked, setClearUnlinked] = useState(false)
const [syncing, setSyncing] = useState(false)
const [syncResult, setSyncResult] = useState(null)
```

- [ ] **Step 3: Add sync handler**

```js
const handleWalkmanSync = async () => {
  if (!xmlFile) return
  setSyncing(true)
  setSyncResult(null)
  try {
    const result = await walkmanSync(xmlFile, clearUnlinked)
    setSyncResult(result)
  } catch (e) {
    setSyncResult({ error: e.response?.data?.detail || 'Error al sincronizar' })
  } finally {
    setSyncing(false)
  }
}
```

- [ ] **Step 4: Add Walkman sync section to Settings JSX**

Find an appropriate section in Settings.jsx and add:

```jsx
{/* Walkman Sync */}
<div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6">
  <h2 className="text-base font-semibold mb-1">{t('walkman.sync')}</h2>
  <p className="text-sm text-[#94a3b8] mb-4">{t('walkman.syncDesc')}</p>

  <div className="space-y-3">
    <input
      type="file"
      accept=".xml"
      onChange={e => setXmlFile(e.target.files[0] || null)}
      className="block w-full text-sm text-[#94a3b8] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:text-sm file:cursor-pointer hover:file:bg-purple-700"
    />

    <label className="flex items-center gap-2 text-sm text-[#94a3b8] cursor-pointer">
      <input
        type="checkbox"
        checked={clearUnlinked}
        onChange={e => setClearUnlinked(e.target.checked)}
        className="rounded border-[#2e2e4a] bg-[#0f0f13] text-purple-600 focus:ring-purple-500"
      />
      {t('walkman.clearUnlinked')}
    </label>

    <button
      onClick={handleWalkmanSync}
      disabled={!xmlFile || syncing}
      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
    >
      {syncing ? t('walkman.syncing') : t('walkman.sync')}
    </button>

    {syncResult && !syncResult.error && (
      <div className="mt-3 p-4 bg-green-900/20 border border-green-800 rounded-lg text-sm space-y-1">
        <p className="font-medium text-green-400">{t('walkman.syncDone')}</p>
        <p className="text-[#94a3b8]">+{syncResult.added} {t('walkman.added')} · {syncResult.updated} {t('walkman.updated')} · {syncResult.removed} {t('walkman.removed')} · {syncResult.wishlist_completed} {t('walkman.wishlistCompleted')}</p>
        {syncResult.errors.length > 0 && (
          <p className="text-amber-400">{syncResult.errors.length} {t('walkman.errors')}</p>
        )}
      </div>
    )}

    {syncResult?.error && (
      <p className="text-sm text-red-400 mt-2">{syncResult.error}</p>
    )}
  </div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Settings.jsx
git commit -m "feat: add Walkman sync section to Settings page"
```

---

## Task 10: Wishlist Page

**Files:**
- Create: `frontend/src/pages/Wishlist.jsx`
- Modify: `frontend/src/components/Layout.jsx`

- [ ] **Step 1: Create Wishlist.jsx**

```jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSongs } from '../api/songs'
import { createWishlistItem } from '../api/walkman'
import { updateSong, deleteSong } from '../api/songs'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

function AddWishlistModal({ onClose, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ title: '', artist_name: '', album_name: '', wishlist_notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createWishlistItem(form)
      onSaved()
    } catch { alert('Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{t('wishlist.add')}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key: 'title', label: t('wishlist.addTitle'), required: true },
            { key: 'artist_name', label: t('wishlist.addArtist'), required: true },
            { key: 'album_name', label: t('wishlist.addAlbum'), required: false },
            { key: 'wishlist_notes', label: t('wishlist.addNotes'), required: false },
          ].map(({ key, label, required }) => (
            <div key={key}>
              <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">{label}</label>
              <input
                required={required}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
              />
            </div>
          ))}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Wishlist() {
  const { t } = useTranslation()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getSongs({ walkman_status: 'wishlist', limit: 200 })
      setSongs(data.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar del wishlist?')) return
    await deleteSong(id)
    setSongs(prev => prev.filter(s => s.id !== id))
  }

  const handleAcquired = async (song) => {
    await updateSong(song.id, { walkman_status: 'removed' })
    setSongs(prev => prev.filter(s => s.id !== song.id))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('wishlist.title')}</h1>
          {songs.length > 0 && (
            <p className="text-sm text-[#94a3b8] mt-1">{songs.length} {t('wishlist.pending')}</p>
          )}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('wishlist.add')}
        </button>
      </div>

      {loading && <LoadingSpinner />}

      {!loading && songs.length === 0 && (
        <EmptyState
          title={t('wishlist.empty')}
          description={t('wishlist.emptyDesc')}
          action={
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
              {t('wishlist.add')}
            </button>
          }
        />
      )}

      {!loading && songs.length > 0 && (
        <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-hidden">
          {songs.map((song, idx) => (
            <div key={song.id}
              className={`flex items-center gap-4 px-4 py-3 group ${idx < songs.length - 1 ? 'border-b border-[#2e2e4a]' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[#e2e8f0] truncate">{song.title}</p>
                <p className="text-xs text-[#94a3b8] truncate mt-0.5">
                  {song.artist_display}
                  {song.album && ` · ${song.album.title}`}
                </p>
                {song.wishlist_notes && (
                  <p className="text-xs text-purple-400/70 mt-0.5 truncate">{song.wishlist_notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleAcquired(song)}
                  className="text-xs px-2 py-1 bg-green-700/30 text-green-400 rounded hover:bg-green-700/50 transition-colors">
                  {t('wishlist.markAcquired')}
                </button>
                <button onClick={() => handleDelete(song.id)}
                  className="text-red-400/60 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddWishlistModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
    </div>
  )
}
```

- [ ] **Step 2: Add Wishlist to Layout.jsx nav**

In `frontend/src/components/Layout.jsx`, add after the Playlists nav item:

```jsx
<NavItem to="/wishlist" label={t('wishlist.title')} onClick={closeSidebar} icon={
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
} />
```

- [ ] **Step 3: Add route in App.jsx**

Find where routes are defined in `frontend/src/App.jsx` and add:

```jsx
import Wishlist from './pages/Wishlist'
// ...
<Route path="/wishlist" element={<Layout><Wishlist /></Layout>} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Wishlist.jsx frontend/src/components/Layout.jsx frontend/src/App.jsx
git commit -m "feat: add Wishlist page and nav item"
```

---

## Task 11: Library — walkman_status Filter + Multi-select

**Files:**
- Modify: `frontend/src/pages/Library.jsx`

- [ ] **Step 1: Add walkman_status filter state**

In Library.jsx, add:

```js
const [walkmanFilter, setWalkmanFilter] = useState('')
```

- [ ] **Step 2: Pass walkman_status to load()**

In the `load` function, add to the getSongs params:

```js
walkman_status: walkmanFilter || undefined,
```

- [ ] **Step 3: Add useEffect dependency**

Add `walkmanFilter` to the useEffect dependency array that calls `load()`.

- [ ] **Step 4: Add filter select to the UI**

In the filter bar section, add a select next to the existing filters:

```jsx
<select
  value={walkmanFilter}
  onChange={e => { setWalkmanFilter(e.target.value); setPage(1) }}
  className="px-3 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
>
  <option value="">{t('library.allStatuses')}</option>
  <option value="on_walkman">{t('library.onWalkman')}</option>
  <option value="wishlist">{t('library.wishlist')}</option>
  <option value="removed">{t('library.removed')}</option>
</select>
```

- [ ] **Step 5: Add multi-select state**

```js
const [selected, setSelected] = useState(new Set())
const toggleSelect = (id) => setSelected(prev => {
  const next = new Set(prev)
  next.has(id) ? next.delete(id) : next.add(id)
  return next
})
```

- [ ] **Step 6: Add checkboxes to song rows**

In each song row, add a checkbox at the start:

```jsx
<input
  type="checkbox"
  checked={selected.has(song.id)}
  onChange={() => toggleSelect(song.id)}
  onClick={e => e.stopPropagation()}
  className="w-4 h-4 rounded border-[#2e2e4a] bg-[#0f0f13] text-purple-600 focus:ring-purple-500 cursor-pointer"
/>
```

- [ ] **Step 7: Add floating action bar for multi-select**

Below the song list, add:

```jsx
{selected.size > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#22223a] border border-[#3e3e6a] rounded-xl px-4 py-3 shadow-xl">
    <span className="text-sm text-[#94a3b8]">{selected.size} seleccionadas</span>
    <button
      onClick={() => setShowAddToPlaylist(true)}
      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
    >
      Agregar a playlist
    </button>
    <button onClick={() => setSelected(new Set())}
      className="text-[#94a3b8] hover:text-white transition-colors text-sm">
      Cancelar
    </button>
  </div>
)}
```

- [ ] **Step 8: Add state and modal for "Add to playlist"**

```js
const [showAddToPlaylist, setShowAddToPlaylist] = useState(false)
```

Add a simple modal that lists existing playlists and lets the user pick one or create new:

```jsx
{showAddToPlaylist && (
  <AddToPlaylistModal
    songIds={[...selected]}
    onClose={() => setShowAddToPlaylist(false)}
    onSaved={() => { setShowAddToPlaylist(false); setSelected(new Set()) }}
  />
)}
```

- [ ] **Step 9: Create AddToPlaylistModal component inline in Library.jsx**

```jsx
function AddToPlaylistModal({ songIds, onClose, onSaved }) {
  const [playlists, setPlaylists] = useState([])
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    import('../api/playlists').then(m => m.getPlaylists({ limit: 100 })).then(d => setPlaylists(d.items))
  }, [])

  const addToExisting = async (playlistId) => {
    setSaving(true)
    try {
      const { addSongsToPlaylist } = await import('../api/playlists')
      await addSongsToPlaylist(playlistId, songIds)
      onSaved()
    } catch { alert('Error') }
    finally { setSaving(false) }
  }

  const createAndAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const { createPlaylist, addSongsToPlaylist } = await import('../api/playlists')
      const pl = await createPlaylist({ name: newName.trim() })
      await addSongsToPlaylist(pl.id, songIds)
      onSaved()
    } catch { alert('Error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Agregar {songIds.length} canciones a playlist</h2>
        <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
          {playlists.map(pl => (
            <button key={pl.id} onClick={() => addToExisting(pl.id)} disabled={saving}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#22223a] text-sm text-[#e2e8f0] transition-colors">
              {pl.name} <span className="text-[#94a3b8]">({pl.song_count})</span>
            </button>
          ))}
        </div>
        <div className="border-t border-[#2e2e4a] pt-4">
          <p className="text-xs text-[#94a3b8] mb-2 uppercase tracking-wider">Nueva playlist</p>
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Nombre de la playlist"
              className="flex-1 px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
            <button onClick={createAndAdd} disabled={!newName.trim() || saving}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors">
              Crear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 10: Ensure playlists.js has addSongsToPlaylist and getPlaylists**

In `frontend/src/api/playlists.js`, confirm these functions exist (add if missing):

```js
export const getPlaylists = (params = {}) =>
  api.get('/playlists', { params }).then(r => r.data)

export const createPlaylist = (data) =>
  api.post('/playlists', data).then(r => r.data)

export const addSongsToPlaylist = (id, songIds) =>
  api.post(`/playlists/${id}/songs`, { song_ids: songIds }).then(r => r.data)
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/Library.jsx frontend/src/api/playlists.js
git commit -m "feat: add walkman_status filter and multi-select to Library, add AddToPlaylistModal"
```

---

## Task 12: Deploy

**Files:** VPS

- [ ] **Step 1: Run backend migration on VPS**

```bash
ssh contabo "cd /root/euphony && docker exec euphony-backend-1 alembic upgrade head"
```

Expected: `Running upgrade 0006 -> 0007, walkman_sync_wishlist`

- [ ] **Step 2: Rsync and rebuild**

```bash
rsync -az backend/app/ backend/alembic/ contabo:/root/euphony/backend/
rsync -az frontend/src/ frontend/index.html contabo:/root/euphony/frontend/src/
ssh contabo "cd /root/euphony && docker compose -f docker-compose.euphony.yml up -d --build frontend backend"
```

- [ ] **Step 3: Verify backend routes**

```bash
ssh contabo "curl -s http://localhost:8000/docs" | grep -o '"walkman-sync"\|"/wishlist"' | head -5
```

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 5: Commit (if any remaining changes)**

```bash
git add -A && git status  # review before committing
```
