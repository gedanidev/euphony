import io
import plistlib
import re
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/import", tags=["import"])

# Matches:  #EXTINF:duration,Artist - Title
_EXTINF_RE = re.compile(r"^#EXTINF:\s*(-?\d+)\s*,\s*(.+)$")


def _get_or_create_artist(db: Session, name: str) -> models.Artist:
    name = name.strip()
    artist = db.query(models.Artist).filter(
        models.Artist.name.ilike(name)
    ).first()
    if not artist:
        artist = models.Artist(name=name)
        db.add(artist)
        db.flush()
    return artist


def _get_or_create_album(
    db: Session, title: str, artist: models.Artist | None
) -> models.Album:
    title = title.strip()
    q = db.query(models.Album).filter(models.Album.title.ilike(title))
    if artist:
        q = q.filter(models.Album.artist_id == artist.id)
    album = q.first()
    if not album:
        album = models.Album(
            title=title,
            artist_id=artist.id if artist else None,
        )
        db.add(album)
        db.flush()
    return album


def _find_song(db: Session, title: str, artist_id) -> models.Song | None:
    from sqlalchemy.orm import selectinload
    return (
        db.query(models.Song)
        .join(models.SongArtist, models.SongArtist.song_id == models.Song.id)
        .filter(
            models.Song.title.ilike(title.strip()),
            models.SongArtist.artist_id == artist_id,
        )
        .first()
    )


@router.post("/m3u8", response_model=schemas.ImportSummary)
async def import_m3u8(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Parse an M3U/M3U8 file and import songs into the library.

    Expected format:
        #EXTM3U
        #EXTINF:245,Artist Name - Song Title
        /path/to/file.mp3
        ...

    Songs are matched case-insensitively by title + principal artist.
    New artists and songs are created automatically.
    """
    content = (await file.read()).decode("utf-8", errors="replace")
    lines = content.splitlines()

    created = 0
    matched = 0
    failed = 0
    failed_lines: list[str] = []

    pending_extinf: tuple | None = None  # (duration_seconds, display_string)

    for raw_line in lines:
        line = raw_line.strip()

        if not line or line == "#EXTM3U":
            continue

        if line.startswith("#EXTINF:"):
            m = _EXTINF_RE.match(line)
            if m:
                duration = int(m.group(1))
                display = m.group(2).strip()
                pending_extinf = (duration, display)
            else:
                failed += 1
                failed_lines.append(raw_line)
            continue

        # Non-comment line = file path; process with the queued EXTINF
        if pending_extinf is None:
            # File path without preceding EXTINF — skip silently
            continue

        duration, display = pending_extinf
        pending_extinf = None

        # Parse "Artist - Title" — split on first " - "
        if " - " in display:
            artist_name, title = display.split(" - ", 1)
        else:
            artist_name = "Unknown"
            title = display

        artist_name = artist_name.strip()
        title = title.strip()

        if not title:
            failed += 1
            failed_lines.append(raw_line)
            continue

        try:
            artist = _get_or_create_artist(db, artist_name)
            existing = _find_song(db, title, artist.id)

            if existing:
                matched += 1
            else:
                song = models.Song(
                    title=title,
                    duration=duration if duration > 0 else None,
                    availability="available",
                )
                db.add(song)
                db.flush()
                db.add(models.SongArtist(
                    song_id=song.id,
                    artist_id=artist.id,
                    role="principal",
                    order=0,
                ))
                created += 1
        except Exception:
            db.rollback()
            failed += 1
            failed_lines.append(raw_line)
            continue

    db.commit()
    return schemas.ImportSummary(
        created=created,
        matched=matched,
        failed=failed,
        failed_lines=failed_lines,
    )


@router.post("/itunes-xml", response_model=schemas.ImportSummary)
async def import_itunes_xml(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Parse an iTunes/plist XML library file and import songs.

    Supports the standard iTunes plist XML format (also used by PowerAmp
    and other apps). Extracts Name, Artist, and Album from each track.
    Songs are matched case-insensitively by title + principal artist.
    New artists, albums, and songs are created automatically.
    """
    raw = await file.read()
    try:
        plist = plistlib.load(io.BytesIO(raw))
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Invalid plist XML: {exc}")

    tracks: dict = plist.get("Tracks", {})

    created = 0
    matched = 0
    failed = 0
    failed_lines: list[str] = []

    for track_id, track in tracks.items():
        title = (track.get("Name") or "").strip()
        artist_name = (track.get("Artist") or "").strip()
        album_name = (track.get("Album") or "").strip()

        if not title:
            failed += 1
            failed_lines.append(f"Track {track_id}: missing Name")
            continue

        try:
            artist = _get_or_create_artist(db, artist_name) if artist_name else None
            album = _get_or_create_album(db, album_name, artist) if album_name else None

            existing = _find_song(db, title, artist.id) if artist else (
                db.query(models.Song).filter(models.Song.title.ilike(title)).first()
            )

            if existing:
                matched += 1
            else:
                song = models.Song(
                    title=title,
                    album_id=album.id if album else None,
                    availability="available",
                )
                db.add(song)
                db.flush()
                if artist:
                    db.add(models.SongArtist(
                        song_id=song.id,
                        artist_id=artist.id,
                        role="principal",
                        order=0,
                    ))
                created += 1

            # Commit in batches to avoid giant transactions
            if (created + matched) % 500 == 0:
                db.commit()

        except Exception as exc:
            db.rollback()
            failed += 1
            failed_lines.append(f"Track {track_id} ({title}): {exc}")
            continue

    db.commit()
    return schemas.ImportSummary(
        created=created,
        matched=matched,
        failed=failed,
        failed_lines=failed_lines[:50],  # cap to avoid huge responses
    )
