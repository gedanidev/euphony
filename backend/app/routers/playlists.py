import csv
import io
import re
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from uuid import UUID
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/playlists", tags=["playlists"])


def _get_or_404(playlist_id: UUID, db: Session) -> models.Playlist:
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(404, "Playlist not found")
    return pl


def _load_detail(playlist_id: UUID, db: Session) -> models.Playlist:
    return (
        db.query(models.Playlist)
        .options(
            joinedload(models.Playlist.playlist_songs).joinedload(models.PlaylistSong.song)
        )
        .filter(models.Playlist.id == playlist_id)
        .first()
    )


def _to_detail(pl: models.Playlist) -> schemas.PlaylistDetailRead:
    result = schemas.PlaylistDetailRead.model_validate(pl)
    result.song_count = sum(1 for ps in pl.playlist_songs if ps.song_id is not None)
    result.playlist_songs = [
        schemas.PlaylistSongRead.model_validate(ps)
        for ps in sorted(pl.playlist_songs, key=lambda x: x.position)
    ]
    return result


_EXTINF_RE = re.compile(r"^#EXTINF:\s*(-?\d+)\s*,\s*(.+)$")


def _parse_m3u(content: str) -> list[dict]:
    """Returns list of {title, artist, path} dicts."""
    lines = content.splitlines()
    entries = []
    pending = None
    for raw in lines:
        line = raw.strip()
        if not line or line == "#EXTM3U" or line.startswith("#PLAYLIST:"):
            continue
        if line.startswith("#EXTINF:"):
            m = _EXTINF_RE.match(line)
            if m:
                display = m.group(2).strip()
                if " - " in display:
                    artist, title = display.split(" - ", 1)
                else:
                    artist, title = "", display
                pending = {"title": title.strip(), "artist": artist.strip(), "path": ""}
            continue
        if not line.startswith("#"):
            if pending is not None:
                pending["path"] = line
                entries.append(pending)
                pending = None
            else:
                entries.append({"title": "", "artist": "", "path": line})
    return entries


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=schemas.PaginatedPlaylists)
def list_playlists(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(models.Playlist)
    if search:
        q = q.filter(models.Playlist.name.ilike(f"%{search}%"))
    total = q.count()
    playlists = q.order_by(models.Playlist.name).offset((page - 1) * limit).limit(limit).all()

    items = []
    for pl in playlists:
        item = schemas.PlaylistRead.model_validate(pl)
        item.song_count = len(pl.playlist_songs)
        items.append(item)

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("", response_model=schemas.PlaylistRead, status_code=201)
def create_playlist(data: schemas.PlaylistCreate, db: Session = Depends(get_db)):
    pl = models.Playlist(**data.model_dump())
    db.add(pl)
    db.commit()
    db.refresh(pl)
    result = schemas.PlaylistRead.model_validate(pl)
    result.song_count = 0
    return result


@router.post("/import", response_model=schemas.PlaylistImportResult, status_code=201)
async def import_playlist(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content_bytes = await file.read()
    filename = file.filename or "imported"
    playlist_name = filename.rsplit(".", 1)[0]

    content = content_bytes.decode("utf-8", errors="replace")
    entries = _parse_m3u(content)

    if not entries:
        raise HTTPException(400, "No entries found in playlist file")

    pl = models.Playlist(name=playlist_name)
    db.add(pl)
    db.flush()

    matched = 0
    unresolved = 0

    for i, entry in enumerate(entries):
        song = None

        if entry["path"]:
            song = db.query(models.Song).filter(
                models.Song.walkman_path == entry["path"]
            ).first()

        if not song and entry["title"] and entry["artist"]:
            song = (
                db.query(models.Song)
                .join(models.SongArtist, models.SongArtist.song_id == models.Song.id, isouter=True)
                .join(models.Artist, models.Artist.id == models.SongArtist.artist_id, isouter=True)
                .filter(
                    models.Song.title.ilike(entry["title"]),
                    models.Artist.name.ilike(entry["artist"]),
                )
                .first()
            )

        ps = models.PlaylistSong(
            playlist_id=pl.id,
            song_id=song.id if song else None,
            position=i,
            raw_title=entry["title"] or None,
            raw_artist=entry["artist"] or None,
            raw_path=entry["path"] or None,
        )
        db.add(ps)

        if song:
            matched += 1
        else:
            unresolved += 1

    db.commit()

    return schemas.PlaylistImportResult(
        playlist_id=pl.id,
        playlist_name=playlist_name,
        total=len(entries),
        matched=matched,
        unresolved=unresolved,
    )


@router.get("/{playlist_id}", response_model=schemas.PlaylistDetailRead)
def get_playlist(playlist_id: UUID, db: Session = Depends(get_db)):
    pl = _load_detail(playlist_id, db)
    if not pl:
        raise HTTPException(404, "Playlist not found")
    return _to_detail(pl)


@router.put("/{playlist_id}", response_model=schemas.PlaylistRead)
def update_playlist(playlist_id: UUID, data: schemas.PlaylistUpdate, db: Session = Depends(get_db)):
    pl = _get_or_404(playlist_id, db)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(pl, k, v)
    db.commit()
    db.refresh(pl)
    result = schemas.PlaylistRead.model_validate(pl)
    result.song_count = len(pl.playlist_songs)
    return result


@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(playlist_id: UUID, db: Session = Depends(get_db)):
    pl = _get_or_404(playlist_id, db)
    db.delete(pl)
    db.commit()


# ── Songs in playlist ─────────────────────────────────────────────────────────

@router.post("/{playlist_id}/songs", response_model=schemas.PlaylistDetailRead)
def add_songs(playlist_id: UUID, data: schemas.BatchAddSongs, db: Session = Depends(get_db)):
    pl = _load_detail(playlist_id, db)
    if not pl:
        raise HTTPException(404, "Playlist not found")

    existing = {ps.song_id for ps in pl.playlist_songs}
    max_pos = max((ps.position for ps in pl.playlist_songs), default=-1)

    for song_id in data.song_ids:
        if song_id in existing:
            continue
        song = db.query(models.Song).filter(models.Song.id == song_id).first()
        if not song:
            raise HTTPException(404, f"Song {song_id} not found")
        max_pos += 1
        db.add(models.PlaylistSong(playlist_id=playlist_id, song_id=song_id, position=max_pos))
        existing.add(song_id)

    db.commit()
    pl = _load_detail(playlist_id, db)
    return _to_detail(pl)


@router.delete("/{playlist_id}/songs/{song_id}", response_model=schemas.PlaylistDetailRead)
def remove_song(playlist_id: UUID, song_id: UUID, db: Session = Depends(get_db)):
    ps = (
        db.query(models.PlaylistSong)
        .filter(
            models.PlaylistSong.playlist_id == playlist_id,
            models.PlaylistSong.song_id == song_id,
        )
        .first()
    )
    if not ps:
        raise HTTPException(404, "Song not in playlist")
    db.delete(ps)
    db.commit()
    pl = _load_detail(playlist_id, db)
    return _to_detail(pl)


@router.patch("/{playlist_id}/reorder", response_model=schemas.PlaylistDetailRead)
def reorder_songs(playlist_id: UUID, data: schemas.ReorderRequest, db: Session = Depends(get_db)):
    _get_or_404(playlist_id, db)
    position_map = {item.song_id: item.position for item in data.order}

    for ps in (
        db.query(models.PlaylistSong)
        .filter(models.PlaylistSong.playlist_id == playlist_id)
        .all()
    ):
        if ps.song_id in position_map:
            ps.position = position_map[ps.song_id]

    db.commit()
    pl = _load_detail(playlist_id, db)
    return _to_detail(pl)


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/{playlist_id}/export")
def export_playlist(
    playlist_id: UUID,
    format: str = Query("json", pattern="^(json|csv|m3u)$"),
    db: Session = Depends(get_db),
):
    pl = _load_detail(playlist_id, db)
    if not pl:
        raise HTTPException(404, "Playlist not found")

    songs = [ps.song for ps in sorted(pl.playlist_songs, key=lambda x: x.position) if ps.song is not None]

    if format == "json":
        payload = {
            "playlist": pl.name,
            "description": pl.description,
            "songs": [
                {
                    "position": i + 1,
                    "title": s.title,
                    "artist": s.artist_display,
                    "album": s.album,
                    "year": s.year,
                    "duration_s": s.duration,
                    "version_type": s.version_type,
                }
                for i, s in enumerate(songs)
            ],
        }
        return JSONResponse(
            content=payload,
            headers={"Content-Disposition": f'attachment; filename="{pl.name}.json"'},
        )

    if format == "m3u":
        lines = ["#EXTM3U", f"#PLAYLIST:{pl.name}"]
        skipped = 0
        for s in songs:
            path = s.walkman_path or s.file_path
            if not path:
                skipped += 1
                continue
            duration = s.duration if s.duration else -1
            artist = s.artist_display or ""
            title = s.title or ""
            lines.append(f"#EXTINF:{duration},{artist} - {title}")
            lines.append(path)
        if skipped:
            lines.insert(1, f"# WARNING: {skipped} song(s) excluded (no Walkman path)")
        content = "\n".join(lines) + "\n"
        safe_name = "".join(c for c in pl.name if c.isalnum() or c in " -_").strip()
        return StreamingResponse(
            iter([content]),
            media_type="audio/x-mpegurl",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.m3u"'},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["position", "title", "artist", "album", "year", "duration_s", "version_type"])
    for i, s in enumerate(songs):
        writer.writerow(
            [i + 1, s.title, s.artist_display, s.album or "", s.year or "", s.duration or "", s.version_type or ""]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{pl.name}.csv"'},
    )
