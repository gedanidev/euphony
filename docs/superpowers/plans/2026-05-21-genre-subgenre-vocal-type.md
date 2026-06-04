# Genre / Subgenre / Vocal Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the M:N genre system with `primary_genre` (string) + `subgenres` (JSONB array) + `vocal_type` enum directly on `Song`, expose them in smart playlists, and add a focused `SongEditModal`.

**Architecture:** Fields live directly on `Song` — no join tables. JSONB for `subgenres` follows the existing `SmartPlaylist.conditions` pattern. Smart playlists filter `primary_genre` as a direct string column and `subgenres` via JSONB contains. The old `genres`/`song_genres` tables are dropped. `SongEditModal` is a new focused component (title + primary_genre + subgenres + vocal_type) wired to the ⋮ area in Library, AlbumDetail, and ArtistDetail.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL JSONB, React 18, Tailwind CSS

---

## File Map

| File | Action |
|------|--------|
| `backend/alembic/versions/0006_genre_subgenre_vocal_type.py` | CREATE — migration |
| `backend/app/models.py` | MODIFY — remove Genre/SongGenre, add fields to Song |
| `backend/app/schemas.py` | MODIFY — remove GenreRead/SongGenreRead, add new fields |
| `backend/app/routers/songs.py` | MODIFY — remove genre_ids, add 2 new endpoints |
| `backend/app/routers/genres.py` | DELETE |
| `backend/app/main.py` | MODIFY — remove genres router |
| `backend/app/routers/smart_playlists.py` | MODIFY — remove Genre/SongGenre joins, add primary_genre/subgenre/vocal_type |
| `frontend/src/api/songs.js` | MODIFY — add getGenresUsed, getSubgenresUsed |
| `frontend/src/api/genres.js` | DELETE (or leave, it will break at import — remove the import in Library.jsx) |
| `frontend/src/pages/Library.jsx` | MODIFY — remove getGenres import, wire SongEditModal |
| `frontend/src/components/SongEditModal.jsx` | CREATE — genre/subgenre/vocal_type edit modal |
| `frontend/src/components/SmartPlaylistBuilder.jsx` | MODIFY — replace genre field, add subgenre + vocal_type |

---

## Task 1: Alembic migration 0006

**Files:**
- Create: `backend/alembic/versions/0006_genre_subgenre_vocal_type.py`

- [ ] **Paso 1: Crear el archivo de migración**

```python
# backend/alembic/versions/0006_genre_subgenre_vocal_type.py
"""genre_subgenre_vocal_type

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to songs
    op.add_column('songs', sa.Column('primary_genre', sa.String(100), nullable=True))
    op.add_column('songs', sa.Column(
        'subgenres',
        postgresql.JSONB(),
        nullable=False,
        server_default='[]'
    ))
    op.add_column('songs', sa.Column('vocal_type', sa.String(20), nullable=True))

    # Drop junction table first (FK references genres)
    op.drop_table('song_genres')
    # Drop lookup table
    op.drop_table('genres')


def downgrade() -> None:
    # Recreate genres lookup table
    op.create_table(
        'genres',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    # Recreate junction table
    op.create_table(
        'song_genres',
        sa.Column('song_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('genre_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['genre_id'], ['genres.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['song_id'], ['songs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('song_id', 'genre_id')
    )
    op.drop_column('songs', 'vocal_type')
    op.drop_column('songs', 'subgenres')
    op.drop_column('songs', 'primary_genre')
```

- [ ] **Paso 2: Aplicar la migración en el servidor**

```bash
# En el servidor (VPS) — conectarse y ejecutar dentro del contenedor backend
docker exec euphony_backend alembic upgrade head
```

Resultado esperado: `Running upgrade 0005 -> 0006, genre_subgenre_vocal_type`

- [ ] **Paso 3: Commit**

```bash
git add backend/alembic/versions/0006_genre_subgenre_vocal_type.py
git commit -m "feat: add migration 0006 - primary_genre, subgenres JSONB, vocal_type; drop genres tables"
```

---

## Task 2: Actualizar models.py

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Paso 1: Eliminar modelos Genre y SongGenre, agregar campos a Song**

