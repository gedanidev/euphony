"""Spotify OAuth integration.

Flow:
  1. GET /api/auth/spotify/login  → redirects user to Spotify authorization URL
  2. Spotify redirects to GET /api/auth/spotify/callback?code=...
  3. Backend exchanges code for tokens, stores in user_connections table
  4. POST /api/auth/spotify/sync  → imports last 50 played tracks into listen_history ONLY
  5. GET /api/spotify/history     → returns grouped history for the history page
  6. POST /api/spotify/history/add-to-library → creates a Song from a history entry
"""

import os
from datetime import datetime, timezone
from typing import Optional
from collections import defaultdict

import spotipy
from spotipy.oauth2 import SpotifyOAuth
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/auth", tags=["auth"])

SPOTIFY_SCOPE = "user-read-recently-played"


def _get_oauth() -> SpotifyOAuth:
    client_id = os.environ.get("SPOTIFY_CLIENT_ID", "")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
    redirect_uri = os.environ.get(
        "SPOTIFY_REDIRECT_URI", "http://localhost:8000/api/auth/spotify/callback"
    )
    if not client_id or not client_secret:
        raise HTTPException(503, "Spotify credentials not configured")
    return SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope=SPOTIFY_SCOPE,
        cache_handler=spotipy.cache_handler.MemoryCacheHandler(),
        show_dialog=True,
    )


def _get_connection(db: Session) -> Optional[models.UserConnection]:
    return (
        db.query(models.UserConnection)
        .filter(models.UserConnection.service == "spotify")
        .first()
    )


def _refresh_if_needed(conn: models.UserConnection, oauth: SpotifyOAuth, db: Session) -> str:
    token_info = {
        "access_token": conn.access_token,
        "refresh_token": conn.refresh_token,
        "token_type": "Bearer",
        "expires_at": int(conn.expires_at.timestamp()) if conn.expires_at else 0,
        "scope": SPOTIFY_SCOPE,
    }
    if oauth.is_token_expired(token_info):
        token_info = oauth.refresh_access_token(conn.refresh_token)
        conn.access_token = token_info["access_token"]
        if token_info.get("refresh_token"):
            conn.refresh_token = token_info["refresh_token"]
        if token_info.get("expires_at"):
            conn.expires_at = datetime.fromtimestamp(token_info["expires_at"], tz=timezone.utc)
        db.commit()
    return conn.access_token


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/spotify/login")
def spotify_login():
    """Returns the Spotify authorization URL."""
    oauth = _get_oauth()
    return {"auth_url": oauth.get_authorize_url()}


@router.get("/spotify/callback")
def spotify_callback(code: str = Query(...), db: Session = Depends(get_db)):
    """Exchange authorization code for tokens and store them."""
    oauth = _get_oauth()
    token_info = oauth.get_access_token(code, as_dict=True, check_cache=False)

    expires_at = None
    if token_info.get("expires_at"):
        expires_at = datetime.fromtimestamp(token_info["expires_at"], tz=timezone.utc)

    conn = _get_connection(db)
    if conn:
        conn.access_token = token_info["access_token"]
        conn.refresh_token = token_info.get("refresh_token", conn.refresh_token)
        conn.expires_at = expires_at
    else:
        conn = models.UserConnection(
            service="spotify",
            access_token=token_info["access_token"],
            refresh_token=token_info.get("refresh_token"),
            expires_at=expires_at,
        )
        db.add(conn)
    db.commit()

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}/settings?spotify=connected")


@router.get("/spotify/status", response_model=schemas.UserConnectionRead)
def spotify_status(db: Session = Depends(get_db)):
    conn = _get_connection(db)
    if not conn:
        raise HTTPException(404, "Spotify not connected")
    return conn


@router.post("/spotify/sync")
def spotify_sync(db: Session = Depends(get_db)):
    """Import last 50 recently played tracks into listen_history ONLY.
    Does NOT create songs or artists in the library.
    """
    conn = _get_connection(db)
    if not conn:
        raise HTTPException(400, "Spotify not connected")

    oauth = _get_oauth()
    access_token = _refresh_if_needed(conn, oauth, db)

    sp = spotipy.Spotify(auth=access_token)
    recently_played = sp.current_user_recently_played(limit=50)

    history_added = 0
    history_skipped = 0

    for item in recently_played.get("items", []):
        track = item.get("track")
        played_at_str = item.get("played_at")
        if not track or not played_at_str:
            continue

        played_at = datetime.fromisoformat(played_at_str.replace("Z", "+00:00"))
        spotify_track_id = track.get("id")
        track_title = track.get("name", "Unknown")
        artist_name = ", ".join(a.get("name", "") for a in track.get("artists", []))
        album = track.get("album", {})
        album_name = album.get("name")
        images = album.get("images", [])
        cover_url = images[0].get("url") if images else None
        duration_ms = track.get("duration_ms")

        # Skip duplicate: same spotify_track_id + played_at
        existing = db.query(models.ListenHistory).filter(
            models.ListenHistory.spotify_track_id == spotify_track_id,
            models.ListenHistory.played_at == played_at,
        ).first()
        if existing:
            history_skipped += 1
            continue

        # Check if this track is already in the library
        song_id = None
        if spotify_track_id:
            song = db.query(models.Song).filter(
                models.Song.spotify_id == spotify_track_id
            ).first()
            if song:
                song_id = song.id

        db.add(models.ListenHistory(
            song_id=song_id,
            played_at=played_at,
            source="spotify",
            track_title=track_title,
            artist_name=artist_name,
            album_name=album_name,
            spotify_track_id=spotify_track_id,
            cover_url=cover_url,
            duration_ms=duration_ms,
        ))
        history_added += 1

    db.commit()
    return {
        "history_entries_added": history_added,
        "history_entries_skipped": history_skipped,
    }


