import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.routers import songs, playlists, artists, albums, genres, moods, import_routes, enrich, auth, smart_playlists
from app.routers import user_auth
from app.routers.user_auth import get_current_user

app = FastAPI(title="Euphony API", version="0.2.0")

# CORS — must list explicit origins for cookies to work (no wildcard with credentials)
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes (no auth required)
app.include_router(user_auth.router, prefix="/api")
app.include_router(auth.router, prefix="/api")  # Spotify OAuth (public)

# Protected routes — all require a valid session cookie
_auth_dep = [Depends(get_current_user)]
app.include_router(songs.router, prefix="/api", dependencies=_auth_dep)
app.include_router(playlists.router, prefix="/api", dependencies=_auth_dep)
app.include_router(artists.router, prefix="/api", dependencies=_auth_dep)
app.include_router(albums.router, prefix="/api", dependencies=_auth_dep)
app.include_router(genres.router, prefix="/api", dependencies=_auth_dep)
app.include_router(moods.router, prefix="/api", dependencies=_auth_dep)
app.include_router(import_routes.router, prefix="/api", dependencies=_auth_dep)
app.include_router(enrich.router, prefix="/api", dependencies=_auth_dep)
app.include_router(smart_playlists.router, prefix="/api", dependencies=_auth_dep)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.2.0"}
