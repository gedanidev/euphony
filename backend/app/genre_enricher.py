"""Genre enrichment for the Euphony library.

Flow:
  1. Resolve each song's principal artist genres via Last.fm (primary) or
     MusicBrainz tags (fallback) — by artist name only, no track lookup.
  2. Store primary_genre + subgenres on the song.

No Spotify involved: genre is an artist-level property, so there's no need
to disambiguate a specific track first. This also avoids Spotify's request
quota entirely (its Artist endpoint doesn't return genres for non-commercial
apps anyway, since late 2024 — see git history for the earlier approach).
"""

from __future__ import annotations

import os
import socket
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import musicbrainzngs
from sqlalchemy.orm import Session, selectinload

from app import models

musicbrainzngs.set_useragent("Euphony", "0.2", "euphony.gedarc.com")

HEADERS = {"User-Agent": "Euphony/0.2 (euphony.gedarc.com)"}

LASTFM_API_URL = "http://ws.audioscrobbler.com/2.0/"

# External API rate limit: stay conservative
REQUEST_DELAY_SECONDS = 1.1

# Max retries on HTTP 429 before giving up on a single request.
MAX_RATE_LIMIT_RETRIES = 5

# musicbrainzngs has no per-call timeout param; bound its socket use so a
# stalled/rate-limited MusicBrainz can't hang an entire batch run.
MUSICBRAINZ_TIMEOUT_SECONDS = 15

# Upper bound on how long we'll ever sleep for a single retry, regardless of
# what a server's Retry-After header asks for. A server under sustained load
# can legitimately send Retry-After values of minutes or hours — obeying
# that literally stalls the whole batch on one song.
MAX_RETRY_WAIT_SECONDS = 20


def _get_with_retry(url: str, headers: dict, params: Optional[dict] = None) -> httpx.Response:
    """GET that backs off and retries on 429 instead of treating it as a
    real "not found" response.

    Honors Retry-After when the server sends one, capped at
    MAX_RETRY_WAIT_SECONDS. If the server's actual requested wait exceeds
    that cap, retrying at all is futile within our budget (it's signaling a
    long-duration block, not a short burst limit) — give up immediately
    instead of burning MAX_RATE_LIMIT_RETRIES capped-but-still-slow sleeps
    for a guaranteed-to-fail retry.
    """
    resp = httpx.get(url, headers=headers, params=params, timeout=30)
    attempt = 0
    while resp.status_code == 429 and attempt < MAX_RATE_LIMIT_RETRIES:
        retry_after_hdr = resp.headers.get("Retry-After")
        requested_wait = (
            float(retry_after_hdr)
            if retry_after_hdr and retry_after_hdr.replace(".", "", 1).isdigit()
            else 2 ** attempt
        )
        if requested_wait > MAX_RETRY_WAIT_SECONDS:
            break
        time.sleep(requested_wait)
        resp = httpx.get(url, headers=headers, params=params, timeout=30)
        attempt += 1
    return resp


# ---------------------------------------------------------------------------
# Genre resolution
# ---------------------------------------------------------------------------

def _fetch_artist_genres_lastfm(artist_name: str) -> list[str]:
    """Return list of genres for an artist via Last.fm artist.getTopTags.
    Requires LASTFM_API_KEY in the environment."""
    api_key = os.environ.get("LASTFM_API_KEY", "")
    if not api_key:
        return []

    params = {
        "method": "artist.getTopTags",
        "artist": artist_name,
        "api_key": api_key,
        "format": "json",
    }
    resp = _get_with_retry(LASTFM_API_URL, HEADERS, params=params)
    if resp.status_code != 200:
        return []

    try:
        data = resp.json()
    except Exception:
        return []

    toptags = data.get("toptags", {})
    tags = toptags.get("tag", [])
    if not isinstance(tags, list):
        tags = [tags] if tags else []

    # Exclude personal/non-genre tags that frequently pollute Last.fm data
    _EXCLUDED_TAGS = {
        "seen live", "favorites", "seen in concert", "want to see live",
        "concert", "live", "check out later", "under 2000 listeners",
        "spotify", "similar", "less than 100 listeners", "recommended",
        "heard on pandora", "heard on spotify", "my spotify", "playlist",
        "female vocalists", "male vocalists", "split-up", "active",
        "nostalgia", "childhood", "oldies", "guilty pleasure",
        "awesome", "amazing", "beautiful", "cool", "love",
    }

    genres = []
    for tag in tags:
        name = tag.get("name", "").lower().strip()
        if name and name not in _EXCLUDED_TAGS:
            genres.append(name)

    return genres


def _fetch_artist_genres_musicbrainz(artist_name: str) -> list[str]:
    """Return list of genres for an artist via MusicBrainz tags.
    Uses musicbrainzngs (already configured in this module).

    musicbrainzngs doesn't take a per-call timeout, and under sustained load
    MusicBrainz can 503 (rate limit) or just stop responding — without a
    socket-level timeout that hangs the whole batch on a single artist
    indefinitely. Bound it explicitly, scoped to just this call so it
    doesn't affect unrelated socket usage elsewhere in the process.
    """
    old_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(MUSICBRAINZ_TIMEOUT_SECONDS)
    try:
        try:
            result = musicbrainzngs.search_artists(artist=artist_name, limit=1)
        except Exception:
            return []

        mb_artists = result.get("artist-list", [])
        if not mb_artists:
            return []

        mbid = mb_artists[0].get("id")
        if not mbid:
            return []

        try:
            artist_data = musicbrainzngs.get_artist_by_id(mbid, includes=["tags"])
        except Exception:
            return []
    finally:
        socket.setdefaulttimeout(old_timeout)

    artist_info = artist_data.get("artist", {})
    tag_list = artist_info.get("tag-list", [])

    # Sort by tag usage count (descending) so the most representative
    # genres come first.
    sorted_tags = sorted(
        tag_list,
        key=lambda t: int(t.get("count", 0)),
        reverse=True,
    )

    genres = []
    for tag in sorted_tags:
        name = tag.get("name", "").lower().strip()
        if name:
            genres.append(name)

    return genres


