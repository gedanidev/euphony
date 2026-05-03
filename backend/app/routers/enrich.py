"""External API enrichment endpoints.

Integrates:
- MusicBrainz (via musicbrainzngs) — mbid, country, bio
- LRCLIB (HTTP) — synchronized lyrics
- Cover Art Archive (HTTP) — album cover images
"""

import httpx
import musicbrainzngs
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="", tags=["enrich"])

musicbrainzngs.set_useragent("Euphony", "0.2", "euphony@local")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _principal_artist_name(song: models.Song) -> str:
    for sa in song.song_artists:
        if sa.role == "principal":
            return sa.artist.name
    if song.song_artists:
        return song.song_artists[0].artist.name
    return ""


async def _fetch_lrclib(title: str, artist: str) -> dict:
    """Returns {"plain": str|None, "synced": str|None}"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://lrclib.net/api/get",
                params={"artist_name": artist, "track_name": title},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "plain": data.get("plainLyrics"),
                    "synced": data.get("syncedLyrics"),
                }
    except Exception:
        pass
    return {"plain": None, "synced": None}


async def _fetch_cover_art(mbid: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://coverartarchive.org/release/{mbid}",
                follow_redirects=True,
            )
            if resp.status_code == 200:
                data = resp.json()
                images = data.get("images", [])
                if images:
                    thumbnails = images[0].get("thumbnails", {})
                    return thumbnails.get("500") or thumbnails.get("large") or images[0].get("image")
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Song enrichment
# ---------------------------------------------------------------------------

@router.post("/songs/{song_id}/enrich", response_model=schemas.SongRead)
def enrich_song(song_id: UUID, db: Session = Depends(get_db)):
    """Fetch mbid from MusicBrainz and lyrics from LRCLIB."""
    from sqlalchemy.orm import selectinload
    import asyncio

    song = (
        db.query(models.Song)
        .options(
            selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist),
            selectinload(models.Song.song_composers).selectinload(models.SongComposer.artist),
            selectinload(models.Song.song_genres).selectinload(models.SongGenre.genre),
            selectinload(models.Song.song_moods).selectinload(models.SongMood.mood),
            selectinload(models.Song.album).selectinload(models.Album.artist),
        )
        .filter(models.Song.id == song_id)
        .first()
    )
    if not song:
        raise HTTPException(404, "Song not found")

    artist_name = _principal_artist_name(song)

    # MusicBrainz lookup
    if not song.mbid and artist_name:
        try:
            result = musicbrainzngs.search_recordings(
                recording=song.title,
                artist=artist_name,
                limit=1,
            )
            recordings = result.get("recording-list", [])
            if recordings:
                song.mbid = recordings[0].get("id")
        except Exception:
            pass

    # LRCLIB lyrics
    if (not song.lyrics and not song.lyrics_lrc) and artist_name:
        async def _get_lyrics():
            return await _fetch_lrclib(song.title, artist_name)

        lyrics_data = asyncio.get_event_loop().run_until_complete(_get_lyrics())
        if lyrics_data["plain"]:
            song.lyrics = lyrics_data["plain"]
        if lyrics_data["synced"]:
            song.lyrics_lrc = lyrics_data["synced"]

    db.commit()
    db.refresh(song)
    return song


# ---------------------------------------------------------------------------
# Artist enrichment
# ---------------------------------------------------------------------------

@router.post("/artists/{artist_id}/enrich", response_model=schemas.ArtistRead)
def enrich_artist(artist_id: UUID, db: Session = Depends(get_db)):
    """Fetch mbid, country and region from MusicBrainz."""
    artist = db.query(models.Artist).filter(models.Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(404, "Artist not found")

    try:
        result = musicbrainzngs.search_artists(artist=artist.name, limit=1)
        artists = result.get("artist-list", [])
        if artists:
            mb_artist = artists[0]
            if not artist.mbid:
                artist.mbid = mb_artist.get("id")
            if not artist.country:
                artist.country = mb_artist.get("country")
            if not artist.region:
                area = mb_artist.get("begin-area") or mb_artist.get("area")
                if area:
                    artist.region = area.get("name")
    except Exception:
        pass

    db.commit()
    db.refresh(artist)
    return artist


# ---------------------------------------------------------------------------
# Album enrichment
# ---------------------------------------------------------------------------

@router.post("/albums/{album_id}/enrich", response_model=schemas.AlbumRead)
def enrich_album(album_id: UUID, db: Session = Depends(get_db)):
    """Fetch mbid from MusicBrainz and cover_url from Cover Art Archive."""
    from sqlalchemy.orm import selectinload
    import asyncio

    album = (
        db.query(models.Album)
        .options(selectinload(models.Album.artist))
        .filter(models.Album.id == album_id)
        .first()
    )
    if not album:
        raise HTTPException(404, "Album not found")

    artist_name = album.artist.name if album.artist else None

    # MusicBrainz lookup
    if not album.mbid:
        try:
            kwargs = {"release": album.title, "limit": 1}
            if artist_name:
                kwargs["artist"] = artist_name
            result = musicbrainzngs.search_releases(**kwargs)
            releases = result.get("release-list", [])
            if releases:
                album.mbid = releases[0].get("id")
        except Exception:
            pass

    # Cover Art Archive
    if album.mbid and not album.cover_url:
        async def _get_cover():
            return await _fetch_cover_art(album.mbid)

        cover_url = asyncio.get_event_loop().run_until_complete(_get_cover())
        if cover_url:
            album.cover_url = cover_url

    db.commit()
    db.refresh(album)
    return album