En `backend/app/models.py`:

1. Eliminar la clase `Genre` completa (líneas 65–72).
2. Eliminar la clase `SongGenre` completa (líneas 161–168).
3. En la clase `Song`, eliminar la relación `song_genres` (línea 114).
4. En la clase `Song`, agregar las tres columnas nuevas después de `is_favorite`:

```python
    primary_genre = Column(String(100), nullable=True)
    subgenres = Column(JSONB, nullable=False, default=list, server_default='[]')
    vocal_type = Column(String(20), nullable=True)
```

El bloque `Song` resultante debe verse así (sólo los campos, sin cambiar las relaciones existentes excepto eliminar `song_genres`):

```python
class Song(Base):
    __tablename__ = "songs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False, index=True)
    album_id = Column(UUID(as_uuid=True), ForeignKey("albums.id", ondelete="SET NULL"), nullable=True)
    duration = Column(Integer)
    year = Column(Integer)
    version_type = Column(String(100))
    original_song_id = Column(UUID(as_uuid=True), ForeignKey("songs.id", ondelete="SET NULL"), nullable=True)
    lyrics = Column(Text)
    lyrics_lrc = Column(Text)
    file_path = Column(String(500))
    availability = Column(String(20), nullable=False, default="available")
    mbid = Column(String(36))
    spotify_id = Column(String(100))
    rating = Column(Integer, nullable=True)
    is_favorite = Column(Boolean, nullable=False, default=False)
    primary_genre = Column(String(100), nullable=True)
    subgenres = Column(JSONB, nullable=False, default=list, server_default='[]')
    vocal_type = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    album = relationship("Album", back_populates="songs")
    original_song = relationship("Song", remote_side="Song.id", foreign_keys=[original_song_id], back_populates="covers")
    covers = relationship("Song", foreign_keys=[original_song_id], back_populates="original_song")
    song_artists = relationship("SongArtist", back_populates="song", cascade="all, delete-orphan", order_by="SongArtist.order")
    song_composers = relationship("SongComposer", back_populates="song", cascade="all, delete-orphan", order_by="SongComposer.order")
    song_moods = relationship("SongMood", back_populates="song", cascade="all, delete-orphan")
    playlist_songs = relationship("PlaylistSong", back_populates="song", cascade="all, delete-orphan")
    listen_history = relationship("ListenHistory", back_populates="song", cascade="all, delete-orphan")
```

- [ ] **Paso 2: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: remove Genre/SongGenre models, add primary_genre/subgenres/vocal_type to Song"
```

---

## Task 3: Actualizar schemas.py

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Paso 1: Eliminar schemas de género**

Eliminar las clases `GenreCreate`, `GenreRead` y `SongGenreRead`.

- [ ] **Paso 2: Actualizar SongBase**

En `SongBase`, agregar los tres campos nuevos después de `is_favorite`:

```python
    primary_genre: Optional[str] = None
    subgenres: List[str] = []
    vocal_type: Optional[str] = None
```

- [ ] **Paso 3: Actualizar SongCreate**

En `SongCreate`, eliminar `genre_ids: Optional[List[UUID]] = None`.

- [ ] **Paso 4: Actualizar SongUpdate**

En `SongUpdate`, eliminar `genre_ids: Optional[List[UUID]] = None`. Agregar los tres campos opcionales:

```python
    primary_genre: Optional[str] = None
    subgenres: Optional[List[str]] = None
    vocal_type: Optional[str] = None
```

- [ ] **Paso 5: Actualizar SongRead**

En `SongRead`, eliminar la línea:
```python
    genres: List[SongGenreRead] = Field(default=[], validation_alias="song_genres")
```

- [ ] **Paso 6: Actualizar SmartPlaylistCondition**

En el comentario del campo `field` de `SmartPlaylistCondition`, actualizar para reflejar los nuevos campos:

```python
class SmartPlaylistCondition(BaseModel):
    field: str   # "artist", "album", "primary_genre", "subgenre", "vocal_type", "mood", "year", "availability", "rating", "is_favorite", "artist_preferred"
    op: str      # "contains", "not_contains", "is", "is_not", "starts_with", "ends_with", "gt", "lt", "between"
    value: Any
