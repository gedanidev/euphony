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
  - Campos: nombre, país de origen, región (opcional)
- [ ] Modelo Albums + endpoints CRUD
- [ ] Modelo Songs + endpoints CRUD
  - Campo `version_type`: tipo de versión (original, cover, remix, remaster, live, demo, etc.)
  - Campo `original_song_id`: referencia a canción original (si es cover/remix)
- [ ] Modelo SongComposers (compositores de canciones):
  - Relación Many-to-Many entre Songs y Artists
  - Soportar múltiples compositores por canción
  - Campo `order`: orden de aparición en créditos (opcional)
  - Permite que compositores no sean intérpretes (ej: Juan Gabriel compone para otros)
- [ ] Modelo Genres + endpoints CRUD
- [ ] Modelo Moods + endpoints CRUD
- [ ] Modelo Occasions + endpoints CRUD
- [ ] Relaciones Many-to-Many (SongGenres, SongMoods, SongOccasions)
- [ ] Modelo ArtistRelations (relaciones entre artistas):
  - Tipos: miembro_de_banda, colaborador_frecuente, etc.
  - Relación Many-to-Many con tipo y metadata
- [ ] Modelo SongArtists (artistas en canciones):
  - Separar artista principal vs. colaboradores (featuring)
  - Soportar múltiples colaboradores por canción (2, 3, o más artistas)
  - Campo `role`: 'principal' o 'colaborador'
  - Campo `order`: orden de aparición en créditos (opcional)
  - Evitar problema de Apple Music: NO crear artista "X feat. Z"
  - Mantener artistas individuales separados, relacionarlos a la canción con rol
- [ ] Endpoint de búsqueda de canciones por artista (bidireccional):
  - Buscar canciones donde artista es principal
  - Buscar canciones donde artista aparece como colaborador
  - Buscar canciones donde artista es compositor
  - Combinar todos los resultados con filtros opcionales por rol
- [ ] Endpoint de búsqueda de canciones por compositor:
  - Mostrar canciones compuestas por un artista
  - Incluir canciones donde el compositor también es intérprete

### Frontend
- [ ] Página principal (dashboard)
- [ ] Lista de artistas + búsqueda
- [ ] Formulario crear/editar artista:
  - Campos: nombre, país de origen (selector con países), región (opcional)
- [ ] Vista de artista (álbumes del artista)
- [ ] Lista de álbumes
- [ ] Formulario crear/editar álbum
- [ ] Vista de álbum (canciones del álbum)
- [ ] Lista de canciones + búsqueda
- [ ] Formulario crear/editar canción:
  - Artista principal (selector único)
  - Artistas colaboradores/featuring (selector múltiple, sin límite)
  - Compositores (selector múltiple, sin límite)
  - Tipo de versión (selector: original, cover, remix, remaster, live, demo, etc.)
  - Canción original (selector, solo si es cover/remix)
  - Orden de colaboradores y compositores (drag & drop opcional)
  - Géneros, moods, occasions (selector múltiple)
- [ ] Vista de canciones de un artista (búsqueda bidireccional):
  - Mostrar canciones donde el artista es principal
  - Mostrar canciones donde el artista colabora (con indicador visual)
  - Mostrar canciones donde el artista es compositor (con indicador visual)
  - Agrupar por tipo de rol o mostrar todas juntas con badges
  - Ejemplo: Buscar "Pharrell Williams" muestra:
    - Sus canciones como principal (ej: "Happy")
    - Canciones donde colaboró (ej: "Get Lucky" con Daft Punk, "Feels" con Calvin Harris)
    - Canciones que compuso (si aplica)
- [ ] Vista de canción individual:
  - Mostrar tipo de versión (badge: Cover, Remix, etc.)
  - Mostrar compositores separados de intérpretes
  - Si es cover/remix, mostrar enlace a canción original
  - Mostrar todas las versiones relacionadas (covers, remixes de esta canción)
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