def _resolve_artist_genres(artist_name: str, cache: Optional[dict] = None) -> tuple[list[str], bool]:
    """Resolve artist genres: Last.fm first, MusicBrainz fallback.

    `cache` is a dict shared across a batch run, keyed by normalized artist
    name. A library commonly has far fewer distinct artists than songs (e.g.
    20 songs from the same band), so without it every song re-queries Last.fm
    /MusicBrainz for genres it already looked up.

    Returns (genres, from_cache) — callers use `from_cache` to skip the
    rate-limit delay when no network call was actually made.
    """
    if not artist_name:
        return [], False

    key = artist_name.strip().lower()
    if cache is not None and key in cache:
        return cache[key], True

    # 1. Last.fm (primary)
    genres = _fetch_artist_genres_lastfm(artist_name)
    if not genres:
        # 2. MusicBrainz (fallback)
        genres = _fetch_artist_genres_musicbrainz(artist_name)

    if cache is not None:
        cache[key] = genres
    return genres, False


# ---------------------------------------------------------------------------
# Principal artist helper
# ---------------------------------------------------------------------------

def _principal_artist_name(song: models.Song) -> str:
    for sa in song.song_artists:
        if sa.role == "principal":
            return sa.artist.name
    if song.song_artists:
        return song.song_artists[0].artist.name
    return ""


# ---------------------------------------------------------------------------
# Single-song enrichment
# ---------------------------------------------------------------------------

def enrich_song_genres(
    song: models.Song,
    db: Session,
    genre_cache: Optional[dict] = None,
) -> dict:
    """Enrich one song with genre data from Last.fm / MusicBrainz.

    Returns a result dict:
        {
            "found": bool,
            "primary_genre": str | None,
            "subgenres": list[str],
            "error": str | None,
        }
    """
    result = {
        "found": False,
        "primary_genre": None,
        "subgenres": [],
        "error": None,
    }

    artist_name = _principal_artist_name(song)
    if not artist_name:
        result["error"] = "No principal artist"
        return result

    genres, from_cache = _resolve_artist_genres(artist_name, genre_cache)
    if not from_cache:
        time.sleep(REQUEST_DELAY_SECONDS)

    if not genres:
        result["error"] = "No genre data (Last.fm/MusicBrainz)"
        return result

    result["found"] = True
    result["primary_genre"] = genres[0]
    result["subgenres"] = genres[1:] if len(genres) > 1 else []

    song.primary_genre = result["primary_genre"]
    song.subgenres = result["subgenres"]
    song.updated_at = datetime.now(timezone.utc)

    db.commit()
    return result


# ---------------------------------------------------------------------------
# Batch worker (callable from router or CLI script)
# ---------------------------------------------------------------------------

def run_genre_enrichment_batch(
    db: Session,
    job_id: str,
    jobs_registry: dict,
    limit: Optional[int] = None,
) -> None:
    """Run the genre enrichment batch job.

    `jobs_registry` is a shared dict (e.g. _enrich_jobs) used to track progress.
    Set `limit` for testing with a small subset.
    """
    # Songs still missing a genre (spotify_id is no longer part of this
    # pipeline's job — a song with a genre already but no spotify_id isn't
    # re-processed here).
    q = (
        db.query(models.Song)
        .options(
            selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist),
        )
        .filter(models.Song.primary_genre.is_(None))
    )

    if limit:
        q = q.limit(limit)

    songs = q.all()
    total = len(songs)
    jobs_registry[job_id] = {
        "status": "running",
        "total": total,
        "processed": 0,
        "found": 0,
        "failed": 0,
        "errors": [],
    }

    genre_cache: dict = {}

    for i, song in enumerate(songs):
        if jobs_registry[job_id].get("cancelled"):
            jobs_registry[job_id]["status"] = "cancelled"
            return

        try:
            result = enrich_song_genres(song, db, genre_cache)
            if result["found"]:
                jobs_registry[job_id]["found"] += 1
            elif result.get("error"):
                jobs_registry[job_id]["failed"] += 1
                # Keep last 10 errors
                errors = jobs_registry[job_id]["errors"]
                errors.append(f"{song.title}: {result['error']}")
                jobs_registry[job_id]["errors"] = errors[-10:]
        except Exception as e:
            db.rollback()
            jobs_registry[job_id]["failed"] += 1
            errors = jobs_registry[job_id]["errors"]
            errors.append(f"{song.title}: {e}")
            jobs_registry[job_id]["errors"] = errors[-10:]

        jobs_registry[job_id]["processed"] = i + 1

    jobs_registry[job_id].update({
        "status": "done",
        "total": total,
        "processed": total,
    })
