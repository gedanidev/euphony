from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
import asyncio
import httpx

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/songs", tags=["songs"])


def _load_song(db: Session, song_id: UUID) -> models.Song:
    song = (
        db.query(models.Song)
        .options(
            selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist),
            selectinload(models.Song.song_composers).selectinload(models.SongComposer.artist),
            selectinload(models.Song.song_genres).selectinload(models.SongGenre.genre),
            selectinload(models.Song.song_moods).selectinload(models.SongMood.mood),
            selectinload(models.Song.album).selectinload(models.Album.artist),
        )
        .filter(models.Song.id == song_id)
        .first()
    )
    if not song:
        raise HTTPException(404, "Song not found")
    return song


def _apply_relations(db: Session, song: models.Song, data: schemas.SongCreate | schemas.SongUpdate):
    """Sync artist, composer, genre and mood associations from create/update data."""
    role_map: dict = {}
    if data.artist_roles:
        role_map = {str(r["artist_id"]): r["role"] for r in data.artist_roles}

    if data.artist_ids is not None:
        # Clear existing and re-create
        db.query(models.SongArtist).filter(models.SongArtist.song_id == song.id).delete()
        for idx, artist_id in enumerate(data.artist_ids):
            role = role_map.get(str(artist_id), "principal" if idx == 0 else "colaborador")
            db.add(models.SongArtist(song_id=song.id, artist_id=artist_id, role=role, order=idx))

    if data.composer_ids is not None:
        db.query(models.SongComposer).filter(models.SongComposer.song_id == song.id).delete()
        for idx, artist_id in enumerate(data.composer_ids):
            db.add(models.SongComposer(song_id=song.id, artist_id=artist_id, order=idx))

    if data.genre_ids is not None:
        db.query(models.SongGenre).filter(models.SongGenre.song_id == song.id).delete()
        for genre_id in data.genre_ids:
            db.add(models.SongGenre(song_id=song.id, genre_id=genre_id))

    if data.mood_ids is not None:
        db.query(models.SongMood).filter(models.SongMood.song_id == song.id).delete()
        for mood_id in data.mood_ids:
            db.add(models.SongMood(song_id=song.id, mood_id=mood_id))


@router.get("", response_model=schemas.PaginatedSongs)
def list_songs(
    search: Optional[str] = Query(None),
    availability: Optional[str] = Query(None),
    artist_id: Optional[UUID] = Query(None),
    genre_id: Optional[UUID] = Query(None),
    mood_id: Optional[UUID] = Query(None),
    sort_by: Optional[str] = Query("title", regex="^(title|artist|album)$"),
    sort_dir: Optional[str] = Query("asc", regex="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=20000),
    db: Session = Depends(get_db),
):
    q = db.query(models.Song).options(
        selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist),
        selectinload(models.Song.song_composers).selectinload(models.SongComposer.artist),
        selectinload(models.Song.song_genres).selectinload(models.SongGenre.genre),
        selectinload(models.Song.song_moods).selectinload(models.SongMood.mood),
        selectinload(models.Song.album).selectinload(models.Album.artist),
    )

    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                models.Song.title.ilike(pattern),
            )
        )

    if availability:
        q = q.filter(models.Song.availability == availability)

    if artist_id:
        q = q.join(models.SongArtist, models.SongArtist.song_id == models.Song.id).filter(
            models.SongArtist.artist_id == artist_id
        )

    if genre_id:
        q = q.join(models.SongGenre, models.SongGenre.song_id == models.Song.id).filter(
            models.SongGenre.genre_id == genre_id
        )

    if mood_id:
        q = q.join(models.SongMood, models.SongMood.song_id == models.Song.id).filter(
            models.SongMood.mood_id == mood_id
        )

    # Fetch all matching songs; sort in Python to avoid PostgreSQL DISTINCT + ORDER BY join conflicts
    all_items = q.distinct().all()
    total = len(all_items)

    reverse = sort_dir == "desc"
    if sort_by == "artist":
        def _artist_key(s):
            for sa in s.song_artists:
                if sa.role == "principal":
                    return sa.artist.name.lower()
            return s.song_artists[0].artist.name.lower() if s.song_artists else ""
        all_items.sort(key=_artist_key, reverse=reverse)
    elif sort_by == "album":
        all_items.sort(key=lambda s: (s.album.title.lower() if s.album else ""), reverse=reverse)
    else:
        all_items.sort(key=lambda s: s.title.lower(), reverse=reverse)

    items = all_items[(page - 1) * limit: page * limit]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("", response_model=schemas.SongRead, status_code=201)
