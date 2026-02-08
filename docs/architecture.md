# Euphony - Arquitectura

## Stack Tecnológico

### Frontend
- **Framework:** React + Vite
- **Estilos:** TailwindCSS
- **Gestión de estado:** Context API / React Query (para API calls)
- **Routing:** React Router

### Backend
- **Framework:** FastAPI (Python)
- **API:** REST
- **Autenticación:** JWT (opcional, para multi-usuario futuro)
- **Documentación:** Swagger automático (FastAPI)

### Base de Datos
- **Motor:** PostgreSQL
- **ORM:** SQLAlchemy (Python)
- **Migraciones:** Alembic

---

## Estructura de Base de Datos

### Tablas Principales

**Artists**
```sql
id              SERIAL PRIMARY KEY
name            VARCHAR(255) NOT NULL
bio             TEXT
image_url       VARCHAR(500)
country         VARCHAR(100)
region          VARCHAR(100)
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()
```

**Albums**
```sql
id              SERIAL PRIMARY KEY
artist_id       INTEGER REFERENCES Artists(id)
title           VARCHAR(255) NOT NULL
year            INTEGER
cover_url       VARCHAR(500)
created_at      TIMESTAMP DEFAULT NOW()
```

**Songs**
```sql
id              SERIAL PRIMARY KEY
album_id        INTEGER REFERENCES Albums(id)
title           VARCHAR(255) NOT NULL
duration        INTEGER (segundos)
lyrics          TEXT
file_path       VARCHAR(500)
created_at      TIMESTAMP DEFAULT NOW()
```

**Genres**
```sql
id              SERIAL PRIMARY KEY
name            VARCHAR(100) UNIQUE NOT NULL
```

**Moods**
```sql
id              SERIAL PRIMARY KEY
name            VARCHAR(100) UNIQUE NOT NULL
description     TEXT
```

**Occasions** (ocasiones ideales)
```sql
id              SERIAL PRIMARY KEY
name            VARCHAR(100) UNIQUE NOT NULL
description     TEXT
```

**Playlists**
```sql
id              SERIAL PRIMARY KEY
name            VARCHAR(255) NOT NULL
description     TEXT
is_public       BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()
```

### Tablas de Relación (Many-to-Many)

**SongGenres**
```sql
song_id         INTEGER REFERENCES Songs(id)
genre_id        INTEGER REFERENCES Genres(id)
PRIMARY KEY (song_id, genre_id)
```

**SongMoods**
```sql
song_id         INTEGER REFERENCES Songs(id)
mood_id         INTEGER REFERENCES Moods(id)
PRIMARY KEY (song_id, mood_id)
```

**SongOccasions**
```sql
song_id         INTEGER REFERENCES Songs(id)
occasion_id     INTEGER REFERENCES Occasions(id)
PRIMARY KEY (song_id, occasion_id)
```

**PlaylistSongs**
```sql
playlist_id     INTEGER REFERENCES Playlists(id)
song_id         INTEGER REFERENCES Songs(id)
order_index     INTEGER NOT NULL
added_at        TIMESTAMP DEFAULT NOW()
PRIMARY KEY (playlist_id, song_id)
```

### Estadísticas

**ListenHistory**
```sql
id              SERIAL PRIMARY KEY
song_id         INTEGER REFERENCES Songs(id)
played_at       TIMESTAMP DEFAULT NOW()
duration_played INTEGER (segundos realmente escuchados)
completed       BOOLEAN DEFAULT FALSE
```

---

## Funcionalidades Principales

### v1.0 (MVP)
- ✅ CRUD de Artistas, Álbumes, Canciones
- ✅ Asignar géneros, moods, ocasiones
- ✅ Crear y gestionar playlists
- ✅ Búsqueda básica (nombre, artista)
- ✅ Exportar playlist a M3U/M3U8

### v1.1 (Estadísticas)
- 📊 Top artistas más escuchados
- 📊 Top canciones
- 📊 Historial de reproducciones
- 📊 Gráficas temporales (escuchas por mes, etc.)

### v2.0 (Avanzado)
- 🔍 Búsqueda avanzada (filtros combinados)
- 📤 Compartir playlists (URLs públicas)
- 🌐 Integración con APIs externas (metadata, letras)
- 🎧 Sincronización con Walkman NW-A307

---

## Integración con Sony Walkman NW-A307

**Método:** Sincronización por USB (MTP o almacenamiento masivo)

**Formato de playlists:** M3U8 (UTF-8)

**Estructura:**
```m3u
#EXTM3U
#EXTINF:195,Artist Name - Song Title
/Music/Artist/Album/01 - Song Title.mp3
...
```

**Flujo:**
1. Usuario conecta Walkman por USB
2. App detecta dispositivo (opcional: auto-detect)
3. Usuario selecciona playlist para exportar
4. App genera archivo .m3u8 con rutas correctas
5. Usuario copia archivo a carpeta `Playlists/` del Walkman

---

_Documento vivo - se actualiza según avance el proyecto_
