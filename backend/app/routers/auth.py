"""Spotify OAuth integration.

Flow:
  1. GET /api/auth/spotify/login  → redirects user to Spotify authorization URL
  2. Spotify redirects to GET /api/auth/spotify/callback?code=...
  3. Backend exchanges code for tokens, stores in user_connections table
  4. POST /api/auth/spotify/sync  → imports last 50 played tracks
"""

import os
from datetime import datetime, timezone
from typing import Optional

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


def _get_or_create_artist(db: Session, name: str, spotify_id: str | None = None) -> models.Artist:
    q = db.query(models.Artist)
    if spotify_id:
        existing = q.filter(models.Artist.spotify_id == spotify_id).first()
        if existing:
            return existing
    existing = q.filter(models.Artist.name.ilike(name.strip())).first()
    if existing:
        return existing
    artist = models.Artist(name=name.strip(), spotify_id=spotify_id)
    db.add(artist)
    db.flush()
    return artist


def _get_or_create_song(
    db: Session,
    title: str,
    artist: models.Artist,
    duration_ms: int | None,
    spotify_id: str | None,
) -> tuple[models.Song, bool]:
    """Returns (song, created: bool)"""
    if spotify_id:
        existing = db.query(models.Song).filter(models.Song.spotify_id == spotify_id).first()
        if existing:
            return existing, False

    existing = (
        db.query(models.Song)
        .join(models.SongArtist, models.SongArtist.song_id == models.Song.id)
        .filter(
            models.Song.title.ilike(title.strip()),
            models.SongArtist.artist_id == artist.id,
        )
        .first()
    )
    if existing:
        return existing, False

    duration_s = round(duration_ms / 1000) if duration_ms else None
    song = models.Song(
        title=title.strip(),
        duration=duration_s,
        spotify_id=spotify_id,
        availability="available",
    )
    db.add(song)
    db.flush()
    db.add(models.SongArtist(song_id=song.id, artist_id=artist.id, role="principal", order=0))
    return song, True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/spotify/login")
def spotify_login():
    """Returns the Spotify authorization URL. Frontend should redirect to it."""
    oauth = _get_oauth()
    auth_url = oauth.get_authorize_url()
    return {"auth_url": auth_url}


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
    """Import last 50 recently played tracks from Spotify."""
    conn = _get_connection(db)
    if not conn:
        raise HTTPException(400, "Spotify not connected. Connect first via /auth/spotify/login")

    oauth = _get_oauth()
    token_info = {
        "access_token": conn.access_token,
        "refresh_token": conn.refresh_token,
        "token_type": "Bearer",
        "expires_at": int(conn.expires_at.timestamp()) if conn.expires_at else 0,
        "scope": SPOTIFY_SCOPE,
    }

    # Refresh token if expired
    if oauth.is_token_expired(token_info):
        token_info = oauth.refresh_access_token(conn.refresh_token)
        conn.access_token = token_info["access_token"]
        if token_info.get("refresh_token"):
            conn.refresh_token = token_info["refresh_token"]
        if token_info.get("expires_at"):
            conn.expires_at = datetime.fromtimestamp(token_info["expires_at"], tz=timezone.utc)
        db.commit()

    sp = spotipy.Spotify(auth=conn.access_token)
    recently_played = sp.current_user_recently_played(limit=50)

    created_songs = 0
    matched_songs = 0
    history_added = 0

    for item in recently_played.get("items", []):
        track = item.get("track")
        played_at_str = item.get("played_at")
        if not track or not played_at_str:
            continue

        # Parse played_at
        played_at = datetime.fromisoformat(played_at_str.replace("Z", "+00:00"))

        # Get primary artist
        sp_artists = track.get("artists", [])
        if not sp_artists:
            continue
        primary_sp_artist = sp_artists[0]
        artist = _get_or_create_artist(
            db,
            name=primary_sp_artist.get("name", "Unknown"),
            spotify_id=primary_sp_artist.get("id"),
        )

        song, was_created = _get_or_create_song(
            db,
            title=track.get("name", "Unknown"),
            artist=artist,
            duration_ms=track.get("duration_ms"),
            spotify_id=track.get("id"),
        )

        if was_created:
            created_songs += 1
        else:
            matched_songs += 1

        # Record listen history (avoid duplicates for same song + played_at)
        existing_history = db.query(models.ListenHistory).filter(
            models.ListenHistory.song_id == song.id,
            models.ListenHistory.played_at == played_at,
        ).first()
        if not existing_history:
            db.add(models.ListenHistory(
                song_id=song.id,
                played_at=played_at,
                source="spotify",
            ))
            history_added += 1

    db.commit()
    return {
        "songs_created": created_songs,
        "songs_matched": matched_songs,
        "history_entries_added": history_added,
    }