def create_song(data: schemas.SongCreate, db: Session = Depends(get_db)):
    song_fields = data.model_dump(exclude={"artist_ids", "artist_roles", "composer_ids", "genre_ids", "mood_ids"})
    song = models.Song(**song_fields)
    db.add(song)
    db.flush()  # get song.id without committing
    _apply_relations(db, song, data)
    db.commit()
    return _load_song(db, song.id)


@router.get("/{song_id}", response_model=schemas.SongRead)
def get_song(song_id: UUID, db: Session = Depends(get_db)):
    return _load_song(db, song_id)


@router.get("/{song_id}/covers", response_model=List[schemas.SongRead])
def get_song_covers(song_id: UUID, db: Session = Depends(get_db)):
    _load_song(db, song_id)  # validate exists
    covers = (
        db.query(models.Song)
        .options(
            selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist),
            selectinload(models.Song.album),
        )
        .filter(models.Song.original_song_id == song_id)
        .all()
    )
    return covers


@router.put("/{song_id}", response_model=schemas.SongRead)
def update_song(song_id: UUID, data: schemas.SongUpdate, db: Session = Depends(get_db)):
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    scalar_fields = data.model_dump(
        exclude_unset=True,
        exclude={"artist_ids", "artist_roles", "composer_ids", "genre_ids", "mood_ids"}
    )
    for k, v in scalar_fields.items():
        setattr(song, k, v)
    _apply_relations(db, song, data)
    db.commit()
    return _load_song(db, song.id)


@router.delete("/{song_id}", status_code=204)
def delete_song(song_id: UUID, db: Session = Depends(get_db)):
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    db.delete(song)
    db.commit()


# ---------------------------------------------------------------------------
# Batch operations
# ---------------------------------------------------------------------------

class BatchDeleteBody(BaseModel):
    song_ids: List[UUID]

class BatchAvailabilityBody(BaseModel):
    song_ids: List[UUID]
    availability: str

class BatchDeleteAllBody(BaseModel):
    confirm: str  # must equal "DELETE_ALL"


@router.post("/batch/delete", status_code=204)
def batch_delete(body: BatchDeleteBody, db: Session = Depends(get_db)):
    """Delete a list of songs by ID."""
    db.query(models.Song).filter(models.Song.id.in_(body.song_ids)).delete(synchronize_session=False)
    db.commit()


@router.post("/batch/availability", status_code=204)
def batch_availability(body: BatchAvailabilityBody, db: Session = Depends(get_db)):
    """Change availability for a list of songs."""
    if body.availability not in ("available", "wishlist", "not_available"):
        raise HTTPException(400, "Invalid availability value")
    db.query(models.Song).filter(models.Song.id.in_(body.song_ids)).update(
        {"availability": body.availability}, synchronize_session=False
    )
    db.commit()


@router.post("/batch/delete-all", status_code=204)
def batch_delete_all(body: BatchDeleteAllBody, db: Session = Depends(get_db)):
    """Delete ALL songs from the library. Requires confirm='DELETE_ALL'."""
    if body.confirm != "DELETE_ALL":
        raise HTTPException(400, "confirm field must be 'DELETE_ALL'")
    db.query(models.Song).delete(synchronize_session=False)
    db.commit()


# ---------------------------------------------------------------------------
# Lyrics endpoints
# ---------------------------------------------------------------------------

def _get_song_or_404(db: Session, song_id: UUID) -> models.Song:
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    return song


def _principal_artist(song: models.Song) -> str:
    for sa in song.song_artists:
        if sa.role == "principal":
            return sa.artist.name
    if song.song_artists:
        return song.song_artists[0].artist.name
    return ""


@router.get("/{song_id}/lyrics")
def get_lyrics(song_id: UUID, db: Session = Depends(get_db)):
    song = (
        db.query(models.Song)
        .options(selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist))
        .filter(models.Song.id == song_id)
        .first()
    )
    if not song:
        raise HTTPException(404, "Song not found")
    return {
        "lyrics": song.lyrics,
        "lyrics_lrc": song.lyrics_lrc,
        "has_plain": bool(song.lyrics),
        "has_synced": bool(song.lyrics_lrc),
    }


