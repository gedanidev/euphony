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
            selectinload(models.Song.song_composers).selectinload(models.SongComposer.artist),
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


@router.post("/preview", response_model=schemas.SmartPlaylistPreviewResponse)
def preview_smart_playlist(data: schemas.SmartPlaylistPreviewRequest, db: Session = Depends(get_db)):
    """Stateless preview — evaluates conditions without saving. Used by the builder UI."""
    songs = _execute_conditions(db, data.conditions, data.match_all)
    return schemas.SmartPlaylistPreviewResponse(song_count=len(songs), songs=songs)


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
        lines.append(song.file_path or song.title)

    content = "\n".join(lines)
    filename = pl.name.replace(" ", "_")
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f'attachment; filename="{filename}.m3u"'},
    )
