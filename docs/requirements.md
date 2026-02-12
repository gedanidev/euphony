# Euphony - Requisitos de Implementación

_Documento que lista todos los requisitos necesarios para implementar el proyecto Euphony_

---

## 1. Requisitos del Sistema

### Software Base Requerido

#### Backend (Python)
- **Python 3.10+** (recomendado 3.11 o superior)
- **pip** (gestor de paquetes de Python)
- **PostgreSQL 14+** (base de datos)
- **Git** (control de versiones)

#### Frontend (Node.js)
- **Node.js 18+** (recomendado LTS)
- **npm** o **yarn** o **pnpm** (gestor de paquetes)
- **Git** (control de versiones)

#### Base de Datos
- **PostgreSQL 14+** instalado y corriendo
- Acceso para crear bases de datos y usuarios

---

## 2. Dependencias del Proyecto

### Backend (Python)

#### Framework y Servidor
- `fastapi` - Framework web
- `uvicorn[standard]` - Servidor ASGI
- `python-multipart` - Para formularios y archivos

#### Base de Datos
- `sqlalchemy` - ORM
- `alembic` - Migraciones de BD
- `psycopg2-binary` o `asyncpg` - Driver PostgreSQL
- `python-dotenv` - Variables de entorno

#### Utilidades
- `pydantic` - Validación de datos (incluido con FastAPI)
- `python-jose[cryptography]` - JWT (para autenticación futura)
- `passlib[bcrypt]` - Hashing de contraseñas (para autenticación futura)
- `httpx` o `requests` - Cliente HTTP para APIs externas
- `python-dateutil` - Manejo de fechas

#### APIs Externas (Opcionales)
- `musicbrainzngs` - Cliente Python para MusicBrainz API
- `discogs-client` - Cliente Python para Discogs API
- `spotipy` - Cliente Python para Spotify API (si se implementa)

### Frontend (React)

#### Core
- `react` - Framework UI
- `react-dom` - Renderizado
- `react-router-dom` - Routing
- `vite` - Build tool y dev server

#### Estilos
- `tailwindcss` - Framework CSS
- `autoprefixer` - Compatibilidad CSS
- `postcss` - Procesador CSS

#### Estado y Datos
- `@tanstack/react-query` - Gestión de estado del servidor y caché
- `axios` o `fetch` - Cliente HTTP

#### UI Components (Opcional)
- `@headlessui/react` - Componentes UI sin estilos
- `@heroicons/react` - Iconos
- `react-hook-form` - Manejo de formularios
- `zod` - Validación de esquemas (compatible con react-hook-form)

#### Visualización (Para Fase 4 y 6)
- `recharts` o `chart.js` - Gráficos para estadísticas
- `d3` o `vis-network` o `react-force-graph` - Visualización de grafos (mapa de relaciones)

#### Utilidades
- `date-fns` - Manejo de fechas
- `clsx` o `classnames` - Clases CSS condicionales

---

## 3. Configuración Inicial

### Variables de Entorno

Crear archivo `.env` en la raíz del proyecto o en `backend/`:

```env
# Base de Datos
DATABASE_URL=postgresql://usuario:password@localhost:5432/euphony
# O para desarrollo local:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/euphony

# Backend
BACKEND_HOST=localhost
BACKEND_PORT=8000
SECRET_KEY=tu-clave-secreta-aqui-generar-con-openssl-rand-hex-32
ALGORITHM=HS256

# Frontend
VITE_API_URL=http://localhost:8000/api/v1

# APIs Externas (Opcionales)
# MusicBrainz - No requiere API key
MUSICBRAINZ_USER_AGENT=Euphony/1.0 (contact@example.com)

# Discogs - Requiere registro y OAuth
DISCOGS_CONSUMER_KEY=tu-consumer-key
DISCOGS_CONSUMER_SECRET=tu-consumer-secret

# Spotify - Requiere OAuth
SPOTIFY_CLIENT_ID=tu-client-id
SPOTIFY_CLIENT_SECRET=tu-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/spotify/callback

# Last.fm - Requiere API key
LASTFM_API_KEY=tu-api-key
LASTFM_API_SECRET=tu-api-secret

# LRCLIB - No requiere API key (servicio público)
# Usar directamente: https://lrclib.net/api
```

### Estructura de Directorios