@router.patch("/{song_id}/lyrics", status_code=204)
def save_lyrics(song_id: UUID, body: schemas.LyricsSave, db: Session = Depends(get_db)):
    """Manually save plain and/or synced lyrics."""
    song = _get_song_or_404(db, song_id)
    if body.lyrics is not None:
        song.lyrics = body.lyrics or None
    if body.lyrics_lrc is not None:
        song.lyrics_lrc = body.lyrics_lrc or None
    db.commit()


@router.post("/{song_id}/lyrics/fetch")
def fetch_lyrics_lrclib(song_id: UUID, db: Session = Depends(get_db)):
    """Search LRCLIB and overwrite stored lyrics."""
    song = (
        db.query(models.Song)
        .options(selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist))
        .filter(models.Song.id == song_id)
        .first()
    )
    if not song:
        raise HTTPException(404, "Song not found")

    artist_name = _principal_artist(song)
    album_name = song.album.title if song.album else None

    async def _call_lrclib():
        params = {"track_name": song.title, "artist_name": artist_name}
        if album_name:
            params["album_name"] = album_name
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://lrclib.net/api/get", params=params)
            if resp.status_code == 200:
                return resp.json()
            # fallback: search without album
            if album_name:
                resp2 = await client.get("https://lrclib.net/api/get", params={
                    "track_name": song.title, "artist_name": artist_name
                })
                if resp2.status_code == 200:
                    return resp2.json()
        return None

    try:
        data = asyncio.get_event_loop().run_until_complete(_call_lrclib())
    except RuntimeError:
        loop = asyncio.new_event_loop()
        data = loop.run_until_complete(_call_lrclib())
        loop.close()

    if not data:
        raise HTTPException(404, "Lyrics not found on LRCLIB for this song")

    song.lyrics = data.get("plainLyrics") or song.lyrics
    song.lyrics_lrc = data.get("syncedLyrics") or song.lyrics_lrc
    db.commit()

    return {
        "lyrics": song.lyrics,
        "lyrics_lrc": song.lyrics_lrc,
        "has_plain": bool(song.lyrics),
        "has_synced": bool(song.lyrics_lrc),
    }


@router.post("/{song_id}/lyrics/upload", status_code=204)
async def upload_lyrics(
    song_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a .lrc or .txt file to set lyrics."""
    song = _get_song_or_404(db, song_id)
    filename = (file.filename or "").lower()
    content = (await file.read()).decode("utf-8", errors="replace")

    if filename.endswith(".lrc"):
        song.lyrics_lrc = content
        # Also extract plain text from LRC (strip timestamps)
        import re
        plain_lines = re.sub(r"\[\d+:\d+\.\d+\]", "", content)
        plain_lines = "\n".join(
            line.strip() for line in plain_lines.splitlines() if line.strip()
        )
        if plain_lines:
            song.lyrics = plain_lines
    elif filename.endswith(".txt"):
        song.lyrics = content
    else:
        raise HTTPException(400, "Only .lrc and .txt files are supported")

    db.commit()


@router.get("/{song_id}/lyrics/download")
def download_lyrics(
    song_id: UUID,
    format: str = Query("lrc", regex="^(lrc|txt)$"),
    db: Session = Depends(get_db),
):
    """Download lyrics as a .lrc or .txt file."""
    song = (
        db.query(models.Song)
        .options(selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist))
        .filter(models.Song.id == song_id)
        .first()
    )
    if not song:
        raise HTTPException(404, "Song not found")

    safe_title = "".join(c for c in song.title if c.isalnum() or c in " -_").strip()

    if format == "lrc":
        content = song.lyrics_lrc or song.lyrics or ""
        media_type = "text/plain"
        filename = f"{safe_title}.lrc"
    else:
        content = song.lyrics or ""
        media_type = "text/plain"
        filename = f"{safe_title}.txt"

    if not content:
        raise HTTPException(404, f"No {format} lyrics available for this song")

    return Response(
        content=content.encode("utf-8"),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class RatingBody(BaseModel):
    rating: Optional[int] = None  # null clears it


@router.patch("/{song_id}/rating", response_model=schemas.SongRead)
def set_song_rating(song_id: UUID, body: RatingBody, db: Session = Depends(get_db)):
    song = _load_song(db, song_id)
    if body.rating is not None and not (1 <= body.rating <= 10):
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
    db.refresh(song)
    return _load_song(db, song_id)