```

- [ ] **Paso 7: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: update schemas - remove genre schemas, add primary_genre/subgenres/vocal_type to Song"
```

---

## Task 4: Actualizar routers/songs.py

**Files:**
- Modify: `backend/app/routers/songs.py`

- [ ] **Paso 1: Eliminar song_genres de _load_song**

En `_load_song`, eliminar la línea:
```python
            selectinload(models.Song.song_genres).selectinload(models.SongGenre.genre),
```

- [ ] **Paso 2: Eliminar genre_ids de _apply_relations**

En `_apply_relations`, eliminar el bloque:
```python
    if data.genre_ids is not None:
        db.query(models.SongGenre).filter(models.SongGenre.song_id == song.id).delete()
        for genre_id in data.genre_ids:
            db.add(models.SongGenre(song_id=song.id, genre_id=genre_id))
```

- [ ] **Paso 3: Eliminar song_genres y genre_id de list_songs**

En `list_songs`:
1. Eliminar el parámetro `genre_id: Optional[UUID] = Query(None)`.
2. Eliminar `selectinload(models.Song.song_genres).selectinload(models.SongGenre.genre),` de las options.
3. Eliminar el bloque:
```python
    if genre_id:
        q = q.join(models.SongGenre, models.SongGenre.song_id == models.Song.id).filter(
            models.SongGenre.genre_id == genre_id
        )
```

- [ ] **Paso 4: Eliminar genre_ids de create_song y update_song**

En `create_song`:
```python
    song_fields = data.model_dump(exclude={"artist_ids", "artist_roles", "composer_ids", "mood_ids"})
```

En `update_song`:
```python
    scalar_fields = data.model_dump(
        exclude_unset=True,
        exclude={"artist_ids", "artist_roles", "composer_ids", "mood_ids"}
    )
```

- [ ] **Paso 5: Agregar endpoints GET /songs/genres-used y GET /songs/subgenres-used**

Agregar antes del endpoint `@router.post("")`:

```python
@router.get("/genres-used", response_model=List[str])
def get_genres_used(db: Session = Depends(get_db)):
    """Returns distinct primary_genre values used by songs (non-null, sorted)."""
    rows = (
        db.query(models.Song.primary_genre)
        .filter(models.Song.primary_genre.isnot(None))
        .distinct()
        .order_by(models.Song.primary_genre)
        .all()
    )
    return [r[0] for r in rows]


@router.get("/subgenres-used", response_model=List[str])
def get_subgenres_used(db: Session = Depends(get_db)):
    """Returns distinct subgenre strings across all songs' subgenres JSONB arrays (sorted)."""
    from sqlalchemy import func, text
    rows = db.execute(
        text(
            "SELECT DISTINCT jsonb_array_elements_text(subgenres) AS sg "
            "FROM songs WHERE subgenres != '[]'::jsonb "
            "ORDER BY sg"
        )
    ).fetchall()
    return [r[0] for r in rows]
```

**IMPORTANTE:** En FastAPI las rutas estáticas deben estar antes de las rutas con parámetros. Asegúrate de que `/genres-used` y `/subgenres-used` estén antes de `/{song_id}`.

- [ ] **Paso 6: Commit**

```bash
git add backend/app/routers/songs.py
git commit -m "feat: remove genre_ids from songs router, add genres-used and subgenres-used endpoints"
```

---

## Task 5: Eliminar genres router y actualizar main.py

**Files:**
- Delete: `backend/app/routers/genres.py`
- Modify: `backend/app/main.py`

- [ ] **Paso 1: Eliminar el archivo genres.py**

```bash
git rm backend/app/routers/genres.py
```

- [ ] **Paso 2: Actualizar main.py**

En `backend/app/main.py`, cambiar la línea de imports de routers:

```python
from app.routers import songs, playlists, artists, albums, moods, import_routes, enrich, auth, smart_playlists
```

Y eliminar la línea:
```python
app.include_router(genres.router, prefix="/api", dependencies=_auth_dep)
```