@router.get("/spotify/history", response_model=list[schemas.SpotifyHistoryTrack])
def spotify_history(db: Session = Depends(get_db)):
    """Returns Spotify listen history grouped by track, sorted by play count desc."""
    entries = (
        db.query(models.ListenHistory)
        .filter(models.ListenHistory.source == "spotify")
        .order_by(models.ListenHistory.played_at.desc())
        .all()
    )

    # Group by spotify_track_id (fallback: title+artist)
    groups: dict[str, list[models.ListenHistory]] = defaultdict(list)
    for entry in entries:
        key = entry.spotify_track_id or f"{entry.track_title}|{entry.artist_name}"
        groups[key].append(entry)

    result = []
    for key, group_entries in groups.items():
        first = group_entries[0]
        # Find if any entry in this group is linked to a library song
        song_id = next((e.song_id for e in group_entries if e.song_id), None)
        availability = None
        if song_id:
            song = db.query(models.Song).filter(models.Song.id == song_id).first()
            availability = song.availability if song else None

        result.append(schemas.SpotifyHistoryTrack(
            spotify_track_id=first.spotify_track_id,
            track_title=first.track_title or "Unknown",
            artist_name=first.artist_name or "Unknown",
            album_name=first.album_name,
            cover_url=first.cover_url,
            duration_ms=first.duration_ms,
            play_count=len(group_entries),
            last_played_at=max(e.played_at for e in group_entries),
            plays=[
                schemas.SpotifyPlayEntry(played_at=e.played_at, source=e.source)
                for e in sorted(group_entries, key=lambda e: e.played_at, reverse=True)
            ],
            song_id=song_id,
            availability=availability,
        ))

    result.sort(key=lambda t: t.play_count, reverse=True)
    return result


@router.post("/spotify/history/add-to-library")
def add_history_to_library(
    spotify_track_id: str,
    availability: str = "available",
    db: Session = Depends(get_db),
):
    """Create a Song in the library from a Spotify history entry."""
    if availability not in ("available", "wishlist", "not_available"):
        raise HTTPException(400, "availability must be available, wishlist, or not_available")

    # Get a history entry with this track_id for the raw data
    entry = db.query(models.ListenHistory).filter(
        models.ListenHistory.spotify_track_id == spotify_track_id
    ).first()
    if not entry:
        raise HTTPException(404, "Track not found in history")

    # Check if already in library
    existing_song = db.query(models.Song).filter(
        models.Song.spotify_id == spotify_track_id
    ).first()
    if existing_song:
        # Just update availability
        existing_song.availability = availability
        db.commit()
        song_id = existing_song.id
    else:
        # Create artist
        artist_name = entry.artist_name or "Unknown"
        artist = (
            db.query(models.Artist)
            .filter(models.Artist.name.ilike(artist_name.strip()))
            .first()
        )
        if not artist:
            artist = models.Artist(name=artist_name.strip())
            db.add(artist)
            db.flush()

        # Create album if we have data
        album_id = None
        if entry.album_name:
            album = (
                db.query(models.Album)
                .filter(
                    models.Album.title.ilike(entry.album_name.strip()),
                    models.Album.artist_id == artist.id,
                )
                .first()
            )
            if not album:
                album = models.Album(
                    title=entry.album_name.strip(),
                    artist_id=artist.id,
                    cover_url=entry.cover_url,
                )
                db.add(album)
                db.flush()
            album_id = album.id

        duration_s = round(entry.duration_ms / 1000) if entry.duration_ms else None
        song = models.Song(
            title=entry.track_title or "Unknown",
            duration=duration_s,
            spotify_id=spotify_track_id,
            availability=availability,
            album_id=album_id,
        )
        db.add(song)
        db.flush()
        db.add(models.SongArtist(song_id=song.id, artist_id=artist.id, role="principal", order=0))
        song_id = song.id

    # Link all history entries for this track to the song
    db.query(models.ListenHistory).filter(
        models.ListenHistory.spotify_track_id == spotify_track_id
    ).update({"song_id": song_id})

    db.commit()
    return {"song_id": str(song_id), "availability": availability}
