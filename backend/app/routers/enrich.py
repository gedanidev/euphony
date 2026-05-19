"""External API enrichment endpoints.

Integrates:
- MusicBrainz (via musicbrainzngs) — mbid, country, region
- TheAudioDB (HTTP) — artist images
- Cover Art Archive (HTTP) — album cover images
- LRCLIB (HTTP) — synchronized lyrics
"""

import asyncio
import httpx
import musicbrainzngs
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from uuid import UUID

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="", tags=["enrich"])

musicbrainzngs.set_useragent("Euphony", "0.2", "euphony.gedarc.com")

HEADERS = {"User-Agent": "Euphony/0.2 (euphony.gedarc.com)"}


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


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


async def _fetch_lrclib(title: str, artist: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            resp = await client.get(
                "https://lrclib.net/api/get",
                params={"artist_name": artist, "track_name": title},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"plain": data.get("plainLyrics"), "synced": data.get("syncedLyrics")}
    except Exception:
        pass
    return {"plain": None, "synced": None}


async def _fetch_cover_art(mbid: str) -> str | None:
    """Busca portada en Cover Art Archive por MBID."""
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS, follow_redirects=True) as client:
            resp = await client.get(f"https://coverartarchive.org/release/{mbid}")
            if resp.status_code == 200:
                data = resp.json()
                images = data.get("images", [])
                if images:
                    front = next((i for i in images if i.get("front")), images[0])
                    thumbs = front.get("thumbnails", {})
                    return thumbs.get("500") or thumbs.get("large") or front.get("image")
    except Exception:
        pass
    return None


async def _fetch_cover_by_name(album_title: str, artist_name: str | None) -> str | None:
    """Busca MBID en MusicBrainz y luego portada en Cover Art Archive."""
    try:
        kwargs = {"release": album_title, "limit": 5}
        if artist_name:
            kwargs["artist"] = artist_name
        result = musicbrainzngs.search_releases(**kwargs)
        releases = result.get("release-list", [])
        for release in releases:
            mbid = release.get("id")
            if mbid:
                cover = await _fetch_cover_art(mbid)
                if cover:
                    return cover, mbid
    except Exception:
        pass
    return None, None


async def _fetch_cover_candidates(album_title: str, artist_name: str | None) -> list[str]:
    """Devuelve hasta ~6 URLs de portada de TheAudioDB + Cover Art Archive."""
    candidates = []
    seen: set[str] = set()

    def _add(url: str | None):
        if url and url not in seen:
            seen.add(url)
            candidates.append(url)

    # TheAudioDB — generalmente más rápido y completo
    if artist_name:
        try:
            async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
                resp = await client.get(
                    "https://www.theaudiodb.com/api/v1/json/2/searchalbum.php",
                    params={"s": artist_name, "a": album_title},
                )
                if resp.status_code == 200:
                    for a in (resp.json().get("album") or [])[:3]:
                        _add(a.get("strAlbumThumb"))
                        _add(a.get("strAlbumCDart"))
        except Exception:
            pass

    # Cover Art Archive vía MusicBrainz
    try:
        kwargs: dict = {"release": album_title, "limit": 5}
        if artist_name:
            kwargs["artist"] = artist_name
        result = musicbrainzngs.search_releases(**kwargs)
        for release in (result.get("release-list") or [])[:5]:
            mbid = release.get("id")
            if mbid:
                _add(await _fetch_cover_art(mbid))
            if len(candidates) >= 6:
                break
    except Exception:
        pass

    return candidates


