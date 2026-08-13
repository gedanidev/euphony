# Walkman Sync, Wishlist & Playlists Design

## Goal

Replace dummy library data with a real music collection synced from a Sony Walkman XML backup (Apple plist format). Add wishlist management for songs to acquire, and a full playlist system with manual selection, M3U export/import, and Walkman compatibility.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, React, Tailwind

---

## Section 1: Data Model

### Changes to `Song`

Add the following columns:

| Column | Type | Notes |
|---|---|---|
| `walkman_status` | `VARCHAR(20)` | `'on_walkman'` / `'wishlist'` / `'removed'` / `NULL` |
| `walkman_path` | `VARCHAR(500)` | File path on device, e.g. `/storage/emulated/0/Music/Song.flac` |
| `walkman_play_count` | `INTEGER` | Play Count from XML |
| `walkman_skip_count` | `INTEGER` | Skip Count from XML |
| `walkman_size` | `BIGINT` | File size in bytes from XML |

Song rating already exists — XML `Rating` maps to it on import.

**Wishlist songs** are regular `Song` rows with `walkman_status = 'wishlist'` and minimal metadata (title + artist mandatory, album optional). They have no file or audio data.

### New table: `Playlist`

```
id          UUID PK
name        VARCHAR(200) NOT NULL
description TEXT
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

### New table: `PlaylistSong`

```
id            UUID PK
playlist_id   UUID FK → Playlist
song_id       UUID FK → Song (nullable)
position      INTEGER NOT NULL
raw_title     VARCHAR(500)   -- for unresolved entries from imported playlists
raw_artist    VARCHAR(500)   -- for unresolved entries
raw_path      VARCHAR(500)   -- original path from M3U
```

`song_id` is nullable to support unresolved entries from imported playlists. When `song_id` is NULL, `raw_title`/`raw_artist`/`raw_path` hold the original data.

---

## Section 2: Walkman XML Sync

### File format

Apple plist XML (iTunes Library export from Walkman app). Per-track fields used:

- `Name` → `title`
- `Artist` → artist name (matched or created)
- `Album` → album name (matched or created)
- `Rating` → `rating`
- `Play Count` → `walkman_play_count`
- `Skip Count` → `walkman_skip_count`
- `Size` → `walkman_size`
- `Location` → `walkman_path` (primary match key)

### Sync algorithm

**Match key:** `walkman_path` (Location field). Stable across exports unlike Track ID.

**Per track in XML:**
1. Look up existing Song by `walkman_path`
2. **Found:** update `walkman_play_count`, `walkman_skip_count`, `walkman_size`, `rating`, set `walkman_status = 'on_walkman'`
3. **Not found by path:** try fuzzy match by `title + artist` (case-insensitive)
   - Match found and `walkman_status = 'wishlist'` → update to `'on_walkman'`, fill in path and metadata
   - Match found (normal song) → link path, set `'on_walkman'`
   - No match → create new Song with `walkman_status = 'on_walkman'`

**After processing all XML tracks:**
- Songs in DB with `walkman_status = 'on_walkman'` that were NOT seen in this XML → set `walkman_status = 'removed'`

**First run:** The upload UI shows a confirmation step warning that all existing songs without a `walkman_path` will be deleted before sync. User must confirm explicitly. This is a one-time operation to replace dummy data with the real collection.

### Sync response

Return a summary object:
```json
{
  "added": 0,
  "updated": 0,
  "wishlist_completed": 0,
  "removed": 0,
  "errors": []
}
```

### Backend endpoint

`POST /songs/walkman-sync` — multipart file upload, returns sync summary.

Processing is done synchronously (XML is parsed in-memory, 16k tracks is manageable at ~50ms parse time). No background job needed.

---

## Section 3: Wishlist

Wishlist entries are Songs with `walkman_status = 'wishlist'`.

### Creating a wishlist item

Minimal form: **Title** + **Artist** (required). Album and notes (stored in a new `wishlist_notes VARCHAR(500)` column on Song) are optional.

### Wishlist view

Dedicated page `/wishlist` in the sidebar with a badge showing pending count. Shows all songs with `walkman_status = 'wishlist'`.

Actions per item:
- **Mark as acquired** — manually set `walkman_status = 'removed'` (have it but not on Walkman yet) or `'on_walkman'` if already transferred
- **Delete** — remove from wishlist entirely
- **Edit** — update title, artist, album, notes

### Auto-completion on sync

During XML sync, if a wishlist item matches (by title+artist) a track in the XML, it is automatically moved to `'on_walkman'` and the path/metadata is filled in. This is reported in the sync summary as `wishlist_completed`.

### Column added to `Song`

`wishlist_notes VARCHAR(500) NULLABLE`

---

## Section 4: Playlists

### Manual playlist creation

From any song list view (Library, ArtistDetail, AlbumDetail), songs have a checkbox for multi-select. A floating action bar appears when songs are selected showing:

- **Add to playlist** — add selected songs to an existing playlist
- **New playlist** — create a new playlist with selected songs

### Playlist management page

Route: `/playlists` (replaces or extends current playlists page)

Shows all playlists (manual + smart). Manual playlists show song count and creation date. Actions: rename, delete, reorder songs (drag or up/down arrows), remove individual songs.

### M3U Export (Walkman)

On any playlist detail page: **"Export M3U"** button.

Generates a `.m3u` file:
```
#EXTM3U
#EXTINF:duration,Artist - Title
/storage/emulated/0/Music/filename.flac
```

Only songs with a `walkman_path` are included. Songs without a path are skipped with a warning showing how many were excluded.

### Playlist Import

Upload a `.m3u`, `.xspf`, or `.pls` file. The system:

1. Parses entries (title, artist, path from file)
2. For each entry, attempts match against library:
   - By `walkman_path` (exact match)
   - By `title + artist` (case-insensitive fallback)
3. Creates the playlist with matched songs linked (`song_id` set)
4. Unmatched entries stored as unresolved (`song_id = NULL`, raw fields populated)
5. **Does NOT create new songs** — only links existing library entries

Import response shows: playlist name, total entries, matched count, unresolved count.

Unresolved entries are shown in the playlist UI with an "unlinked" indicator — they're visible but grayed out.

### Backend endpoints

```
GET    /playlists                    list all playlists
POST   /playlists                    create playlist
GET    /playlists/{id}               playlist detail with songs
PATCH  /playlists/{id}               rename / update description
DELETE /playlists/{id}               delete playlist
POST   /playlists/{id}/songs         add songs (array of song_ids)
DELETE /playlists/{id}/songs/{pos}   remove song at position
PATCH  /playlists/{id}/reorder       reorder songs
GET    /playlists/{id}/export.m3u    download M3U file
POST   /playlists/import             upload M3U/XSPF/PLS file
POST   /songs/walkman-sync           upload XML, run sync
```

---

## Section 5: Navigation & UI Changes

- Sidebar: add **Wishlist** nav item with pending badge
- Library: add `walkman_status` filter (on Walkman / Wishlist / Removed / All)
- Library: multi-select checkboxes for playlist operations
- Playlists page: distinguish manual playlists from smart playlists visually

---

## Walkman Status Values

| Value | Meaning |
|---|---|
| `on_walkman` | Song is physically on the Walkman |
| `wishlist` | Want to acquire for Walkman, don't have it yet |
| `removed` | Was on Walkman, no longer present |
| `NULL` | Status unknown (legacy data) |
