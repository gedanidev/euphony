from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/genres", tags=["genres"])


@router.get("", response_model=list[schemas.GenreSummary])
def list_genres(db: Session = Depends(get_db)):
    """Genres derived from Song.primary_genre (with real counts), plus any
    empty placeholder genres created via POST /genres that have no songs
    yet — those show up with 0/0 counts."""
    rows = (
        db.query(
            models.Song.primary_genre,
            func.count(models.Song.id.distinct()).label("song_count"),
            func.count(models.SongArtist.artist_id.distinct()).label("artist_count"),
        )
        .outerjoin(models.SongArtist, models.SongArtist.song_id == models.Song.id)
        .filter(models.Song.primary_genre.isnot(None))
        .group_by(models.Song.primary_genre)
        .order_by(func.count(models.Song.id.distinct()).desc())
        .all()
    )
    result = [
        schemas.GenreSummary(genre=genre, song_count=song_count, artist_count=artist_count)
        for genre, song_count, artist_count in rows
    ]

    in_use = {r.genre for r in result}
    placeholders = db.query(models.Genre.name).filter(models.Genre.name.notin_(in_use)).all() if in_use \
        else db.query(models.Genre.name).all()
    for (name,) in placeholders:
        result.append(schemas.GenreSummary(genre=name, song_count=0, artist_count=0))

    return result


@router.post("", response_model=schemas.GenreSummary, status_code=201)
def create_genre(data: schemas.GenreCreate, db: Session = Depends(get_db)):
    """Create an empty genre placeholder — no songs assigned yet.
    Move artists into it later from another genre's detail page."""
    name = data.name.strip()
    if not name:
        raise HTTPException(400, "Genre name is required")

    already_used = db.query(models.Song.id).filter(models.Song.primary_genre == name).first()
    if already_used or db.query(models.Genre).filter(models.Genre.name == name).first():
        raise HTTPException(409, "Genre already exists")

    genre = models.Genre(name=name)
    db.add(genre)
    db.commit()
    return schemas.GenreSummary(genre=name, song_count=0, artist_count=0)


@router.get("/{genre}/artists", response_model=list[schemas.GenreArtist])
def get_genre_artists(genre: str, db: Session = Depends(get_db)):
    """Distinct artists with at least one song in this genre, with their
    song count within it (an artist can have songs split across genres).
    An empty placeholder genre returns an empty list rather than 404."""
    rows = (
        db.query(
            models.Artist.id,
            models.Artist.name,
            models.Artist.image_url,
            func.count(models.Song.id.distinct()).label("song_count"),
        )
        .join(models.SongArtist, models.SongArtist.artist_id == models.Artist.id)
        .join(models.Song, models.Song.id == models.SongArtist.song_id)
        .filter(models.Song.primary_genre == genre)
        .group_by(models.Artist.id, models.Artist.name, models.Artist.image_url)
        .order_by(models.Artist.name)
        .all()
    )
    if not rows and not db.query(models.Genre).filter(models.Genre.name == genre).first():
        raise HTTPException(404, "Genre not found")
    return [
        schemas.GenreArtist(id=aid, name=name, image_url=image_url, song_count=song_count)
        for aid, name, image_url, song_count in rows
    ]


@router.patch("/reassign", status_code=204)
def reassign_genre(data: schemas.GenreReassignRequest, db: Session = Depends(get_db)):
    """Rename a genre outright (artist_id=None), or move just one artist's
    songs from one genre to another (artist_id set).

    Query.update() can't run directly against a query with a join, so when
    scoping to one artist we resolve matching song ids first, then update
    those by id — a single-table update either way.
    """
    base = db.query(models.Song.id).filter(models.Song.primary_genre == data.from_genre)

    if data.artist_id:
        song_ids = [
            sid for (sid,) in base
            .join(models.SongArtist, models.SongArtist.song_id == models.Song.id)
            .filter(models.SongArtist.artist_id == data.artist_id)
        ]
        updated = (
            db.query(models.Song)
            .filter(models.Song.id.in_(song_ids))
            .update({"primary_genre": data.to_genre}, synchronize_session=False)
            if song_ids else 0
        )
    else:
        updated = (
            db.query(models.Song)
            .filter(models.Song.primary_genre == data.from_genre)
            .update({"primary_genre": data.to_genre}, synchronize_session=False)
        )

    db.commit()
    if not updated:
        raise HTTPException(404, "No matching songs found")