async def _fetch_artist_image_candidates(query: str) -> list[str]:
    """Devuelve URLs candidatas para imagen del artista (TheAudioDB + Wikipedia)."""
    candidates = []
    seen: set[str] = set()

    def _add(url: str | None):
        if url and url not in seen:
            seen.add(url)
            candidates.append(url)

    # TheAudioDB
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            resp = await client.get(
                "https://www.theaudiodb.com/api/v1/json/2/search.php",
                params={"s": query},
            )
            if resp.status_code == 200:
                for a in (resp.json().get("artists") or [])[:3]:
                    _add(a.get("strArtistThumb"))
                    _add(a.get("strArtistFanart"))
                    _add(a.get("strArtistFanart2"))
                    _add(a.get("strArtistFanart3"))
                    _add(a.get("strArtistBanner"))
    except Exception:
        pass

    # iTunes Search API — excelente cobertura global incluyendo artistas japoneses
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            resp = await client.get(
                "https://itunes.apple.com/search",
                params={"term": query, "media": "music", "entity": "musicArtist", "limit": 5},
            )
            if resp.status_code == 200:
                for a in (resp.json().get("results") or []):
                    url = a.get("artworkUrl100")
                    if url:
                        # Subir resolución: 100x100 → 500x500
                        _add(url.replace("100x100bb", "500x500bb"))
    except Exception:
        pass

    # Deezer API — sin key, buena cobertura internacional
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            resp = await client.get(
                "https://api.deezer.com/search/artist",
                params={"q": query, "limit": 5},
            )
            if resp.status_code == 200:
                for a in (resp.json().get("data") or []):
                    _add(a.get("picture_xl") or a.get("picture_big"))
    except Exception:
        pass

    # Wikipedia EN + JA — útil para artistas con perfil enciclopédico
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            for lang in ("en", "ja"):
                resp = await client.get(
                    f"https://{lang}.wikipedia.org/w/api.php",
                    params={
                        "action": "query",
                        "titles": query,
                        "prop": "pageimages",
                        "format": "json",
                        "pithumbsize": 500,
                    },
                )
                if resp.status_code == 200:
                    pages = resp.json().get("query", {}).get("pages", {})
                    for page in pages.values():
                        _add(page.get("thumbnail", {}).get("source"))
    except Exception:
        pass

    return candidates


async def _fetch_artist_image(artist_name: str) -> str | None:
    """Busca imagen del artista en TheAudioDB (primera opción)."""
    candidates = await _fetch_artist_image_candidates(artist_name)
    return candidates[0] if candidates else None


# ---------------------------------------------------------------------------
# Song enrichment
# ---------------------------------------------------------------------------

@router.post("/songs/{song_id}/enrich", response_model=schemas.SongRead)
def enrich_song(song_id: UUID, db: Session = Depends(get_db)):
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

    if not song.mbid and artist_name:
        try:
            result = musicbrainzngs.search_recordings(
                recording=song.title, artist=artist_name, limit=1
            )
            recordings = result.get("recording-list", [])
            if recordings:
                song.mbid = recordings[0].get("id")
        except Exception:
            pass

    if (not song.lyrics and not song.lyrics_lrc) and artist_name:
        lyrics_data = _run(_fetch_lrclib(song.title, artist_name))
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
    """Obtiene mbid/país/región de MusicBrainz e imagen de TheAudioDB."""
    artist = db.query(models.Artist).filter(models.Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(404, "Artist not found")

    # MusicBrainz — mbid, country, region
    try:
        result = musicbrainzngs.search_artists(artist=artist.name, limit=1)
        mb_artists = result.get("artist-list", [])
        if mb_artists:
            mb = mb_artists[0]
            if not artist.mbid:
                artist.mbid = mb.get("id")
            if not artist.country:
                artist.country = mb.get("country")
            if not artist.region:
                area = mb.get("begin-area") or mb.get("area")
                if area:
                    artist.region = area.get("name")
    except Exception:
        pass

    # TheAudioDB — imagen
    if not artist.image_url:
        image_url = _run(_fetch_artist_image(artist.name))
        if image_url:
            artist.image_url = image_url

    db.commit()
    db.refresh(artist)
    return artist


# ---------------------------------------------------------------------------
# Album enrichment
# ---------------------------------------------------------------------------

@router.post("/albums/{album_id}/enrich", response_model=schemas.AlbumRead)
def enrich_album(album_id: UUID, db: Session = Depends(get_db)):
    """Obtiene mbid de MusicBrainz y portada de Cover Art Archive."""
    album = (
        db.query(models.Album)
        .options(selectinload(models.Album.artist))
        .filter(models.Album.id == album_id)
        .first()
    )
    if not album:
        raise HTTPException(404, "Album not found")

    artist_name = album.artist.name if album.artist else None

    async def _enrich():
        mbid = album.mbid
        cover_url = None

        if not mbid:
            cover_url, mbid = await _fetch_cover_by_name(album.title, artist_name)

        if not cover_url and mbid:
            cover_url = await _fetch_cover_art(mbid)

        if not cover_url:
            candidates = await _fetch_cover_candidates(album.title, artist_name)
            cover_url = candidates[0] if candidates else None

        return mbid, cover_url

    mbid, cover_url = _run(_enrich())

    if mbid and not album.mbid:
        album.mbid = mbid
    if cover_url and not album.cover_url:
        album.cover_url = cover_url

    db.commit()
    db.refresh(album)
    return album
