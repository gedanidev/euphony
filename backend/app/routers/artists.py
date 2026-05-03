from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from typing import Optional, List
from uuid import UUID

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/artists", tags=["artists"])


def _load_artist(db: Session, artist_id: UUID) -> models.Artist:
    artist = db.query(models.Artist).filter(models.Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(404, "Artist not found")
    return artist


def _load_song(db: Session, song_id: UUID) -> models.Song:
    """Helper to fully load a song with all relations."""
    from app.routers.songs import _load_song as songs_load_song
    return songs_load_song(db, song_id)


@router.get("", response_model=schemas.PaginatedArtists)
def list_artists(
    search: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(models.Artist)
    if search:
        q = q.filter(models.Artist.name.ilike(f"%{search}%"))
    if country:
        q = q.filter(models.Artist.country.ilike(f"%{country}%"))
    total = q.count()
    items = (
        q.order_by(models.Artist.name)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("", response_model=schemas.ArtistRead, status_code=201)
def create_artist(data: schemas.ArtistCreate, db: Session = Depends(get_db)):
    artist = models.Artist(**data.model_dump())
    db.add(artist)
    db.commit()
    db.refresh(artist)
    return artist


@router.get("/{artist_id}", response_model=schemas.ArtistRead)
def get_artist(artist_id: UUID, db: Session = Depends(get_db)):
    return _load_artist(db, artist_id)


@router.put("/{artist_id}", response_model=schemas.ArtistRead)
def update_artist(artist_id: UUID, data: schemas.ArtistUpdate, db: Session = Depends(get_db)):
    artist = _load_artist(db, artist_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(artist, k, v)
    db.commit()
    db.refresh(artist)
    return artist


@router.delete("/{artist_id}", status_code=204)
def delete_artist(artist_id: UUID, db: Session = Depends(get_db)):
    artist = _load_artist(db, artist_id)
    db.delete(artist)
    db.commit()


@router.get("/{artist_id}/songs", response_model=List[schemas.SongRead])
def get_artist_songs(
    artist_id: UUID,
    role: Optional[str] = Query(None, description="Filter by role: principal, colaborador, composer"),
    db: Session = Depends(get_db),
):
    """Return ALL songs where the artist appears (as performer or composer).
    A song appears in the list of every artist involved — e.g. a collaboration
    shows up for both artists.
    """
    _load_artist(db, artist_id)

    from sqlalchemy.orm import selectinload

    song_ids: set = set()

    if role == "composer":
        composer_rows = db.query(models.SongComposer.song_id).filter(
            models.SongComposer.artist_id == artist_id
        ).all()
        song_ids = {r[0] for r in composer_rows}
    else:
        # Default: performer credits (principal + colaborador)
        q = db.query(models.SongArtist.song_id).filter(
            models.SongArtist.artist_id == artist_id
        )
        if role in ("principal", "colaborador"):
            q = q.filter(models.SongArtist.role == role)
        song_ids = {r[0] for r in q.all()}

        if role is None:
            # Also include composer credits
            comp_ids = {r[0] for r in db.query(models.SongComposer.song_id).filter(
                models.SongComposer.artist_id == artist_id
            ).all()}
            song_ids |= comp_ids

    if not song_ids:
        return []

    songs = (
        db.query(models.Song)
        .options(
            selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist),
            selectinload(models.Song.song_composers).selectinload(models.SongComposer.artist),
            selectinload(models.Song.song_genres).selectinload(models.SongGenre.genre),
            selectinload(models.Song.song_moods).selectinload(models.SongMood.mood),
            selectinload(models.Song.album).selectinload(models.Album.artist),
        )
        .filter(models.Song.id.in_(song_ids))
        .order_by(models.Song.title)
        .all()
    )
    return songs


# ---------------------------------------------------------------------------
# Artist relations
# ---------------------------------------------------------------------------

@router.get("/{artist_id}/relations", response_model=List[schemas.ArtistRelationRead])
def get_artist_relations(artist_id: UUID, db: Session = Depends(get_db)):
    _load_artist(db, artist_id)
    relations = (
        db.query(models.ArtistRelation)
        .options(
            selectinload(models.ArtistRelation.artist1),
            selectinload(models.ArtistRelation.artist2),
        )
        .filter(
            (models.ArtistRelation.artist1_id == artist_id) |
            (models.ArtistRelation.artist2_id == artist_id)
        )
        .all()
    )
    return relations


@router.post("/{artist_id}/relations", response_model=schemas.ArtistRelationRead, status_code=201)
def add_artist_relation(
    artist_id: UUID,
    data: schemas.ArtistRelationCreate,
    db: Session = Depends(get_db),
):
    _load_artist(db, artist_id)
    if not db.query(models.Artist).filter(models.Artist.id == data.artist2_id).first():
        raise HTTPException(404, "Target artist not found")
    relation = models.ArtistRelation(
        artist1_id=artist_id,
        artist2_id=data.artist2_id,
        relation_type=data.relation_type,
    )
    db.add(relation)
    db.commit()
    db.refresh(relation)
    # reload with nested artist objects
    return (
        db.query(models.ArtistRelation)
        .options(
            selectinload(models.ArtistRelation.artist1),
            selectinload(models.ArtistRelation.artist2),
        )
        .filter(models.ArtistRelation.id == relation.id)
        .first()
    )


@router.delete("/{artist_id}/relations/{relation_id}", status_code=204)
def delete_artist_relation(artist_id: UUID, relation_id: UUID, db: Session = Depends(get_db)):
    relation = db.query(models.ArtistRelation).filter(
        models.ArtistRelation.id == relation_id,
        (models.ArtistRelation.artist1_id == artist_id) |
        (models.ArtistRelation.artist2_id == artist_id),
    ).first()
    if not relation:
        raise HTTPException(404, "Relation not found")
    db.delete(relation)
    db.commit()
