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


def _extract_spotify_playlist_id(url_or_id: str) -> str:
    """Accepts a full Spotify playlist URL, a spotify: URI, or a bare ID."""
    match = re.search(r"playlist[/:]([a-zA-Z0-9]{22})", url_or_id)
    if match:
        return match.group(1)
    if re.fullmatch(r"[a-zA-Z0-9]{22}", url_or_id.strip()):
        return url_or_id.strip()
    raise HTTPException(400, "Invalid Spotify playlist URL")


def _fetch_spotify_playlist(playlist_url: str, db: Session) -> tuple[str, list[schemas.SpotifyImportTrack]]:
    """Fetch a playlist's name and tracks from Spotify using the app's own
    connected account (OAuth already set up in Settings) — no user-supplied
    token needed, and no client-side call to Spotify's API."""
    import spotipy
    from app.routers.auth import _get_connection, _get_oauth, _refresh_if_needed

    conn = _get_connection(db)
    if not conn:
        raise HTTPException(400, "Spotify not connected. Connect it in Settings first.")

    oauth = _get_oauth()
    access_token = _refresh_if_needed(conn, oauth, db)
    sp = spotipy.Spotify(auth=access_token)

    playlist_id = _extract_spotify_playlist_id(playlist_url)

    try:
        meta = sp.playlist(playlist_id, fields="name")
        playlist_name = meta.get("name") or "Imported from Spotify"
    except Exception as e:
        raise HTTPException(400, f"Could not read Spotify playlist: {e}")

    tracks: list[schemas.SpotifyImportTrack] = []
    results = sp.playlist_items(
        playlist_id,
        fields="items(track(name,artists(name),album(name),id)),next",
        additional_types=["track"],
    )
    while results:
        for item in results.get("items", []):
            track = item.get("track")
            if not track:
                continue
            tracks.append(schemas.SpotifyImportTrack(
                title=track.get("name") or "",
                artist=", ".join(a.get("name", "") for a in track.get("artists", [])),
                album=(track.get("album") or {}).get("name"),
                spotify_id=track.get("id"),
            ))
        results = sp.next(results) if results.get("next") else None

    return playlist_name, tracks


def _import_tracks_as_playlist(
    playlist_name: str,
    tracks: list[schemas.SpotifyImportTrack],
    db: Session,
    description: str = "",
) -> schemas.SpotifyPlaylistImportResult:
    """Match a flat track list against the local library and create a
    playlist from it. Shared by the JSON endpoint (URL fetch / manual paste)
    and the CSV upload endpoint (Exportify et al.) — same matching rules
    either way, so results don't quietly diverge between import paths."""
    pl = models.Playlist(name=playlist_name, description=description or "")
    db.add(pl)
    db.flush()

    matched = 0
    unresolved = 0
    unmatched_tracks = []

    for i, track in enumerate(tracks):
        song = None

        # 1. Exact match by spotify_id
        if track.spotify_id:
            song = db.query(models.Song).filter(
                models.Song.spotify_id == track.spotify_id
            ).first()

        # 2. Exact match by title + artist (case-insensitive)
        if not song and track.title and track.artist:
            song = (
                db.query(models.Song)
                .join(models.SongArtist, models.SongArtist.song_id == models.Song.id, isouter=True)
                .join(models.Artist, models.Artist.id == models.SongArtist.artist_id, isouter=True)
                .filter(
                    models.Song.title.ilike(track.title),
                    models.Artist.name.ilike(track.artist),
                )
                .first()
            )

        # 3. Fuzzy match: title contains search text AND artist contains search text
        if not song and track.title and track.artist:
            song = (
                db.query(models.Song)
                .join(models.SongArtist, models.SongArtist.song_id == models.Song.id, isouter=True)
                .join(models.Artist, models.Artist.id == models.SongArtist.artist_id, isouter=True)
                .filter(
                    models.Song.title.ilike(f"%{track.title}%"),
                    models.Artist.name.ilike(f"%{track.artist}%"),
                )
                .first()
            )

        ps = models.PlaylistSong(
            playlist_id=pl.id,
            song_id=song.id if song else None,
            position=i,
            raw_title=track.title or None,
            raw_artist=track.artist or None,
        )
        db.add(ps)

        if song:
            matched += 1
        else:
            unresolved += 1
            unmatched_tracks.append(track)

    db.commit()

    return schemas.SpotifyPlaylistImportResult(
        playlist_id=pl.id,
        playlist_name=playlist_name,
        total=len(tracks),
        matched=matched,
        unresolved=unresolved,
        unmatched_tracks=unmatched_tracks,
    )