- [ ] **Paso 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: remove genres router from API"
```

---

## Task 6: Actualizar routers/smart_playlists.py

**Files:**
- Modify: `backend/app/routers/smart_playlists.py`

- [ ] **Paso 1: Actualizar _build_filter**

Reemplazar el bloque `if field == "genre"` y agregar los nuevos campos. El resultado de `_build_filter` debe quedar así:

```python
def _build_filter(condition: schemas.SmartPlaylistCondition):
    """Return a SQLAlchemy filter clause for one condition, or None if unsupported."""
    field = condition.field
    op = condition.op
    value = condition.value

    # ---- String fields on Song ----
    if field == "album":
        return _str_filter(models.Album.title, op, value)

    if field == "primary_genre":
        return _str_filter(models.Song.primary_genre, op, value)

    if field == "subgenre":
        # JSONB contains: Song.subgenres contains the string value
        v = str(value)
        if op == "is":
            return models.Song.subgenres.contains([v])
        if op == "is_not":
            return ~models.Song.subgenres.contains([v])
        if op == "contains":
            # substring match on any element — use JSON unnest approach via cast
            from sqlalchemy import func, cast
            from sqlalchemy.dialects.postgresql import JSONB
            return models.Song.subgenres.cast(sa.Text).ilike(f"%{v}%")
        if op == "not_contains":
            from sqlalchemy import cast
            return ~models.Song.subgenres.cast(sa.Text).ilike(f"%{v}%")
        return None

    if field == "vocal_type":
        if op == "is":
            return models.Song.vocal_type == value
        if op == "is_not":
            return models.Song.vocal_type != value
        return None

    if field == "mood":
        return _str_filter(models.Mood.name, op, value)

    if field == "artist":
        return _str_filter(models.Artist.name, op, value)

    # ---- Year ----
    if field == "year":
        return _int_filter(models.Song.year, op, value)

    # ---- Availability ----
    if field == "availability":
        if op == "is":
            return models.Song.availability == value
        if op == "is_not":
            return models.Song.availability != value

    # ---- Rating ----
    if field == "rating":
        return _int_filter(models.Song.rating, op, value)

    # ---- Favorite ----
    if field == "is_favorite":
        return models.Song.is_favorite == bool(value)

    # ---- Artist preferred ----
    if field == "artist_preferred":
        return models.Artist.is_preferred == bool(value)

    return None
```

También agregar `import sqlalchemy as sa` al principio del archivo si no está ya:
```python
from sqlalchemy import and_, or_, cast
import sqlalchemy as sa
```

- [ ] **Paso 2: Actualizar _execute_conditions**

En `_execute_conditions`, eliminar los dos outerjoin de Genre y SongGenre:

```python
    q = (
        db.query(models.Song)
        .outerjoin(models.SongArtist, models.SongArtist.song_id == models.Song.id)
        .outerjoin(models.Artist, models.Artist.id == models.SongArtist.artist_id)
        .outerjoin(models.Album, models.Album.id == models.Song.album_id)
        .outerjoin(models.SongMood, models.SongMood.song_id == models.Song.id)
        .outerjoin(models.Mood, models.Mood.id == models.SongMood.mood_id)
        .options(
            selectinload(models.Song.song_artists).selectinload(models.SongArtist.artist),
            selectinload(models.Song.song_composers).selectinload(models.SongComposer.artist),
            selectinload(models.Song.album),
            selectinload(models.Song.song_moods).selectinload(models.SongMood.mood),
        )
        .distinct()
    )
