#!/usr/bin/env python3
"""Create Smart Playlists automatically from discovered genres.

Run this AFTER the genre enrichment job has populated primary_genre/subgenres.

Usage:
    cd backend
    python scripts/create_genre_smart_playlists.py

Environment:
    DATABASE_URL (required) — e.g. postgresql://user:pass@host:5432/euphony
"""

from __future__ import annotations

import os
import sys
from collections import Counter

# Allow imports from the app package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models

SessionLocal = sessionmaker()


def get_top_genres(db, min_songs: int = 5) -> list[str]:
    """Return genres with at least `min_songs` tracks, sorted by frequency."""
    rows = db.query(models.Song.primary_genre).filter(
        models.Song.primary_genre.isnot(None)
    ).all()
    genres = [r[0] for r in rows]
    counts = Counter(genres)
    return [genre for genre, count in counts.most_common() if count >= min_songs]


def create_smart_playlist(db, genre: str) -> models.SmartPlaylist:
    """Create or update a SmartPlaylist for a given genre."""
    name = genre.title()

    existing = (
        db.query(models.SmartPlaylist)
        .filter(models.SmartPlaylist.name == name)
        .first()
    )
    if existing:
        print(f"Playlist '{name}' already exists — skipping")
        return existing

    conditions = [
        {
            "field": "primary_genre",
            "op": "is",
            "value": genre,
        }
    ]

    pl = models.SmartPlaylist(
        name=name,
        match_all=True,
        conditions=conditions,
    )
    db.add(pl)
    db.commit()
    db.refresh(pl)
    print(f"Created Smart Playlist: '{name}' (genre = {genre})")
    return pl


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL is not set")
        sys.exit(1)

    engine = create_engine(db_url)
    SessionLocal.configure(bind=engine)
    db = SessionLocal()

    try:
        top_genres = get_top_genres(db, min_songs=5)
        print(f"Found {len(top_genres)} genres with ≥5 songs")

        if not top_genres:
            print("No genres found. Run the genre enrichment job first.")
            return

        for genre in top_genres:
            create_smart_playlist(db, genre)

        print("\nDone!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
