# Genre/Subgenre & Vocal Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current M:N genre system with `primary_genre` (string) + `subgenres` (JSONB array) per song, add `vocal_type` enum field, expose these in the smart playlist builder, and add a song edit modal.

**Architecture:** Fields live directly on `Song` — no join tables. JSONB for `subgenres` matches the existing pattern used by `SmartPlaylist.conditions`. Smart playlists filter `primary_genre` as a direct string column and `subgenres` via JSONB contains. The old `genres`/`song_genres` tables are dropped.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL JSONB, React, Tailwind

---

## Section 1: Database

### Fields added to `Song`
- `primary_genre VARCHAR(100) NULLABLE` — e.g. `"Metal"`
- `subgenres JSONB NOT NULL DEFAULT '[]'` — e.g. `["Progressive Metal", "Death Metal"]`
- `vocal_type VARCHAR(20) NULLABLE` — values: `"vocal"`, `"instrumental"`, `"a_capella"`

### Tables removed
- `song_genres` (junction table)
- `genres` (lookup table)

### Migration `0006_genre_subgenre_vocal_type.py`
- ADD COLUMN `primary_genre`, `subgenres`, `vocal_type` to `songs`
- DROP TABLE `song_genres`
- DROP TABLE `genres`

---

## Section 2: Backend

### `models.py`
- Remove `Genre` model and `SongGenre` model
- Remove `song_genres` relationship from `Song`
- Remove `genre` relationship from `Genre`
- Add to `Song`: `primary_genre`, `subgenres`, `vocal_type`

### `schemas.py`
- Remove `GenreRead`, `GenreCreate`, `SongGenreRead`
- Remove `genres: List[SongGenreRead]` from `SongRead`
- Add to `SongBase`: `primary_genre: Optional[str] = None`, `subgenres: List[str] = []`, `vocal_type: Optional[str] = None`
- Add same fields to `SongUpdate`
- Remove `genre_ids` from `SongCreate` and `SongUpdate`

### `routers/songs.py`
- Remove genre_ids handling from create/update logic
- Add two new endpoints:
  - `GET /songs/genres-used` → returns distinct `primary_genre` values (non-null, sorted)
  - `GET /songs/subgenres-used` → returns distinct values across all `subgenres` JSONB arrays (sorted)

### `routers/genres.py`
- Delete file entirely

### `main.py`
- Remove genres router import and registration

### `routers/smart_playlists.py`
- Remove joins to `SongGenre` and `Genre`
- Field `genre` → filter on `Song.primary_genre` directly (string operators: contains, not_contains, is, is_not, starts_with, ends_with)
- Add field `subgenre` → filter using `Song.subgenres.contains([value])` (JSONB)
- Add field `vocal_type` → filter on `Song.vocal_type` with operators `is` / `is_not`

---

## Section 3: Frontend

### `api/songs.js`
- Add `getGenresUsed()` → `GET /songs/genres-used`
- Add `getSubgenresUsed()` → `GET /songs/subgenres-used`
- Add `updateSong(id, data)` → `PUT /songs/{id}`

### `components/SongEditModal.jsx` (new)
Fields:
- `title` — text input
- `primary_genre` — text input with datalist autocomplete from `getGenresUsed()`
- `subgenres` — tag input: type + Enter to add chip, click chip to remove. Datalist from `getSubgenresUsed()`
- `vocal_type` — 3-button toggle: **Vocal** | **Instrumental** | **A capella** (null = not set)

Accessible from the ⋮ menu on song rows in Library, AlbumDetail, and ArtistDetail.

### `components/SmartPlaylistBuilder.jsx`
- Replace field `genre` with `primary_genre` (label: "Género principal") — string operators
- Add field `subgenre` (label: "Subgénero") — string operators, filters JSONB array
- Add field `vocal_type` (label: "Tipo vocal") — dropdown selector: vocal / instrumental / a_capella, operators: is / is_not

### `pages/Library.jsx`, `pages/AlbumDetail.jsx`, `pages/ArtistDetail.jsx`
- Wire ⋮ menu "Editar canción" to open `SongEditModal`
- On save, update local song state optimistically

---

## Vocal type values
| Value | Display |
|-------|---------|
| `"vocal"` | Vocal |
| `"instrumental"` | Instrumental |
| `"a_capella"` | A capella |
| `null` | No especificado |