```
euphony/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # Punto de entrada FastAPI
│   │   ├── config.py            # Configuración
│   │   ├── database.py          # Conexión a BD
│   │   ├── models/              # Modelos SQLAlchemy
│   │   │   ├── __init__.py
│   │   │   ├── artist.py
│   │   │   ├── album.py
│   │   │   ├── song.py
│   │   │   ├── genre.py
│   │   │   ├── mood.py
│   │   │   ├── occasion.py
│   │   │   ├── playlist.py
│   │   │   ├── listen_history.py
│   │   │   └── ...
│   │   ├── schemas/             # Schemas Pydantic
│   │   │   ├── __init__.py
│   │   │   ├── artist.py
│   │   │   └── ...
│   │   ├── api/                  # Endpoints
│   │   │   ├── __init__.py
│   │   │   ├── routes/
│   │   │   │   ├── artists.py
│   │   │   │   ├── albums.py
│   │   │   │   ├── songs.py
│   │   │   │   └── ...
│   │   ├── services/            # Lógica de negocio
│   │   │   ├── __init__.py
│   │   │   ├── musicbrainz.py
│   │   │   ├── cover_art.py
│   │   │   ├── lyrics.py
│   │   │   └── ...
│   │   └── utils/               # Utilidades
│   ├── alembic/                 # Migraciones
│   │   ├── versions/
│   │   └── env.py
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Componentes React
│   │   │   ├── Artist/
│   │   │   ├── Album/
│   │   │   ├── Song/
│   │   │   └── ...
│   │   ├── pages/               # Páginas
│   │   │   ├── Artists/
│   │   │   ├── Albums/
│   │   │   ├── Songs/
│   │   │   └── ...
│   │   ├── hooks/               # Custom hooks
│   │   ├── services/           # Cliente API
│   │   ├── utils/              # Utilidades
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── README.md
│
├── docs/
│   ├── architecture.md
│   ├── requirements.md
│   └── ...
│
├── planning/
│   └── roadmap.md
│
└── README.md
```

---

## 4. APIs Externas Necesarias

### APIs Gratuitas (Sin Autenticación)

#### MusicBrainz
- **URL:** `https://musicbrainz.org/ws/2/`
- **Autenticación:** No requerida (pero User-Agent requerido)
- **Rate Limit:** ~1 request/segundo
- **Uso:** Metadata de artistas, álbumes, canciones
- **Documentación:** https://musicbrainz.org/doc/MusicBrainz_API

#### Cover Art Archive
- **URL:** `https://coverartarchive.org/`
- **Autenticación:** No requerida
- **Uso:** Imágenes de portadas de álbumes
- **Requiere:** MusicBrainz Release ID (MBID)
- **Documentación:** https://musicbrainz.org/doc/Cover_Art_Archive/API

#### LRCLIB (Letras)
- **URL:** `https://lrclib.net/api`
- **Autenticación:** No requerida
- **Uso:** Letras sincronizadas en formato LRC
- **Documentación:** https://github.com/tranxuanthang/lrcget

#### Lyrics.ovh
- **URL:** `https://api.lyrics.ovh/v1/`
- **Autenticación:** No requerida
- **Uso:** Letras de canciones (fallback)
- **Documentación:** https://lyrics.ovh

### APIs con Autenticación (Opcionales)

#### Discogs
- **URL:** `https://api.discogs.com/`
- **Autenticación:** OAuth (gratuito)
- **Registro:** https://www.discogs.com/settings/developers
- **Uso:** Metadata e imágenes de releases
- **Documentación:** https://www.discogs.com/developers/

#### Spotify
- **URL:** `https://api.spotify.com/v1/`
- **Autenticación:** OAuth2 (requiere cuenta Spotify)
- **Registro:** https://developer.spotify.com/dashboard
- **Uso:** Metadata, imágenes, previews (limitado)
- **Documentación:** https://developer.spotify.com/documentation/web-api

#### Last.fm
- **URL:** `https://ws.audioscrobbler.com/2.0/`
- **Autenticación:** API Key (gratuito)
- **Registro:** https://www.last.fm/api/account/create
- **Uso:** Tags, artistas similares, scrobbling
- **Documentación:** https://www.last.fm/api

#### iTunes Search API
- **URL:** `https://itunes.apple.com/search`
- **Autenticación:** No requerida
- **Limitaciones:** Solo uso promocional, no cachear imágenes
- **Uso:** Metadata e imágenes pequeñas (fallback)
- **Documentación:** https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/

---

## 5. Instalación Paso a Paso

### Paso 1: Instalar Software Base

#### macOS (usando Homebrew)
```bash
# Python
brew install python@3.11

# PostgreSQL
brew install postgresql@14
brew services start postgresql@14

# Node.js
brew install node@18
```

#### Linux (Ubuntu/Debian)
```bash
# Python
sudo apt update
sudo apt install python3.11 python3-pip

# PostgreSQL
sudo apt install postgresql-14 postgresql-contrib
sudo systemctl start postgresql

# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Windows
- Python: Descargar desde https://www.python.org/downloads/
- PostgreSQL: Descargar desde https://www.postgresql.org/download/windows/
- Node.js: Descargar desde https://nodejs.org/

### Paso 2: Configurar Base de Datos

```bash
# Crear usuario y base de datos
sudo -u postgres psql

