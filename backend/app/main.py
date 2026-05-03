from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import songs, playlists, artists, albums, genres, moods, import_routes, enrich, auth

app = FastAPI(title="Euphony API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(songs.router, prefix="/api")
app.include_router(playlists.router, prefix="/api")
app.include_router(artists.router, prefix="/api")
app.include_router(albums.router, prefix="/api")
app.include_router(genres.router, prefix="/api")
app.include_router(moods.router, prefix="/api")
app.include_router(import_routes.router, prefix="/api")
app.include_router(enrich.router, prefix="/api")
app.include_router(auth.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.2.0"}
