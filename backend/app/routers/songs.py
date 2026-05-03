from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_
from typing import Optional, List
from uuid import UUID

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
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
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

    total = q.distinct().count()
    items = (
        q.distinct()
        .order_by(models.Song.title)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
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
