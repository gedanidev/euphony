# Opciones de Integración con Spotify - Euphony

> **Fecha de investigación:** 2026-09-11  
> **Rama:** `kohaku/ui-review`  
> **Estado del proyecto:** Divergencia de +24 commits sobre main

---

## 1. Estado Actual del Proyecto

### Base de Datos Lista para Spotify

El proyecto ya tiene infraestructura preparada para integración:

| Tabla/Modelo | Campo Relevante | Uso |
|--------------|-------------------|-----|
| `UserConnection` | `service: "spotify"` | Almacena OAuth tokens |
| `ListenHistory` | `source: "spotify"` | Historial de escuchas |
| `Artist` | `spotify_id` | Mapeo a IDs de Spotify |
| `Album` | `spotify_id` | Mapeo a IDs de Spotify |
| `Song` | `spotify_id` | Mapeo a IDs de Spotify |
| `Song` | `mbid` | MusicBrainz para matching |

### APIs de Playlists Existentes

```
GET    /playlists                    → Listar playlists
POST   /playlists                    → Crear playlist
POST   /playlists/import             → Importar M3U
GET    /playlists/{id}/export        → Exportar M3U/CSV/JSON
POST   /playlists/{id}/songs         → Añadir canciones
PATCH  /playlists/{id}/reorder       → Reordenar
```

### Funcionalidades Destacadas en Rama Actual

- ✅ **Wishlist**: Lista de deseos con integración Shazam
- ✅ **Walkman Sync**: Sincronización con dispositivos Sony NW-A307
- ✅ **Import M3U**: Matching por path/artista+título
- ✅ **Export M3U**: Para dispositivos portátiles
- ✅ **Smart Playlists**: Playlist dinámicas con condiciones
- ✅ **Enriquecimiento**: Batch enrich con metadatos externos

---

## 2. Opciones de Integración con Spotify

### 2.1 Importar Playlists desde Spotify

**Descripción**: Traer playlists de Spotify a Euphony.

**Flujo propuesto**:
```
Usuario → Conectar cuenta Spotify → Seleccionar playlist → Importar
  ↓
Spotify API: GET /v1/me/playlists
  ↓
Por cada playlist: GET /v1/playlists/{id}/tracks
  ↓
Matching con biblioteca Euphony:
  - Por spotify_id (exacto)
  - Por artista + título (fuzzy matching)
  - Por ISRC (si se añade campo)
  ↓
Crear playlist en Euphony con canciones resueltas
```

**Endpoints necesarios**:
```python
POST   /spotify/connect              # OAuth iniciar
POST   /spotify/callback             # OAuth callback
GET    /spotify/playlists            # Listar del usuario
POST   /playlists/import-spotify     # Importar específica
POST   /playlists/{id}/sync-spotify  # Sincronizar bidireccional
```

**Ventajas**:
- Reutiliza infraestructura existente (`UserConnection`)
- Los campos `spotify_id` permiten matching eficiente
- No requiere cambios en modelo de playlists

**Consideraciones**:
- Playlist grandes (>100 tracks) requieren paginación
- Tracks no disponibles en mercado del usuario
- Manejar cambios de nombre/orden en Spotify

---

### 2.2 Exportar Playlists a Spotify

**Descripción**: Crear playlists en Spotify desde Euphony.

**Flujo propuesto**:
```
Usuario → Seleccionar playlist Euphony → "Exportar a Spotify"
  ↓
Spotify API: POST /v1/users/{user_id}/playlists
  ↓
Por cada canción en Euphony:
  - Si tiene spotify_id → añadir directo
  - Si no → buscar: GET /v1/search?q=artist+track
  ↓
Spotify API: POST /v1/playlists/{id}/tracks
```

**Ventajas**:
- Permite escuchar playlists en cualquier dispositivo Spotify
- Útil para playlists "On Walkman" → Spotify para streaming

**Desafíos**:
- Límite de rate: ~1 request/segundo para añadir tracks
- Playlist de 200 canciones = ~3-4 minutos
- Requiere encolar en background (similar a Walkman sync)