@router.post("/import-spotify", response_model=schemas.SpotifyPlaylistImportResult, status_code=201)
def import_spotify_playlist(
    data: schemas.SpotifyPlaylistImportRequest,
    db: Session = Depends(get_db),
):
    """Import a playlist from Spotify by matching tracks against the local library.

    Two modes:
      - playlist_url set: fetch the playlist server-side via the app's own
        connected Spotify account (see Settings).
      - tracks set directly: manual paste-list mode, no Spotify account needed.
    """
    if data.playlist_url:
        playlist_name, tracks = _fetch_spotify_playlist(data.playlist_url, db)
    elif data.tracks is not None:
        playlist_name, tracks = (data.playlist_name or "Imported Playlist"), data.tracks
    else:
        raise HTTPException(400, "Either playlist_url or tracks must be provided")

    return _import_tracks_as_playlist(playlist_name, tracks, db, data.description or "")


# Exportify (and similar Spotify-playlist-export tools) column names we
# accept, in priority order per field — different forks/versions vary a bit.
_CSV_COLUMN_ALIASES = {
    "title": ["Track Name", "Name", "Title"],
    "artist": ["Artist Name(s)", "Artist Name", "Artist"],
    "album": ["Album Name", "Album"],
    "uri": ["Track URI", "URI", "Spotify URI"],
}


def _csv_field(row: dict, kind: str) -> str:
    for key in _CSV_COLUMN_ALIASES[kind]:
        if key in row and row[key]:
            return row[key]
    return ""


@router.post("/import-spotify-csv", response_model=schemas.SpotifyPlaylistImportResult, status_code=201)
async def import_spotify_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import a playlist from a CSV exported by a third-party tool (e.g.
    Exportify) — a workaround for Spotify blocking direct playlist reads
    for personal apps. Same matching rules as the other import paths."""
    content_bytes = await file.read()
    content = content_bytes.decode("utf-8-sig", errors="replace")  # -sig strips a BOM if present

    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames or not any(
        col in reader.fieldnames for aliases in _CSV_COLUMN_ALIASES.values() for col in aliases
    ):
        raise HTTPException(400, "This doesn't look like a playlist export CSV (no recognizable columns)")

    tracks = []
    for row in reader:
        title = _csv_field(row, "title")
        if not title:
            continue
        uri = _csv_field(row, "uri")
        spotify_id = uri.rsplit(":", 1)[-1] if uri.startswith("spotify:track:") else None
        tracks.append(schemas.SpotifyImportTrack(
            title=title,
            artist=_csv_field(row, "artist"),
            album=_csv_field(row, "album") or None,
            spotify_id=spotify_id,
        ))

    if not tracks:
        raise HTTPException(400, "No tracks found in this file")

    playlist_name = (file.filename or "Imported Playlist").rsplit(".", 1)[0]
    return _import_tracks_as_playlist(playlist_name, tracks, db)


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


@router.delete("/{playlist_id}/songs/{item_id}", response_model=schemas.PlaylistDetailRead)
def remove_song(playlist_id: UUID, item_id: UUID, db: Session = Depends(get_db)):
    """Remove one entry from a playlist, identified by the PlaylistSong row's
    own id (not the Song's id) — this also works for unresolved import
    entries, which have no song_id at all, and avoids ambiguity if the same
    song appears twice in a playlist."""
    ps = (
        db.query(models.PlaylistSong)
        .filter(
            models.PlaylistSong.playlist_id == playlist_id,
            models.PlaylistSong.id == item_id,
        )
        .first()
    )
    if not ps:
        raise HTTPException(404, "Entry not in playlist")
    db.delete(ps)
    db.commit()
    pl = _load_detail(playlist_id, db)
    return _to_detail(pl)


@router.patch("/{playlist_id}/reorder", response_model=schemas.PlaylistDetailRead)
def reorder_songs(playlist_id: UUID, data: schemas.ReorderRequest, db: Session = Depends(get_db)):
    _get_or_404(playlist_id, db)
    position_map = {item.item_id: item.position for item in data.order}

    for ps in (
        db.query(models.PlaylistSong)
        .filter(models.PlaylistSong.playlist_id == playlist_id)
        .all()
    ):
        if ps.id in position_map:
            ps.position = position_map[ps.id]

    db.commit()
    pl = _load_detail(playlist_id, db)
    return _to_detail(pl)


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/{playlist_id}/export")
def export_playlist(
    playlist_id: UUID,
    format: str = Query("json", pattern="^(json|csv|m3u)$"),
    relative: bool = Query(False, description="Generate relative paths for M3U export"),
    base_path: Optional[str] = Query(None, description="Base path to strip for relative M3U paths"),
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

            # Convert to relative path if requested
            if relative and base_path:
                import os
                # Normalize paths for comparison
                norm_path = os.path.normpath(path)
                norm_base = os.path.normpath(base_path)
                # Try to make relative
                if norm_path.startswith(norm_base + os.sep):
                    path = norm_path[len(norm_base) + 1:].replace(os.sep, "/")
                elif norm_path.startswith(norm_base):
                    path = norm_path[len(norm_base):].lstrip(os.sep).replace(os.sep, "/")

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
