# Smart Playlists + Rating + Favoritas — Design Spec

**Date:** 2026-05-17  
**Status:** Approved

---

## Overview

Three related features for Euphony:

1. **Smart Playlists** — rule-based playlists built with a visual condition builder (iTunes-style). Results are evaluated dynamically in Euphony and exported as M3U for the Walkman.
2. **Rating** — 1–10 score for songs and albums, displayed as 1–5 stars with optional numeric input.
3. **Favorites / Preferred** — heart (♥) for favorite songs, star (★) for preferred artists.

---

## Data Model

### New columns

| Table | Column | Type | Default |
|-------|--------|------|---------|
| `songs` | `rating` | Integer nullable | null |
| `songs` | `is_favorite` | Boolean | false |
| `albums` | `rating` | Integer nullable | null |
| `artists` | `is_preferred` | Boolean | false |

### New table: `smart_playlists`

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        VARCHAR(255) NOT NULL
match_all   BOOLEAN NOT NULL DEFAULT true   -- true = AND, false = OR
conditions  JSONB NOT NULL DEFAULT '[]'
created_at  TIMESTAMP DEFAULT now()
updated_at  TIMESTAMP DEFAULT now()
```

### Condition JSON structure

Each condition is an object in the `conditions` array:

```json
[
  {"field": "genre",            "op": "contains",  "value": "Rock"},
  {"field": "year",             "op": "between",   "value": [1990, 1999]},
  {"field": "availability",     "op": "is",        "value": "available"},
  {"field": "artist_preferred", "op": "is",        "value": true},
  {"field": "rating",           "op": "gte",       "value": 7},
  {"field": "is_favorite",      "op": "is",        "value": true}
]
```

### Supported fields and operators

| Field | Operators |
|-------|-----------|
| `artist`, `album`, `genre`, `mood` | `contains`, `not_contains`, `is`, `is_not`, `starts_with`, `ends_with` |
| `year` | `is`, `is_not`, `gt`, `lt`, `between` |
| `availability` | `is` (values: `available`, `wishlist`, `not_available`) |
| `rating` | `is`, `is_not`, `gt`, `lt`, `between` |
| `is_favorite` | `is` (values: `true`, `false`) |
| `artist_preferred` | `is` (values: `true`, `false`) |

Results are always ordered by `year ASC`, nulls last.

---

## Backend

### New router: `/smart-playlists`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/smart-playlists` | List all smart playlists (name, id, condition count) |
| POST | `/smart-playlists` | Create (name + match_all + conditions) |
| POST | `/smart-playlists/preview` | Stateless — evaluate conditions and return matching song count + list (used by builder before saving) |
| GET | `/smart-playlists/{id}` | Detail + evaluated song list |
| PUT | `/smart-playlists/{id}` | Update |
| DELETE | `/smart-playlists/{id}` | Delete |
| GET | `/smart-playlists/{id}/export/m3u` | Download M3U of current results |

### Updated endpoints

| Method | Path | Change |
|--------|------|--------|
| PATCH | `/songs/{id}` | Accept `rating` (int 1–10 or null) and `is_favorite` (bool) |
| PATCH | `/albums/{id}` | Accept `rating` (int 1–10 or null) |
| PATCH | `/artists/{id}/preferred` | Toggle `is_preferred` |

### Query engine

The engine in `smart_playlists` router builds a SQLAlchemy query dynamically:

1. Start from `Song` query with necessary joins (SongArtist→Artist, SongGenre→Genre, etc.)
2. For each condition, append a `.filter()` clause using the field+op mapping
3. Combine clauses with `and_()` if `match_all=True`, else `or_()`
4. Order by `Song.year.asc().nulls_last()`

String ops (`contains`, `starts_with`, etc.) use `ilike`. Relationship fields (`genre`, `mood`, `artist`, `related_artist`, `composer`) require the appropriate join before filtering.

### M3U export

Format: `#EXTM3U` header, then for each song:
```
#EXTINF:{duration},{artist} - {title}
{title}
```
(No file paths — Euphony doesn't store local paths. The M3U serves as a reference list for manual Walkman management.)

---

## Frontend

### `/playlists` page — two tabs

- **Playlists** — existing list, unchanged
- **Smart ✨** — list of smart playlists showing: name, song count badge, edit / export M3U / delete actions

### Smart playlist builder (modal)

Opened from "+ Nueva smart playlist" or edit button.

**Fields:**
- Name input
- Match toggle: "Cumplir TODAS las condiciones" (AND) / "CUALQUIERA" (OR)
- Condition rows (iTunes-style): `[Campo ▾] [Operador ▾] [Valor] [×]`
- "+ Añadir condición" button
- Live preview: "X canciones coinciden" (debounced 400ms, calls POST /smart-playlists/preview — stateless, no save)
- Save / Cancel buttons

**Field→operator mapping in UI:**
- Name-type fields → dropdown with: contiene, no contiene, es, no es, empieza en, acaba en
- Year → es, no es, mayor que, menor que, entre (shows two inputs)
- Availability → dropdown: Disponible, Wishlist, No disponible
- Rating → es, no es, mayor que, menor que, entre
- Favorita / Artista preferido → Sí / No radio

### Rating component (songs and albums)

- 5 stars visual (★★★☆☆)
- Each star = 2 points: 1★=2, 2★=4, 3★=6, 4★=8, 5★=10
- Click a star to set rating; click same star to clear
- Optional numeric input (1–10) beside stars for exact precision
- Shown in: Library song rows (compact, 5 stars only), song detail/edit modal (stars + number input), album detail page

### Favorite song (♥)

- Heart icon in each Library row, toggle on click
- Filled ♥ (pink) = favorite, outline ♡ = not favorite
- Also shown in song detail modal

### Preferred artist (★)

- Star icon in Artists list rows and ArtistDetail page header
- Filled ★ (amber) = preferred, outline ☆ = not preferred

---

## Translations

All new keys added to ES / EN / JA locale files:

- `smartPlaylist.tab` — "Smart ✨"
- `smartPlaylist.new` — "Nueva smart playlist"
- `smartPlaylist.edit` — "Editar"
- `smartPlaylist.matchAll` — "Cumplir TODAS las condiciones"
- `smartPlaylist.matchAny` — "Cumplir CUALQUIERA"
- `smartPlaylist.addCondition` — "+ Añadir condición"
- `smartPlaylist.preview` — "{{n}} canciones coinciden"
- `smartPlaylist.export` — "Exportar M3U"
- `smartPlaylist.fields.*` — one key per field name
- `smartPlaylist.ops.*` — one key per operator
- `rating.label` — "Rating"
- `favorite.label` — "Favorita"
- `artist.preferred` — "Preferido" / "Liked" / "好きなアーティスト"

---

## Out of Scope

- Syncing smart playlist rules to the Walkman device (not possible via M3U)
- Smart playlists that auto-update on the Walkman (same reason)
- Composer and related_artist as condition fields (data is sparse in the current model — can be added later)