---

### 2.3 Sincronización Bidireccional

**Descripción**: Mantener sincronizadas playlists entre Euphony y Spotify.

**Estrategias**:

| Modo | Descripción | Complejidad |
|------|-------------|-------------|
| **One-way (Euphony → Spotify)** | Euphony como source of truth | Media |
| **One-way (Spotify → Euphony)** | Spotify como source of truth | Media |
| **Bidireccional manual** | Botón "sync" explícito | Media-Alta |
| **Bidireccional automática** | Webhooks o polling periódico | Alta |

**Consideraciones de conflictos**:
```
Escenario: Canción eliminada en Spotify pero no en Euphony
- Opción A: Re-añadirla (respetar Euphony)
- Opción B: Marcar como no disponible
- Opción C: Guardar en "wishlist" para reemplazo
```

---

### 2.4 Importar Historial de Escuchas

**Descripción**: Usar el historial de reproducción de Spotify para enriquecer Euphony.

**Endpoints Spotify**:
```
GET /v1/me/player/recently-played  # Últimas 50 reproducciones
GET /v1/me/top/tracks               # Top tracks (largo/medio/corto plazo)
GET /v1/me/top/artists              # Top artists
```

**Uso en Euphony**:
- Popular tabla `ListenHistory` con source="spotify"
- Generar estadísticas de escucha (ya existe schema `SpotifyHistoryTrack`)
- Identificar canciones que el usuario escucha en Spotify pero no tiene en biblioteca → añadir a wishlist

**Schema ya preparado**:
```python
class SpotifyHistoryTrack(BaseModel):
    spotify_track_id: Optional[str]
    track_title: str
    artist_name: str
    album_name: Optional[str]
    cover_url: Optional[str]
    duration_ms: Optional[int]
    play_count: int
    last_played_at: datetime
    song_id: Optional[UUID] = None  # Link a biblioteca Euphony
    availability: Optional[str] = None
```

---

### 2.5 Generar Playlists con Spotify Recommendations

**Descripción**: Usar el algoritmo de recomendaciones de Spotify para crear playlists.

**Endpoint**:
```
GET /v1/recommendations?seed_tracks={ids}&seed_artists={ids}&limit=50
```

**Flujo**:
```
Usuario → Seleccionar canciones semilla de Euphony
  ↓
Obtener spotify_ids de las canciones seleccionadas
  ↓
GET /v1/recommendations?seed_tracks={spotify_ids}
  ↓
Mostrar preview de recomendaciones
  ↓
Usuario confirma → Importar a nueva playlist Euphony
```

**Ventaja**: Aprovecha datos de Spotify sin salir de Euphony.

---

## 3. Arquitectura Recomendada

### 3.1 Backend - Nuevos Componentes

```
backend/
├── app/
│   ├── routers/
│   │   ├── spotify.py          # OAuth y endpoints
│   │   └── playlists.py        # Ya existe, añadir sync
│   ├── services/
│   │   └── spotify/
│   │       ├── client.py       # Wrapper HTTP client
│   │       ├── auth.py         # OAuth flow
│   │       ├── playlists.py    # Import/export/sync
│   │       └── matching.py     # Fuzzy match tracks
│   └── models.py               # Ya tiene UserConnection
```

### 3.2 Frontend - Nuevos Componentes

```
frontend/src/
├── pages/
│   └── Settings.jsx            # Añadir "Conectar Spotify"
├── components/
│   ├── SpotifyConnect.jsx      # Botón OAuth
│   ├── SpotifyPlaylistPicker.jsx  # Selector de playlists
│   └── SpotifySyncStatus.jsx   # Estado de sync
└── api/
    └── spotify.js              # Calls al backend
```

### 3.3 Flujo OAuth Implementación

