# 🎵 Euphony

Music library management system with Sony Walkman NW-A307 integration.

## 📋 Descripción

Euphony es un sistema de gestión de biblioteca musical que permite organizar artistas, álbumes, canciones y playlists. Incluye funcionalidades avanzadas como:

- Gestión completa de artistas, álbumes y canciones
- Relaciones entre artistas (colaboraciones, miembros de banda)
- Compositores separados de intérpretes
- Tipos de versión (original, cover, remix, remaster, etc.)
- Playlists personalizadas
- Estadísticas de reproducción
- Búsqueda avanzada con múltiples filtros
- Integración con APIs externas (letras, imágenes, metadata)
- Exportación a formato M3U8 para Walkman

## 🏗️ Project Structure

```
euphony/
├── frontend/       # React + Vite web app
├── backend/        # FastAPI REST API
├── docs/          # Documentation
└── planning/      # Project planning & roadmap
```

## 📚 Documentation

### Documentación Técnica
- [Architecture](docs/architecture.md) - Technical stack and database structure
- [Requirements](docs/requirements.md) - Implementation requirements and setup guide

### Planificación
- [Roadmap](planning/roadmap.md) - Development phases and features
- [Technology Choices](planning/technology-choices.md) - Justification of technology decisions

## 🚀 Quick Start

### Prerrequisitos

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Git

Para más detalles sobre instalación y configuración, consulta [Requirements](docs/requirements.md).

### Setup Rápido

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Ver los READMEs individuales en `frontend/` y `backend/` para más detalles.

## 🛠️ Tech Stack

- **Backend:** Python + FastAPI
- **Frontend:** React + Vite
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy
- **Styles:** TailwindCSS

Para entender por qué se eligieron estas tecnologías, consulta [Technology Choices](planning/technology-choices.md).

## 📖 Características Principales

### Fase 1: CRUD Básico (MVP)
- ✅ Gestión de artistas, álbumes y canciones
- ✅ Relaciones entre artistas (colaboraciones)
- ✅ Compositores e intérpretes separados
- ✅ Tipos de versión (cover, remix, etc.)
- ✅ Géneros, moods y ocasiones

### Fase 2: Playlists
- ✅ Crear y gestionar playlists
- ✅ Reordenar canciones (drag & drop)
- ✅ Exportar a M3U8 para Walkman

### Fase 3-9: Funcionalidades Avanzadas
- 📊 Estadísticas de reproducción
- 🔍 Búsqueda avanzada
- 🌐 Integración con APIs externas
- 📤 Compartir playlists
- 🗺️ Mapa de relaciones entre artistas
- 🔄 Sincronización desde servicios de streaming

Ver [Roadmap](planning/roadmap.md) para el plan completo de desarrollo.

## 🔗 APIs Externas Integradas

- **MusicBrainz** - Metadata de artistas y álbumes
- **Cover Art Archive** - Imágenes de portadas
- **LRCLIB** - Letras sincronizadas (formato LRC)
- **Discogs** - Metadata adicional de releases
- **Spotify/Last.fm** - Sincronización opcional

## 📝 Notas de Diseño

### Manejo de Artistas Colaboradores
Euphony evita el problema de Apple Music donde se crean artistas compuestos como "X feat. Z". En su lugar, mantiene artistas individuales y los relaciona a canciones con roles (principal/colaborador).

### Búsqueda Bidireccional
Al buscar un artista, se muestran tanto canciones donde es principal como donde colabora, manteniendo los artistas separados en la base de datos.

Ver [Roadmap](planning/roadmap.md) para más detalles sobre el diseño.

## 🤝 Contribuir

Este es un proyecto personal, pero las sugerencias y mejoras son bienvenidas.

## 📄 Licencia

_Próximamente_

---

_Built with ❤️ for better music organization_