## Fase 4: Estadísticas y Registro de Reproducciones
**Objetivo:** Registrar y visualizar historial de reproducciones desde múltiples fuentes.

### Backend
- [ ] Modelo ListenHistory:
  - Campos: canción, fecha/hora, fuente (walkman, telefono, app, manual)
  - Duración escuchada (opcional)
  - Dispositivo/fuente de reproducción
- [ ] Endpoint para registrar reproducción manual:
  - Registrar canción escuchada ahora
  - Registrar reproducción pasada (con fecha/hora)
  - Registrar múltiples reproducciones (batch)
- [ ] Endpoint para registrar reproducción desde dispositivo:
  - Marcar canción como "escuchada ahora" desde app móvil
  - Sincronización desde servicios externos (si API disponible)
- [ ] Endpoints de estadísticas:
  - Top artistas (más escuchados)
  - Top canciones
  - Historial de reproducciones
  - Gráficas temporales (por mes, semana, etc.)
  - Estadísticas por fuente (walkman vs teléfono vs app)

### Frontend
- [ ] Página de estadísticas
- [ ] Gráficos (Chart.js o Recharts)
- [ ] Top artistas (con contador de reproducciones)
- [ ] Top canciones
- [ ] Historial con filtros (fecha, artista, fuente/dispositivo, etc.)
- [ ] Registro manual de reproducciones:
  - Botón "Marcar como escuchada ahora" en vista de canción
  - Formulario para registrar reproducción pasada
  - Importación masiva desde archivo (CSV/JSON)
- [ ] Vista de historial con badges de fuente (Walkman, Teléfono, App, etc.)

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
  - Rol del artista en la canción (principal, colaborador, compositor, todos)
  - Tipo de versión (original, cover, remix, remaster, live, demo, todos)
  - Composer (buscar por compositor)
- [ ] Endpoint de búsqueda por artista con opciones:
  - Solo como principal
  - Solo como colaborador
  - Solo como compositor
  - Cualquier combinación o todos (por defecto)

### Frontend
- [ ] Formulario de búsqueda avanzada
- [ ] Filtro de rol de artista (principal/colaborador/compositor/todos)
- [ ] Filtro de tipo de versión (original/cover/remix/remaster/live/demo/todos)
- [ ] Filtro por compositor
- [ ] Resultados agrupados (artistas / álbumes / canciones)
- [ ] Indicadores visuales en resultados:
  - Badge "Principal", "Colaboración", o "Compositor" según el rol
  - Badge de tipo de versión (Cover, Remix, Remaster, etc.)
  - Mostrar todos los artistas y compositores de la canción claramente
- [ ] Guardar búsquedas favoritas (opcional)

---

## Fase 6: Mapa de Relaciones entre Artistas
**Objetivo:** Visualizar conexiones entre artistas (miembros de banda, colaboraciones).

### Backend
- [ ] Endpoint para obtener relaciones de un artista
- [ ] Endpoint para obtener grafo completo de relaciones (opcional, para visualización)
- [ ] Endpoint para estadísticas de colaboraciones:
  - Artistas que más colaboran juntos
  - Miembros de bandas más activos

### Frontend
- [ ] Vista de mapa de relaciones (grafo visual):
  - Nodos: artistas
  - Aristas: relaciones (colores según tipo: banda, colaboración)
  - Librería: D3.js, vis.js, o react-force-graph
- [ ] Vista desde artista individual:
  - Mostrar miembros de su banda
  - Mostrar artistas con los que ha colaborado
  - Mostrar canciones donde aparece como colaborador
- [ ] Filtros en el mapa:
  - Filtrar por tipo de relación
  - Filtrar por país de origen
  - Buscar artista específico y mostrar sus conexiones

---

## Fase 7: Compartir Playlists
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

## Fase 8: Integraciones Externas - Enriquecimiento de Datos
**Objetivo:** Enriquecer datos automáticamente con APIs externas.

### APIs para Metadata y Contenido