```
1. Frontend: Click "Conectar Spotify"
   ↓
2. Backend:  GET /spotify/auth-url
   ↓          ↓
   Genera state, guarda en UserConnection (pending)
   Retorna URL de autorización Spotify
   ↓
3. Frontend: Redirect a Spotify
   ↓
4. Spotify:  Usuario autoriza
   ↓          ↓
   Redirect a /spotify/callback?code=&state=
   ↓
5. Backend:  POST /spotify/callback
   ↓          ↓
   Intercambia code por access_token + refresh_token
   Guarda tokens en UserConnection
   Actualiza estado a "connected"
   ↓
6. Frontend: Mostrar "Conectado" + opciones
```

---

## 4. Scopes de Spotify Necesarios

| Scope | Propósito |
|-------|-----------|
| `playlist-read-private` | Leer playlists privadas del usuario |
| `playlist-read-collaborative` | Leer playlists colaborativas |
| `playlist-modify-private` | Crear/modificar playlists privadas |
| `playlist-modify-public` | Crear/modificar playlists públicas |
| `user-read-recently-played` | Historial de escuchas |
| `user-top-read` | Top tracks/artists (opcional) |
| `user-library-read` | Canciones guardadas/liked (opcional) |

---

## 5. Modelo de Datos Adicional (Opcional)

Para tracking de sincronización:

```python
class PlaylistSpotifySync(Base):
    __tablename__ = "playlist_spotify_sync"
    
    id = Column(UUID, primary_key=True)
    playlist_id = Column(ForeignKey("playlists.id"))
    spotify_playlist_id = Column(String(100))
    sync_direction = Column(String(20))  # "to_spotify" | "from_spotify" | "bidirectional"
    last_sync_at = Column(DateTime)
    last_sync_status = Column(String(20))  # "success" | "partial" | "failed"
    sync_errors = Column(JSONB)  # [{"track_id": "...", "error": "not_found"}]
```

---

## 6. Plan de Implementación Sugerido

### Fase 1: Autenticación (1-2 días)
- Endpoint OAuth iniciar/callback
- Guardar tokens en UserConnection
- UI de "Conectar Spotify" en Settings

### Fase 2: Import básico (2-3 días)
- Listar playlists del usuario
- Importar una playlist específica
- Matching por spotify_id
- UI de selección y preview

### Fase 3: Export básico (2 días)
- Crear playlist en Spotify
- Añadir tracks (batch)
- Background job con polling (reusar patrón Walkman)

### Fase 4: Sync avanzado (3-5 días)
- Detectar cambios (diff)
- Sincronización bidireccional
- Resolver conflictos
- Webhooks de Spotify (opcional)

### Fase 5: Historial (1-2 días)
- Importar recently-played
- Popular ListenHistory
- Mostrar estadísticas

---

## 7. Referencias Spotify API

- **Web API Reference**: https://developer.spotify.com/documentation/web-api
- **Authorization Guide**: https://developer.spotify.com/documentation/general/guides/authorization-guide
- **Playlist Endpoints**: https://developer.spotify.com/documentation/web-api/reference/#category-playlists
- **Rate Limits**: ~1 request/segundo para POST, ~10 para GET

---

## 8. Notas de Implementación

### Reutilizar Patrones Existentes

El proyecto ya usa patrones que se pueden reutilizar:

| Funcionalidad | Archivo de Referencia |
|---------------|----------------------|
| Background jobs | `backend/app/routers/songs.py` (walkman_sync)
| Polling status | `frontend/src/pages/Settings.jsx` (WalkmanSyncSection)
| OAuth tokens | `backend/app/models.py` (UserConnection)
| Import preview | `frontend/src/pages/Settings.jsx` (playlist import)
| Matching fuzzy | `backend/app/routers/enrich.py` (Shazam search)

### Consideraciones de Seguridad

- Nunca exponer `client_secret` en frontend
- Usar `response_type=code` (Authorization Code flow)
- PKCE para aplicaciones sin backend confiable (no aplica aquí)
- Refrescar tokens antes de expirar (guardar `expires_at`)

---

**Autor:** Investigación técnica para rama `kohaku/ui-review`
