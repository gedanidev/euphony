# Euphony - Roadmap

_Plan de desarrollo por fases_

---

## Fase 0: Setup Inicial ✅
- [x] Crear repositorio
- [x] Definir arquitectura
- [x] Documentar estructura de BD
- [ ] Setup proyecto Frontend (React + Vite)
- [ ] Setup proyecto Backend (FastAPI)
- [ ] Configurar PostgreSQL
- [ ] Definir modelos de BD (SQLAlchemy)
- [ ] Migraciones iniciales (Alembic)

---

## Fase 1: CRUD Básico (MVP)
**Objetivo:** Poder crear, editar, borrar artistas, álbumes y canciones.

### Backend
- [ ] Modelo Artists + endpoints CRUD
- [ ] Modelo Albums + endpoints CRUD
- [ ] Modelo Songs + endpoints CRUD
- [ ] Modelo Genres + endpoints CRUD
- [ ] Modelo Moods + endpoints CRUD
- [ ] Modelo Occasions + endpoints CRUD
- [ ] RelacionesMany-to-Many (SongGenres, SongMoods, SongOccasions)

### Frontend
- [ ] Página principal (dashboard)
- [ ] Lista de artistas + búsqueda
- [ ] Formulario crear/editar artista (incluir país y región)
- [ ] Vista de artista (álbumes del artista)
- [ ] Lista de álbumes
- [ ] Formulario crear/editar álbum
- [ ] Vista de álbum (canciones del álbum)
- [ ] Lista de canciones + búsqueda
- [ ] Formulario crear/editar canción (con genres, moods, occasions)
- [ ] Componente selector múltiple (para géneros, moods, etc.)

---

## Fase 2: Playlists
**Objetivo:** Crear y gestionar playlists.

### Backend
- [ ] Modelo Playlists + endpoints CRUD
- [ ] Relación PlaylistSongs (con ordenamiento)
- [ ] Endpoint para agregar/quitar canciones de playlist
- [ ] Endpoint para reordenar canciones en playlist

### Frontend
- [ ] Lista de playlists
- [ ] Formulario crear/editar playlist
- [ ] Vista de playlist (canciones ordenadas)
- [ ] Drag & drop para reordenar canciones
- [ ] Agregar canciones a playlist desde vista de canciones

---

## Fase 3: Exportar a Walkman
**Objetivo:** Generar archivos M3U8 compatibles con el Walkman.

### Backend
- [ ] Endpoint para generar M3U8 de una playlist
- [ ] Validar rutas de archivos
- [ ] Formatear correctamente metadata (EXTINF)

### Frontend
- [ ] Botón "Exportar a Walkman" en vista de playlist
- [ ] Descargar archivo .m3u8
- [ ] Instrucciones de sincronización (modal/tooltip)

---

## Fase 4: Estadísticas
**Objetivo:** Registrar y visualizar historial de reproducciones.

### Backend
- [ ] Modelo ListenHistory
- [ ] Endpoint para registrar reproducción
- [ ] Endpoints de estadísticas:
  - Top artistas (más escuchados)
  - Top canciones
  - Historial de reproducciones
  - Gráficas temporales (por mes, semana, etc.)

### Frontend
- [ ] Página de estadísticas
- [ ] Gráficos (Chart.js o Recharts)
- [ ] Top artistas (con contador de reproducciones)
- [ ] Top canciones
- [ ] Historial con filtros (fecha, artista, etc.)

---

## Fase 5: Búsqueda Avanzada
**Objetivo:** Filtros combinados para encontrar música.

### Backend
- [ ] Endpoint de búsqueda avanzada con múltiples filtros:
  - Artista, álbum, canción (texto)
  - Género(s)
  - Mood(s)
  - Ocasión(es)
  - País/región del artista
  - Año del álbum

### Frontend
- [ ] Formulario de búsqueda avanzada
- [ ] Resultados agrupados (artistas / álbumes / canciones)
- [ ] Guardar búsquedas favoritas (opcional)

---

## Fase 6: Compartir Playlists
**Objetivo:** Generar URLs públicas para compartir playlists.

### Backend
- [ ] Sistema de enlaces públicos (UUID o slug)
- [ ] Endpoint público para ver playlist compartida
- [ ] Opción para hacer playlist privada/pública

### Frontend
- [ ] Toggle "Pública/Privada" en formulario de playlist
- [ ] Botón "Compartir" con copia de URL
- [ ] Vista pública de playlist (sin autenticación)

---

## Fase 7: Integraciones Externas (opcional)
**Objetivo:** Enriquecer datos automáticamente.

### Posibles APIs
- [ ] MusicBrainz (metadata de artistas/álbumes)
- [ ] Genius / Musixmatch (letras de canciones)
- [ ] Last.fm / Spotify API (info adicional)
- [ ] Cover Art Archive (portadas de álbumes)

### Implementación
- [ ] Búsqueda de artista en API externa
- [ ] Auto-completar datos al crear artista/álbum
- [ ] Importar letras de canciones

---

## Backlog / Ideas Futuras
- [ ] Modo oscuro
- [ ] Multi-idioma (i18n)
- [ ] Autenticación / multi-usuario
- [ ] Sincronización automática con Walkman (vía USB o WiFi)
- [ ] Recomendaciones basadas en historial
- [ ] Player integrado (opcional)
- [ ] PWA (Progressive Web App)

---

_Última actualización: 2026-02-08_
