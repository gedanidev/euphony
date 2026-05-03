from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from uuid import UUID
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/songs", tags=["songs"])


@router.get("", response_model=schemas.PaginatedSongs)
def list_songs(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(models.Song)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                models.Song.title.ilike(pattern),
                models.Song.artist_display.ilike(pattern),
                models.Song.album.ilike(pattern),
            )
        )
    total = q.count()
    items = (
        q.order_by(models.Song.artist_display, models.Song.title)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("", response_model=schemas.SongRead, status_code=201)
def create_song(data: schemas.SongCreate, db: Session = Depends(get_db)):
    song = models.Song(**data.model_dump())
    db.add(song)
    db.commit()
    db.refresh(song)
    return song


@router.get("/{song_id}", response_model=schemas.SongRead)
def get_song(song_id: UUID, db: Session = Depends(get_db)):
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    return song


@router.put("/{song_id}", response_model=schemas.SongRead)
def update_song(song_id: UUID, data: schemas.SongUpdate, db: Session = Depends(get_db)):
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(song, k, v)
    db.commit()
    db.refresh(song)
    return song


@router.delete("/{song_id}", status_code=204)
def delete_song(song_id: UUID, db: Session = Depends(get_db)):
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(404, "Song not found")
    db.delete(song)
    db.commit()
