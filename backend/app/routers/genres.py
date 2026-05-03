from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/genres", tags=["genres"])


@router.get("", response_model=List[schemas.GenreRead])
def list_genres(db: Session = Depends(get_db)):
    return db.query(models.Genre).order_by(models.Genre.name).all()


@router.post("", response_model=schemas.GenreRead, status_code=201)
def create_genre(data: schemas.GenreCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Genre).filter(models.Genre.name.ilike(data.name)).first()
    if existing:
        raise HTTPException(409, "Genre already exists")
    genre = models.Genre(name=data.name)
    db.add(genre)
    db.commit()
    db.refresh(genre)
    return genre


@router.delete("/{genre_id}", status_code=204)
def delete_genre(genre_id: UUID, db: Session = Depends(get_db)):
    genre = db.query(models.Genre).filter(models.Genre.id == genre_id).first()
    if not genre:
        raise HTTPException(404, "Genre not found")
    db.delete(genre)
    db.commit()
