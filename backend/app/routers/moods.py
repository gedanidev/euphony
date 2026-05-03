from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/moods", tags=["moods"])


@router.get("", response_model=List[schemas.MoodRead])
def list_moods(db: Session = Depends(get_db)):
    return db.query(models.Mood).order_by(models.Mood.name).all()


@router.post("", response_model=schemas.MoodRead, status_code=201)
def create_mood(data: schemas.MoodCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Mood).filter(models.Mood.name.ilike(data.name)).first()
    if existing:
        raise HTTPException(409, "Mood already exists")
    mood = models.Mood(**data.model_dump())
    db.add(mood)
    db.commit()
    db.refresh(mood)
    return mood


@router.delete("/{mood_id}", status_code=204)
def delete_mood(mood_id: UUID, db: Session = Depends(get_db)):
    mood = db.query(models.Mood).filter(models.Mood.id == mood_id).first()
    if not mood:
        raise HTTPException(404, "Mood not found")
    db.delete(mood)
    db.commit()