```

(Se eliminan las referencias a `SongGenre` y `Genre`).

- [ ] **Paso 3: Commit**

```bash
git add backend/app/routers/smart_playlists.py
git commit -m "feat: update smart_playlists - replace genre with primary_genre, add subgenre/vocal_type filters"
```

---

## Task 7: Actualizar frontend/src/api/songs.js

**Files:**
- Modify: `frontend/src/api/songs.js`

- [ ] **Paso 1: Agregar funciones getGenresUsed y getSubgenresUsed**

Al final del archivo agregar:

```js
export const getGenresUsed    = () => api.get('/songs/genres-used').then(r => r.data)
export const getSubgenresUsed = () => api.get('/songs/subgenres-used').then(r => r.data)
```

**Nota:** `updateSong` ya existe en el archivo (línea 6). No es necesario agregarlo.

- [ ] **Paso 2: Commit**

```bash
git add frontend/src/api/songs.js
git commit -m "feat: add getGenresUsed and getSubgenresUsed API functions"
```

---

## Task 8: Crear SongEditModal.jsx

**Files:**
- Create: `frontend/src/components/SongEditModal.jsx`

Este modal permite editar `title`, `primary_genre`, `subgenres` (chips), y `vocal_type` de una canción.

- [ ] **Paso 1: Crear el componente**

```jsx
// frontend/src/components/SongEditModal.jsx
import { useState, useEffect, useRef } from 'react'
import { updateSong, getGenresUsed, getSubgenresUsed } from '../api/songs'

const VOCAL_OPTIONS = [
  { value: null,           label: 'No especificado' },
  { value: 'vocal',        label: 'Vocal' },
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'a_capella',    label: 'A capella' },
]

