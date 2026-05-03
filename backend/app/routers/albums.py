from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from typing import Optional
from uuid import UUID

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/albums", tags=["albums"])


def _load_album(db: Session, album_id: UUID) -> models.Album:
    album = (
        db.query(models.Album)
        .options(selectinload(models.Album.artist))
        .filter(models.Album.id == album_id)
        .first()
    )
    if not album:
        raise HTTPException(404, "Album not found")
    return album


@router.get("", response_model=schemas.PaginatedAlbums)
def list_albums(
    search: Optional[str] = Query(None),
    artist_id: Optional[UUID] = Query(None),
    year: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(models.Album).options(selectinload(models.Album.artist))
    if search:
        q = q.filter(models.Album.title.ilike(f"%{search}%"))
    if artist_id:
        q = q.filter(models.Album.artist_id == artist_id)
    if year:
        q = q.filter(models.Album.year == year)
    total = q.count()
    items = (
        q.order_by(models.Album.title)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("", response_model=schemas.AlbumRead, status_code=201)
def create_album(data: schemas.AlbumCreate, db: Session = Depends(get_db)):
    album = models.Album(**data.model_dump())
    db.add(album)
    db.commit()
    return _load_album(db, album.id)


@router.get("/{album_id}", response_model=schemas.AlbumWithSongs)
def get_album(album_id: UUID, db: Session = Depends(get_db)):
    album = (
        db.query(models.Album)
        .options(
            selectinload(models.Album.artist),
            selectinload(models.Album.songs).selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist),
            selectinload(models.Album.songs).selectinload(models.Song.song_genres).selectinload(models.SongGenre.genre),
            selectinload(models.Album.songs).selectinload(models.Song.song_moods).selectinload(models.SongMood.mood),
        )
        .filter(models.Album.id == album_id)
        .first()
    )
    if not album:
        raise HTTPException(404, "Album not found")
    return album


@router.put("/{album_id}", response_model=schemas.AlbumRead)
def update_album(album_id: UUID, data: schemas.AlbumUpdate, db: Session = Depends(get_db)):
    album = _load_album(db, album_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(album, k, v)
    db.commit()
    return _load_album(db, album_id)


@router.delete("/{album_id}", status_code=204)
def delete_album(album_id: UUID, db: Session = Depends(get_db)):
    album = _load_album(db, album_id)
    db.delete(album)
    db.commit()