#### Letras de Canciones
- [ ] **LRCLIB** (servicio de letras sincronizadas):
  - API para obtener letras en formato LRC (sincronizadas)
  - Cliente oficial: [lrcget](https://github.com/tranxuanthang/lrcget)
  - Letras sincronizadas con tiempo para reproducción
  - Formato LRC estándar para compatibilidad
- [ ] **Genius API** (letras de canciones con anotaciones)
- [ ] **Musixmatch API** (letras sincronizadas y traducciones)
- [ ] **Lyrics.ovh** (API gratuita de letras)
- [ ] Endpoint para buscar e importar letras automáticamente:
  - Priorizar LRCLIB para letras sincronizadas (formato LRC)
  - Fallback a otras APIs si LRCLIB no tiene la canción
- [ ] Almacenar letras en modelo Songs o tabla separada Lyrics:
  - Soporte para formato LRC (letras sincronizadas)
  - Soporte para texto plano (letras sin sincronización)
  - Campo para formato de letras (lrc, plain_text)

#### Imágenes de Álbumes y Artistas

**Servicios Gratuitos Recomendados:**

- [ ] **Cover Art Archive** (✅ Gratuito, alta calidad):
  - API pública gratuita: `coverartarchive.org`
  - Portadas de álbumes de alta calidad
  - Requiere MusicBrainz Release ID (MBID)
  - Múltiples tamaños: 250px, 500px, 1200px, resolución completa
  - Endpoints: `/release/{mbid}/front` (portada principal)
  - Imágenes curadas por la comunidad MusicBrainz
  - Almacenadas en Internet Archive

- [ ] **MusicBrainz** (✅ Gratuito, metadata completa):
  - API pública gratuita con rate limits generosos
  - Metadata completa: fechas, géneros, discografías, relaciones
  - Proporciona MBID necesario para Cover Art Archive
  - Búsqueda por artista, álbum, canción
  - Datos comunitarios y verificados

- [ ] **Discogs API** (✅ Gratuito con autenticación):
  - API REST gratuita con OAuth
  - Metadata completa de releases y artistas
  - Imágenes de álbumes disponibles (requiere autenticación)
  - Rate limits generosos para uso gratuito
  - Datos de vinilos, CDs, y releases físicos

- [ ] **iTunes Search API** (✅ Gratuito, limitaciones de uso):
  - API pública gratuita: `itunes.apple.com/search`
  - Imágenes pequeñas: 60x60px y 100x100px
  - **Limitación importante**: Solo para uso promocional
  - No se pueden descargar/cachear imágenes
  - Solo streaming para páginas promocionales
  - Útil como fallback pero con restricciones legales

**Servicios con Limitaciones:**

- [ ] **Spotify API** (⚠️ Requiere OAuth, rate limits):
  - Imágenes de álbumes y artistas en múltiples tamaños
  - Requiere autenticación OAuth2
  - Rate limits estrictos
  - Mejor calidad que iTunes pero requiere cuenta

- [ ] **Last.fm API** (⚠️ API cambiada, menos confiable):
  - Proporciona imágenes pero API ha sido modificada
  - Muchas librerías migraron a Spotify como fuente
  - Útil como fallback adicional

- [ ] **ACRCloud Music Metadata API** (⚠️ Servicio comercial):
  - Imágenes de alta resolución hasta 3000px
  - Agrega datos de múltiples DSPs
  - Servicio comercial (puede tener costos)

**Implementación:**
- [ ] Endpoint para buscar y descargar imágenes automáticamente
- [ ] Orden de prioridad: Cover Art Archive → Discogs → Spotify → iTunes → Last.fm
- [ ] Almacenar URLs o descargar imágenes localmente
- [ ] Sistema de caché para imágenes descargadas
- [ ] Múltiples tamaños disponibles según necesidad (thumbnail, medium, large)

#### Metadata Adicional

**Servicios Gratuitos:**

- [ ] **MusicBrainz** (✅ Gratuito, metadata completa):
  - Fechas de lanzamiento
  - Géneros y tags
  - Discografías completas
  - Relaciones entre artistas (miembros de banda, colaboraciones)
  - Información de releases (formato, país, sello discográfico)
  - API pública con rate limits razonables

- [ ] **Discogs API** (✅ Gratuito con autenticación):
  - Metadata detallada de releases
  - Información de formatos (vinilo, CD, digital)
  - Créditos de producción
  - Información de sellos discográficos
  - Datos de coleccionistas

**Servicios con Limitaciones:**

- [ ] **Last.fm API** (⚠️ API modificada, menos confiable):
  - Tags y géneros
  - Artistas similares
  - Top tracks
  - Popularidad
  - Útil como fuente complementaria

- [ ] **Spotify API** (⚠️ Requiere OAuth):
  - Popularidad de tracks
  - Previews de audio (30 segundos)
  - Artistas similares
  - Información de mercado/disponibilidad
  - Requiere autenticación y tiene rate limits

- [ ] **ACRCloud Music Metadata API** (⚠️ Servicio comercial):
  - Metadata agregada de múltiples fuentes
  - Información de compositores y créditos
  - Enlaces a múltiples plataformas de streaming
  - Servicio comercial (puede tener costos)

### Implementación Backend
- [ ] Servicio de integración con APIs externas (clase/service separado)
- [ ] Manejo de rate limits y errores de API
- [ ] Sistema de caché para respuestas de APIs
- [ ] Búsqueda de artista en API externa al crear/editar:
  - Priorizar MusicBrainz para obtener MBID y metadata básica
  - Usar MBID para buscar imágenes en Cover Art Archive
  - Fallback a Discogs si MusicBrainz no tiene resultados
- [ ] Auto-completar datos al crear artista/álbum:
  - País de origen (desde MusicBrainz o Discogs)
  - Fecha de formación/lanzamiento
  - Géneros y tags sugeridos
  - Imagen del artista/álbum (múltiples fuentes con fallback)
  - Información de sello discográfico
  - Créditos de producción (si disponibles)
- [ ] Importar letras de canciones:
  - Búsqueda automática al crear canción
  - Priorizar LRCLIB para letras sincronizadas (formato LRC)
  - Botón "Buscar letras" en formulario de edición
  - Múltiples fuentes con fallback (LRCLIB → Musixmatch → Genius → Lyrics.ovh)
  - Parser para formato LRC (letras sincronizadas con timestamps)
  - Conversión de LRC a formato interno si es necesario
- [ ] Descargar imágenes:
  - Buscar automáticamente al crear artista/álbum:
    - Usar MusicBrainz para obtener MBID
    - Buscar en Cover Art Archive con MBID
    - Fallback a Discogs, Spotify, iTunes según disponibilidad
  - Botón "Buscar imagen" en formulario de edición
  - Seleccionar entre múltiples resultados y tamaños
  - Previsualización antes de descargar
  - Descargar y almacenar localmente o guardar URL
  - Soporte para múltiples tamaños (thumbnail, medium, large)

### Implementación Frontend
- [ ] Botón "Buscar en APIs" en formularios de artista/álbum
- [ ] Modal con resultados de búsqueda de APIs
- [ ] Previsualización de imágenes antes de seleccionar
- [ ] Botón "Importar letras" en formulario de canción
- [ ] Vista de letras en página de canción:
  - Visualización de letras sincronizadas (formato LRC) si están disponibles
  - Reproducción sincronizada con la canción (highlight de línea actual)
  - Fallback a texto plano si no hay letras sincronizadas
  - Indicador de formato (LRC sincronizado vs texto plano)
- [ ] Indicador de fuente de datos (ej: "Letras de LRCLIB", "Datos de MusicBrainz")

---

## Fase 9: Sincronización desde Servicios de Streaming (Opcional)
**Objetivo:** Importar historial y biblioteca desde servicios de streaming **si APIs están disponibles**.

**Nota:** Muchos servicios no tienen APIs públicas para historial de reproducción. Esta fase se implementará solo para servicios que sí lo permitan. El registro manual siempre estará disponible.

### Servicios con APIs Disponibles

#### Spotify
- [ ] **Spotify Web API** (✅ API disponible):
  - OAuth2 para autenticación
  - Obtener biblioteca del usuario (playlists, álbumes guardados)
  - ⚠️ Historial de reproducción: Limitado a últimas 50 canciones recientes
  - Obtener top tracks/artistas del usuario
- [ ] Endpoint para conectar cuenta de Spotify
- [ ] Endpoint para sincronizar biblioteca desde Spotify
- [ ] Endpoint para sincronizar historial reciente (limitado)

#### Apple Music
- [ ] **Apple Music API** (MusicKit) (⚠️ API limitada):
  - OAuth para autenticación
  - Obtener biblioteca del usuario
  - ⚠️ Historial de reproducción: Muy limitado o no disponible públicamente
  - Obtener playlists de usuario
- [ ] Endpoint para conectar cuenta de Apple Music
- [ ] Endpoint para sincronizar biblioteca desde Apple Music
- [ ] Nota: Historial completo puede no ser accesible vía API

#### Last.fm (Scrobbling)
- [ ] **Last.fm API** (✅ API disponible):
  - Obtener historial completo de scrobbles
  - Sincronización automática si usuario tiene cuenta Last.fm
  - Requiere que usuario tenga scrobbling activado en sus apps
- [ ] Endpoint para conectar cuenta de Last.fm
- [ ] Endpoint para sincronizar historial completo desde Last.fm

### Servicios sin API Pública (Registro Manual)

#### Walkman (Sony)
- [ ] **No hay API pública disponible**
- [ ] Alternativas:
  - Registro manual de reproducciones desde la app
  - Exportar lista de reproducción desde Walkman (si es posible)
  - Importar archivos de historial si Walkman los genera
- [ ] Endpoint para importar archivo de historial (si formato disponible)
- [ ] Formulario manual para registrar reproducciones del Walkman

#### Sony Headphones App
- [ ] Investigar si hay API disponible (probablemente no)
- [ ] Alternativa: Exportar datos desde la app (CSV/JSON) si es posible
- [ ] Endpoint para importar archivo exportado
- [ ] Parser para formato de exportación de Sony
- [ ] Si no hay exportación: registro manual

#### Apple Music (Historial completo)
- [ ] **No hay API pública para historial completo**
- [ ] Alternativas:
  - Usar registro manual
  - Si usuario tiene Last.fm scrobbling activado, usar esa fuente
- [ ] Nota: Apple Music API solo permite acceso limitado a biblioteca, no historial completo

#### Otros Servicios
- [ ] **YouTube Music**: API muy limitada, historial no disponible públicamente
- [ ] **Tidal**: Investigar disponibilidad de API
- [ ] **Amazon Music**: API limitada
- [ ] Importación manual desde archivos exportados (CSV, JSON) si el usuario puede exportarlos

### Implementación Backend
- [ ] Modelo UserConnections (conexiones a servicios externos):
  - Servicio (spotify, apple_music, etc.)
  - Token de acceso (encriptado)
  - Refresh token
  - Fecha de última sincronización
- [ ] Servicio de sincronización genérico:
  - Interfaz común para diferentes servicios
  - Mapeo de datos entre servicios y modelo interno
  - Manejo de duplicados (evitar importar dos veces)
- [ ] Endpoints de autenticación OAuth:
  - Iniciar flujo OAuth
  - Callback OAuth
  - Desconectar servicio
- [ ] Endpoints de sincronización:
  - Sincronizar biblioteca completa
  - Sincronizar solo historial reciente
  - Sincronización incremental (solo cambios nuevos)
- [ ] Procesamiento de datos importados:
  - Crear/actualizar artistas
  - Crear/actualizar álbumes
  - Crear/actualizar canciones
  - Crear playlists desde servicios externos
  - Registrar historial de reproducción
- [ ] Sincronización automática programada (opcional):
  - Tarea en background para sincronizar periódicamente
  - Configurable por usuario

### Implementación Frontend
- [ ] Página de configuración de integraciones
- [ ] Sección "Servicios con API disponible":
  - Botones para conectar servicios con API (Spotify, Last.fm)
  - Flujo OAuth para servicios que lo requieren
  - Vista de servicios conectados con estado
  - Botones de sincronización manual:
    - "Sincronizar ahora"
    - "Sincronizar solo historial"
- [ ] Sección "Registro Manual":
  - Instrucciones para registrar reproducciones manualmente
  - Botón "Registrar reproducción ahora" (marcar canción como escuchada)
  - Formulario para registrar reproducción pasada
  - Importar desde archivo (CSV/JSON) para servicios sin API
- [ ] Progreso de sincronización (barra de progreso, logs)
- [ ] Vista de resultados de sincronización:
  - Artistas importados
  - Canciones importadas
  - Playlists importadas
  - Historial importado
- [ ] Opciones de sincronización:
  - Frecuencia automática (solo para servicios con API)
  - Qué sincronizar (biblioteca, historial, ambos)
  - Manejo de duplicados
- [ ] Indicadores claros de qué servicios tienen API y cuáles requieren registro manual

### Consideraciones
- [ ] **Limitaciones de APIs:**
  - Muchos servicios no tienen APIs públicas para historial completo
  - Spotify solo permite últimas 50 canciones recientes
  - Apple Music API es muy limitada para historial
  - Walkman y Sony Headphones App probablemente no tienen APIs públicas
  - **Solución:** Sistema de registro manual siempre disponible como alternativa
- [ ] Manejo de privacidad:
  - Tokens almacenados de forma segura (encriptados)
  - Usuario puede desconectar servicios en cualquier momento
  - No compartir datos con terceros
- [ ] Rate limits:
  - Respetar límites de APIs de servicios externos
  - Implementar cola de sincronización si es necesario
- [ ] Mapeo de datos:
  - Algunos servicios pueden tener metadata diferente
  - Sistema de matching inteligente para evitar duplicados
  - Permitir revisión manual de matches dudosos
- [ ] **Registro Manual como Funcionalidad Principal:**
  - El registro manual debe ser fácil y rápido
  - Permitir registro rápido desde vista de canción
  - Importación masiva desde archivos si el usuario puede exportarlos
  - No depender exclusivamente de APIs externas

---

## Backlog / Ideas Futuras
- [ ] Modo oscuro
- [ ] Multi-idioma (i18n)
- [ ] Autenticación / multi-usuario (requerido para Fase 9)
- [ ] Sincronización automática con Walkman (vía USB o WiFi)
- [ ] Recomendaciones basadas en historial
- [ ] Player integrado (opcional)
- [ ] PWA (Progressive Web App)
- [ ] Sincronización bidireccional (exportar playlists a servicios de streaming)
- [ ] Notificaciones de nuevas canciones de artistas seguidos

---

## Notas de Diseño

### Manejo de Artistas Colaboradores (Featuring)
**Problema identificado:** En Apple Music, cuando un artista X tiene una canción Y donde aparece como "feat. Z", el sistema crea un artista separado "X feat. Z" en lugar de mantener a X y Z como artistas individuales. Esto causa que:
- Al buscar al artista X, no aparezcan canciones donde colabora con Z
- Se multipliquen los artistas (X, Z, "X feat. Z", "Z feat. X", etc.)
- La biblioteca se vuelva difícil de navegar
- Canciones con múltiples colaboradores generan aún más variaciones

**Solución en Euphony:**

**Modelo de Datos:**
- Modelo `SongArtists` con campos:
  - `role`: 'principal' o 'colaborador'
  - `order`: orden de aparición en créditos (opcional, para mantener orden original)
- Una canción puede tener:
  - 1 artista principal
  - 0 o más colaboradores (sin límite)
- NO crear artistas compuestos como "X feat. Z" o "X feat. Y feat. Z"
- Mantener artistas individuales y relacionarlos a canciones con su rol correspondiente

**Búsqueda Bidireccional:**
Al buscar un artista (ej: "Pharrell Williams"), mostrar:
- ✅ Canciones donde es artista principal
  - Ej: "Happy" (Pharrell Williams como principal)
- ✅ Canciones donde aparece como colaborador
  - Ej: "Get Lucky" (Daft Punk como principal, Pharrell como colaborador)
  - Ej: "Feels" (Calvin Harris como principal, Pharrell como colaborador)

**Búsqueda desde otros artistas:**
Al buscar otros artistas que colaboraron con él:
- Buscar "Gwen Stefani" → muestra "Hollaback Girl" (Pharrell como colaborador)
- Buscar "Snoop Dogg" → muestra canciones donde ambos aparecen

**Visualización en UI:**
- Mostrar: "Canción Y - Artista Principal X (feat. Z, W)" 
- X, Z, W siguen siendo artistas separados en la base de datos
- Badges visuales para distinguir rol (principal vs colaboración)
- Al hacer clic en cualquier artista, se muestra su catálogo completo (principal + colaboraciones)

**Ejemplo Real:**
- Canción: "Blurred Lines"
  - Principal: Robin Thicke
  - Colaboradores: Pharrell Williams, T.I.
- Al buscar "Pharrell Williams": aparece esta canción (como colaboración)
- Al buscar "Robin Thicke": aparece esta canción (como principal)
- Al buscar "T.I.": aparece esta canción (como colaboración)
- NO se crea artista "Robin Thicke feat. Pharrell Williams feat. T.I."

---

### Compositores y Tipos de Versión

**Compositores:**
Algunos artistas son principalmente compositores y no intérpretes, o componen para otros artistas además de interpretar sus propias canciones. Ejemplos:
- **Juan Gabriel**: Compositor prolífico que escribió canciones para muchos artistas además de interpretarlas él mismo
- **Kajiura Yuki**: Compositora japonesa que compone para otros artistas y proyectos

**Modelo de Datos:**
- Modelo `SongComposers` separado de `SongArtists`:
  - Relación Many-to-Many entre Songs y Artists
  - Soportar múltiples compositores por canción
  - Campo `order`: orden de aparición en créditos
- Un artista puede ser:
  - Solo compositor (no aparece como intérprete)
  - Solo intérprete (no compone)
  - Ambos (compone e interpreta, posiblemente en canciones diferentes)

**Búsqueda por Compositor:**
- Al buscar un compositor (ej: "Juan Gabriel"), mostrar:
  - Canciones que compuso e interpretó él mismo
  - Canciones que compuso para otros artistas
- Al buscar un intérprete, también mostrar canciones que compuso (si aplica)

**Tipos de Versión:**
Las canciones pueden tener diferentes versiones que deben distinguirse:
- **original**: Versión original de la canción
- **cover**: Versión interpretada por otro artista
- **remix**: Versión remezclada (puede tener diferentes artistas)
- **remaster**: Versión remasterizada de la original
- **live**: Versión en vivo
- **demo**: Versión demo o borrador
- **acoustic**: Versión acústica
- **instrumental**: Versión sin voces

**Modelo de Datos:**
- Campo `version_type` en modelo Songs (enum o string)
- Campo `original_song_id`: referencia a canción original (si es cover/remix)
- Permite rastrear relaciones entre versiones:
  - Canción original → múltiples covers
  - Canción original → múltiples remixes
  - Canción original → versión remasterizada

**Ejemplos:**
- "Hallelujah" (original de Leonard Cohen) → múltiples covers (Jeff Buckley, Rufus Wainwright, etc.)
- "Bohemian Rhapsody" (original de Queen) → versión remasterizada
- "Blinding Lights" (original de The Weeknd) → múltiples remixes

**Visualización:**
- Badge visual indicando tipo de versión
- Enlace a canción original si es cover/remix
- Lista de todas las versiones relacionadas (covers, remixes de esta canción)
- Al buscar, poder filtrar por tipo de versión

---

### Registro de Reproducciones desde Walkman y Teléfono

**Situación Actual:**
- **Walkman (Sony)**: No hay API pública disponible para obtener historial de reproducciones
- **Teléfono (Apple Music/Spotify/etc.)**: APIs muy limitadas o no disponibles para historial completo
- **Sony Headphones App**: Probablemente no tiene API pública

**Enfoque en Euphony:**

**1. Registro Manual (Siempre Disponible):**
- Botón rápido "Marcar como escuchada ahora" en cada canción
- Formulario para registrar reproducciones pasadas (con fecha/hora)
- Importación masiva desde archivos CSV/JSON si el usuario puede exportarlos
- Campo "fuente" para distinguir: Walkman, Teléfono, App, Manual

**2. Sincronización desde APIs (Si Disponible):**
- **Last.fm**: Si el usuario tiene scrobbling activado, sincronizar automáticamente
- **Spotify**: Sincronizar últimas 50 canciones recientes (limitación de API)
- **Apple Music**: Sincronizar biblioteca, pero historial completo no está disponible vía API

**3. Registro desde App Móvil (Futuro):**
- App móvil de Euphony que permita registrar reproducciones en tiempo real
- Sincronización automática cuando se reproduce música en el teléfono
- Requiere desarrollo de app móvil nativa o PWA

**Recomendación:**
- Priorizar registro manual fácil y rápido
- Implementar sincronización desde APIs solo para servicios que lo permitan
- No depender exclusivamente de APIs externas
- Considerar desarrollo de app móvil para registro automático en el futuro

---

### APIs para Metadata e Imágenes de Música

**Estrategia Recomendada:**

**1. Para Metadata (Información de Artistas/Álbumes):**
- **Primaria:** MusicBrainz (gratuito, completo, comunidad activa)
- **Secundaria:** Discogs (gratuito con auth, datos de releases físicos)
- **Complementaria:** Spotify API (si usuario tiene cuenta, para popularidad/previews)

**2. Para Imágenes de Álbumes:**
- **Primaria:** Cover Art Archive (gratuito, alta calidad, requiere MBID de MusicBrainz)
- **Secundaria:** Discogs (gratuito con auth, buenas imágenes)
- **Fallback:** Spotify API (si disponible), iTunes Search API (solo promocional)

**3. Flujo de Búsqueda Recomendado:**
1. Buscar artista/álbum en MusicBrainz → obtener MBID
2. Usar MBID para buscar imagen en Cover Art Archive
3. Si no hay resultados, buscar en Discogs
4. Si aún no hay resultados, intentar Spotify (si autenticado) o iTunes como último recurso

**4. Consideraciones Legales:**
- **iTunes Search API:** Solo para uso promocional, no se pueden cachear imágenes
- **Cover Art Archive:** Imágenes con derechos de autor, uso permitido para metadata
- **MusicBrainz/Discogs:** Datos bajo licencias permisivas (CC0 o similares)
- Siempre respetar términos de servicio de cada API

**5. Rate Limits:**
- MusicBrainz: Generosos pero deben respetarse (1 request/segundo recomendado)
- Discogs: Generosos para uso gratuito
- Spotify: Más estrictos, requieren autenticación
- Implementar sistema de caché para reducir llamadas a APIs

**6. Almacenamiento:**
- Descargar imágenes localmente para mejor rendimiento
- Cachear metadata para evitar búsquedas repetidas
- Mantener referencia a fuente original (MBID, etc.) para futuras actualizaciones

---

_Última actualización: 2026-02-12_