export default function SongEditModal({ song, onClose, onSaved }) {
  const [title, setTitle] = useState(song.title)
  const [primaryGenre, setPrimaryGenre] = useState(song.primary_genre || '')
  const [subgenres, setSubgenres] = useState(song.subgenres || [])
  const [vocalType, setVocalType] = useState(song.vocal_type ?? null)
  const [subgenreInput, setSubgenreInput] = useState('')
  const [genreOptions, setGenreOptions] = useState([])
  const [subgenreOptions, setSubgenreOptions] = useState([])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    getGenresUsed().then(setGenreOptions).catch(() => {})
    getSubgenresUsed().then(setSubgenreOptions).catch(() => {})
  }, [])

  const addSubgenre = (value) => {
    const v = value.trim()
    if (!v || subgenres.includes(v)) return
    setSubgenres(prev => [...prev, v])
    setSubgenreInput('')
  }

  const removeSubgenre = (sg) => {
    setSubgenres(prev => prev.filter(s => s !== sg))
  }

  const handleSubgenreKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSubgenre(subgenreInput)
    }
    if (e.key === 'Backspace' && subgenreInput === '' && subgenres.length > 0) {
      setSubgenres(prev => prev.slice(0, -1))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateSong(song.id, {
        title: title.trim(),
        primary_genre: primaryGenre.trim() || null,
        subgenres,
        vocal_type: vocalType,
      })
      onSaved(updated)
    } catch { alert('Error guardando canción') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Editar canción</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Título */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Título</label>
            <input
              autoFocus required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Género principal */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Género principal</label>
            <input
              list="genre-options"
              value={primaryGenre}
              onChange={e => setPrimaryGenre(e.target.value)}
              placeholder="Metal, Pop, Jazz…"
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
            />
            <datalist id="genre-options">
              {genreOptions.map(g => <option key={g} value={g} />)}
            </datalist>
          </div>

          {/* Subgéneros */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Subgéneros</label>
            <div
              className="min-h-[40px] px-2 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg flex flex-wrap gap-1.5 cursor-text"
              onClick={() => inputRef.current?.focus()}
            >
              {subgenres.map(sg => (
                <span key={sg} className="flex items-center gap-1 px-2 py-0.5 bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs rounded-full">
                  {sg}
                  <button type="button" onClick={() => removeSubgenre(sg)} className="text-purple-400 hover:text-white transition-colors leading-none">×</button>
                </span>
              ))}
              <input
                ref={inputRef}
                list="subgenre-options"
                value={subgenreInput}
                onChange={e => setSubgenreInput(e.target.value)}
                onKeyDown={handleSubgenreKey}
                onBlur={() => { if (subgenreInput.trim()) addSubgenre(subgenreInput) }}
                placeholder={subgenres.length === 0 ? 'Escribe y presiona Enter…' : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none"
              />
            </div>
            <datalist id="subgenre-options">
              {subgenreOptions.filter(s => !subgenres.includes(s)).map(s => <option key={s} value={s} />)}
            </datalist>
            <p className="text-xs text-[#94a3b8] mt-1">Escribe y presiona Enter para agregar. Click en chip para eliminar.</p>
          </div>

          {/* Tipo vocal */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-2 block uppercase tracking-wider">Tipo vocal</label>
            <div className="flex gap-1">
              {VOCAL_OPTIONS.map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setVocalType(opt.value)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                    vocalType === opt.value
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-[#0f0f13] border-[#2e2e4a] text-[#94a3b8] hover:text-white hover:border-purple-500/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Paso 2: Commit**

```bash
git add frontend/src/components/SongEditModal.jsx
git commit -m "feat: add SongEditModal for editing title, primary_genre, subgenres, vocal_type"
```

---

## Task 9: Actualizar SmartPlaylistBuilder.jsx

**Files:**
- Modify: `frontend/src/components/SmartPlaylistBuilder.jsx`

- [ ] **Paso 1: Reemplazar el array FIELDS**

Reemplazar el array `FIELDS` completo (líneas 5–15):

```js
const FIELDS = [
  { value: 'artist',          labelKey: 'smartPlaylist.fields.artist',        type: 'string' },
  { value: 'album',           labelKey: 'smartPlaylist.fields.album',         type: 'string' },
  { value: 'primary_genre',   label: 'Género principal',                      type: 'string' },
  { value: 'subgenre',        label: 'Subgénero',                             type: 'string' },
  { value: 'vocal_type',      label: 'Tipo vocal',                            type: 'vocal_type' },
  { value: 'mood',            labelKey: 'smartPlaylist.fields.mood',          type: 'string' },
  { value: 'year',            labelKey: 'smartPlaylist.fields.year',          type: 'int' },
  { value: 'availability',    labelKey: 'smartPlaylist.fields.availability',  type: 'availability' },
  { value: 'rating',          labelKey: 'smartPlaylist.fields.rating',        type: 'rating' },
  { value: 'is_favorite',     labelKey: 'smartPlaylist.fields.isFavorite',    type: 'bool' },
  { value: 'artist_preferred',labelKey: 'smartPlaylist.fields.artistPreferred', type: 'bool' },
]
```

- [ ] **Paso 2: Actualizar getOpsForType**

Agregar el tipo `vocal_type` (sólo opera con is/is_not):

```js
const VOCAL_TYPE_OPS = [
  { value: 'is',     labelKey: 'smartPlaylist.ops.is' },
  { value: 'is_not', labelKey: 'smartPlaylist.ops.isNot' },
]

function getOpsForType(type) {
  if (type === 'string') return STRING_OPS
  if (type === 'int' || type === 'rating') return INT_OPS
  if (type === 'vocal_type') return VOCAL_TYPE_OPS
  return []
}
```

- [ ] **Paso 3: Actualizar handleFieldChange para inicializar vocal_type**

En `handleFieldChange`, agregar `vocal_type` a los valores default:

```js
  const handleFieldChange = (newField) => {
    const newDef = FIELDS.find(f => f.value === newField)
    const newOp = getOpsForType(newDef.type)[0]?.value || 'is'
    const newValue = newDef.type === 'bool' ? true
      : newDef.type === 'availability' ? 'available'
      : newDef.type === 'vocal_type' ? 'vocal'
      : newDef.type === 'int' || newDef.type === 'rating' ? 0
      : ''
    onChange({ field: newField, op: newOp, value: newValue })
  }
```

- [ ] **Paso 4: Agregar renderValue para vocal_type en ConditionRow**

Dentro de `renderValue()`, antes del `return null` final, agregar:

```js
    if (fieldDef.type === 'vocal_type') {
      return (
        <select value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })}
          className="flex-1 px-3 py-1.5 bg-[#1e1e30] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
          <option value="vocal">Vocal</option>
          <option value="instrumental">Instrumental</option>
          <option value="a_capella">A capella</option>
        </select>
      )
    }
```

- [ ] **Paso 5: Actualizar el select de campos para usar label directo cuando labelKey no existe**

En el JSX del `<select>` de campos (línea ~136), cambiar el render de las opciones:

```jsx
        {FIELDS.map(f => (
          <option key={f.value} value={f.value}>
            {f.label || t(f.labelKey)}
          </option>
        ))}
```

- [ ] **Paso 6: Commit**

```bash
git add frontend/src/components/SmartPlaylistBuilder.jsx
git commit -m "feat: update SmartPlaylistBuilder - replace genre with primary_genre/subgenre, add vocal_type"
```

---

## Task 10: Cablear SongEditModal en Library, AlbumDetail y ArtistDetail

**Files:**
- Modify: `frontend/src/pages/Library.jsx`
- Modify: `frontend/src/pages/AlbumDetail.jsx`
- Modify: `frontend/src/pages/ArtistDetail.jsx`

### Library.jsx

- [ ] **Paso 1: Actualizar imports en Library.jsx**

1. Eliminar la línea: `import { getGenres } from '../api/genres'`
2. Agregar: `import SongEditModal from '../components/SongEditModal'`
3. En el import de songs.js, quitar las referencias a `updateSong` si venía de otro lugar (ya está en songs.js).

- [ ] **Paso 2: Agregar estado para el modal de edición rápida**

Agregar el estado (donde están los otros estados de modales):

```js
const [editSong, setEditSong] = useState(null)  // song object to edit in SongEditModal
```

- [ ] **Paso 3: Agregar botón "Editar canción" en la fila**

En la tabla de songs en Library.jsx, en el grupo de botones de acción de cada fila (`group-hover:opacity-100`), agregar antes del botón de edición completa:

```jsx
<button onClick={() => setEditSong(song)}
  className="text-teal-400/70 hover:text-teal-400 text-xs font-medium transition-colors"
  title="Editar género / tipo vocal">
  ♪
</button>
```

**Nota:** El ícono `♪` ya se usa para lyrics. Usa un ícono distinto, por ejemplo el carácter `♬` o una etiqueta de texto "gen":

```jsx
<button onClick={() => setEditSong(song)}
  className="text-teal-400/70 hover:text-teal-400 text-xs font-medium transition-colors"
  title="Editar género y tipo vocal">
  ♬
</button>
```

- [ ] **Paso 4: Renderizar SongEditModal en Library**

Al final del JSX de Library (antes del cierre `</div>`), agregar:

```jsx
{editSong && (
  <SongEditModal
    song={editSong}
    onClose={() => setEditSong(null)}
    onSaved={(updated) => {
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
      setEditSong(null)
    }}
  />
)}
```

- [ ] **Paso 5: Eliminar getGenres del código de Library.jsx**

Buscar en Library.jsx cualquier uso de `getGenres` (carga de géneros, dropdowns de filtro, etc.) y eliminarlo. Si hay un filtro `filterGenre`, eliminarlo también ya que la arquitectura nueva no usa IDs de género para filtrar en la API.

### AlbumDetail.jsx

- [ ] **Paso 6: Importar SongEditModal en AlbumDetail**

```js
import SongEditModal from '../components/SongEditModal'
```

- [ ] **Paso 7: Agregar estado editSong en AlbumDetail**

```js
const [editSong, setEditSong] = useState(null)
```

- [ ] **Paso 8: Agregar botón en cada fila de canción en AlbumDetail**

En la tabla de songs de AlbumDetail, en la última `<td>` (donde está el botón de favorito), agregar una celda adicional con el botón:

```jsx
<td className="px-2 py-2.5">
  <button
    onClick={() => setEditSong(song)}
    className="text-[#3d3d5c] hover:text-teal-400 transition-colors opacity-0 group-hover:opacity-100 text-sm"
    title="Editar género y tipo vocal"
  >
    ♬
  </button>
</td>
```

También agregar el header correspondiente en `<thead>`:
```jsx
<th className="px-2 py-3 w-8" />
```

- [ ] **Paso 9: Renderizar SongEditModal en AlbumDetail**

Antes del modal de portada existente (`{coverModal && ...}`):

```jsx
{editSong && (
  <SongEditModal
    song={editSong}
    onClose={() => setEditSong(null)}
    onSaved={(updated) => {
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
      setEditSong(null)
    }}
  />
)}
```

### ArtistDetail.jsx

- [ ] **Paso 10: Importar SongEditModal en ArtistDetail**

```js
import SongEditModal from '../components/SongEditModal'
```

- [ ] **Paso 11: Agregar estado editSong en ArtistDetail**

```js
const [editSong, setEditSong] = useState(null)
```

- [ ] **Paso 12: Agregar botón en filas de canciones de ArtistDetail**

ArtistDetail tiene una tabla de canciones en la vista de álbum inline. En cada fila de canción, agregar un botón similar al de AlbumDetail:

```jsx
<button
  onClick={() => setEditSong(song)}
  className="text-[#3d3d5c] hover:text-teal-400 transition-colors opacity-0 group-hover:opacity-100 text-sm ml-2"
  title="Editar género y tipo vocal"
>
  ♬
</button>
```

- [ ] **Paso 13: Renderizar SongEditModal en ArtistDetail**

Al final del JSX principal de ArtistDetail:

```jsx
{editSong && (
  <SongEditModal
    song={editSong}
    onClose={() => setEditSong(null)}
    onSaved={(updated) => {
      // Actualizar songs en el estado local de ArtistDetail
      // El estado de songs puede estar en albums o en favoriteSongs
      setEditSong(null)
    }}
  />
)}
```

**Nota:** ArtistDetail puede mantener canciones en múltiples partes del estado. Al guardar, simplemente cierra el modal — el usuario puede hacer reload si necesita ver el cambio reflejado, o se puede hacer un reload completo del artista con la función `load()` si existe.

- [ ] **Paso 14: Commit**

```bash
git add frontend/src/pages/Library.jsx frontend/src/pages/AlbumDetail.jsx frontend/src/pages/ArtistDetail.jsx
git commit -m "feat: wire SongEditModal in Library, AlbumDetail, ArtistDetail"
```

---

## Task 11: Deploy en VPS

- [ ] **Paso 1: rsync y rebuild**

```bash
# Desde el directorio raíz del proyecto en local
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='__pycache__' \
  ./ user@VPS_IP:/ruta/euphony/

# En el VPS
docker compose -f docker-compose.euphony.yml up -d --build
```

- [ ] **Paso 2: Verificar que la migración corrió**

```bash
docker exec euphony_backend alembic current
```

Resultado esperado: `0006 (head)`

- [ ] **Paso 3: Smoke test**

- Abrir la app en el navegador
- Ir a Biblioteca → abrir el modal ♬ de una canción → verificar que se muestran los campos de género y vocal_type
- Guardar → verificar que los datos persisten
- Ir a Smart Playlists → crear una playlist con condición "Género principal contiene Metal" → verificar preview

---

## Self-Review

### Cobertura del spec:
- ✅ Migration 0006: ADD primary_genre, subgenres JSONB, vocal_type; DROP song_genres, genres
- ✅ models.py: Remove Genre/SongGenre, add 3 fields to Song
- ✅ schemas.py: Remove GenreRead/SongGenreRead, add fields to SongBase/SongUpdate, remove from SongRead
- ✅ songs.py: Remove genre_ids, add /genres-used and /subgenres-used
- ✅ genres.py: Deleted
- ✅ main.py: genres router removed
- ✅ smart_playlists.py: genre → primary_genre, add subgenre (JSONB), add vocal_type
- ✅ api/songs.js: getGenresUsed, getSubgenresUsed added (updateSong ya existe)
- ✅ SongEditModal.jsx: title + primary_genre datalist + subgenres chips + vocal_type toggle
- ✅ SmartPlaylistBuilder.jsx: primary_genre + subgenre + vocal_type fields
- ✅ Library/AlbumDetail/ArtistDetail: wired SongEditModal

### Notas importantes:
- En `routers/songs.py`, las rutas `/genres-used` y `/subgenres-used` DEBEN declararse antes de `/{song_id}` para que FastAPI no intente parsear "genres-used" como un UUID.
- En `Library.jsx`, también puede haber un filtro dropdown de géneros en la barra de búsqueda que usa `getGenres`. Ese filtro debe eliminarse o reemplazarse con un input de texto libre contra `primary_genre` si se desea mantener.
- `updateSong` ya existe en `api/songs.js` desde antes — no hay que crearlo.