# En PostgreSQL:
CREATE USER euphony_user WITH PASSWORD 'tu_password';
CREATE DATABASE euphony OWNER euphony_user;
GRANT ALL PRIVILEGES ON DATABASE euphony TO euphony_user;
\q
```

### Paso 3: Setup Backend

```bash
cd backend

# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar migraciones
alembic upgrade head

# Iniciar servidor
uvicorn app.main:app --reload
```

### Paso 4: Setup Frontend

```bash
cd frontend

# Instalar dependencias
npm install
# o
yarn install
# o
pnpm install

# Iniciar servidor de desarrollo
npm run dev
# o
yarn dev
# o
pnpm dev
```

---

## 6. Archivos de Configuración Necesarios

### backend/requirements.txt
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
alembic==1.12.1
psycopg2-binary==2.9.9
python-dotenv==1.0.0
pydantic==2.5.0
pydantic-settings==2.1.0
httpx==0.25.2
python-dateutil==2.8.2
python-multipart==0.0.6
```

### frontend/package.json (estructura básica)
```json
{
  "name": "euphony-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.12.0",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "vite": "^5.0.8"
  }
}
```

### backend/alembic.ini (configuración básica)
```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql://usuario:password@localhost:5432/euphony

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic
```

---

## 7. Checklist de Setup Inicial

### Backend
- [ ] Python 3.10+ instalado
- [ ] PostgreSQL instalado y corriendo
- [ ] Base de datos creada
- [ ] Entorno virtual creado y activado
- [ ] Dependencias instaladas (`pip install -r requirements.txt`)
- [ ] Archivo `.env` configurado
- [ ] Migraciones ejecutadas (`alembic upgrade head`)
- [ ] Servidor corriendo (`uvicorn app.main:app --reload`)

### Frontend
- [ ] Node.js 18+ instalado
- [ ] Dependencias instaladas (`npm install`)
- [ ] Variables de entorno configuradas (si aplica)
- [ ] Servidor de desarrollo corriendo (`npm run dev`)

### APIs Externas (Opcional)
- [ ] MusicBrainz: User-Agent configurado
- [ ] Discogs: OAuth credentials obtenidas (si se usa)
- [ ] Spotify: OAuth credentials obtenidas (si se usa)
- [ ] Last.fm: API key obtenida (si se usa)

---

## 8. Comandos Útiles

### Backend
```bash
# Activar entorno virtual
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate    # Windows

# Crear nueva migración
alembic revision --autogenerate -m "descripción"

# Aplicar migraciones
alembic upgrade head

# Revertir migración
alembic downgrade -1

# Ejecutar servidor
uvicorn app.main:app --reload

# Ejecutar tests (cuando se implementen)
pytest
```

### Frontend
```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Build para producción
npm run build

# Preview de build
npm run preview

# Ejecutar tests (cuando se implementen)
npm test
```

---

## 9. Recursos Adicionales

### Documentación
- FastAPI: https://fastapi.tiangolo.com/
- SQLAlchemy: https://docs.sqlalchemy.org/
- Alembic: https://alembic.sqlalchemy.org/
- React: https://react.dev/
- Vite: https://vitejs.dev/
- TailwindCSS: https://tailwindcss.com/

### APIs Externas
- MusicBrainz API: https://musicbrainz.org/doc/MusicBrainz_API
- Cover Art Archive: https://musicbrainz.org/doc/Cover_Art_Archive/API
- Discogs API: https://www.discogs.com/developers/
- Spotify API: https://developer.spotify.com/documentation/web-api
- Last.fm API: https://www.last.fm/api

---

## 10. Notas Importantes

### Desarrollo
- El backend corre en `http://localhost:8000` por defecto
- El frontend corre en `http://localhost:5173` por defecto (Vite)
- La documentación de API (Swagger) está en `http://localhost:8000/docs`
- Alternativa a Swagger: `http://localhost:8000/redoc`

### Seguridad
- **NUNCA** commitees archivos `.env` al repositorio
- Agregar `.env` al `.gitignore`
- Usar variables de entorno para secretos
- Generar `SECRET_KEY` seguro para producción

### Rate Limits
- MusicBrainz: ~1 request/segundo
- Cover Art Archive: Sin límite específico, pero ser respetuoso
- Discogs: Generosos para uso gratuito
- Spotify: Más estrictos, requiere autenticación
- Implementar caché para reducir llamadas a APIs

---

_Última actualización: 2026-02-12_
