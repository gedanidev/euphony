from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import and_, or_
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/smart-playlists", tags=["smart-playlists"])


# ---------------------------------------------------------------------------
# Query engine
# ---------------------------------------------------------------------------

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
        # JSONB contains: check if Song.subgenres contains the string value
        v = str(value)
        if op == "is":
            return models.Song.subgenres.contains([v])
        if op == "is_not":
            return ~models.Song.subgenres.contains([v])
        if op == "contains":
            return sa.cast(models.Song.subgenres, sa.Text).ilike(f"%{v}%")
        if op == "not_contains":
            return ~sa.cast(models.Song.subgenres, sa.Text).ilike(f"%{v}%")
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


def _str_filter(col, op, value):
    v = str(value)
    if op == "contains":      return col.ilike(f"%{v}%")
    if op == "not_contains":  return ~col.ilike(f"%{v}%")
    if op == "is":            return col.ilike(v)
    if op == "is_not":        return ~col.ilike(v)
    if op == "starts_with":   return col.ilike(f"{v}%")
    if op == "ends_with":     return col.ilike(f"%{v}")
    return None


def _int_filter(col, op, value):
    if op == "is":      return col == int(value)
    if op == "is_not":  return col != int(value)
    if op == "gt":      return col > int(value)
    if op == "lt":      return col < int(value)
    if op == "between":
        lo, hi = int(value[0]), int(value[1])
        return col.between(lo, hi)
    return None


def _execute_conditions(
    db: Session,
    conditions: List[schemas.SmartPlaylistCondition],
    match_all: bool,
) -> List[models.Song]:
    """Build and run the smart playlist query. Returns songs ordered by year ASC, nulls last."""
    from sqlalchemy.orm import selectinload

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

    clauses = [c for cond in conditions if (c := _build_filter(cond)) is not None]

    if clauses:
        combined = and_(*clauses) if match_all else or_(*clauses)
        q = q.filter(combined)

    return q.order_by(models.Song.year.asc().nulls_last()).all()


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=List[schemas.SmartPlaylistRead])
def list_smart_playlists(db: Session = Depends(get_db)):
    return db.query(models.SmartPlaylist).order_by(models.SmartPlaylist.name).all()


@router.post("", response_model=schemas.SmartPlaylistRead, status_code=201)
def create_smart_playlist(data: schemas.SmartPlaylistCreate, db: Session = Depends(get_db)):
    pl = models.SmartPlaylist(
        name=data.name,
        match_all=data.match_all,
        conditions=[c.model_dump() for c in data.conditions],
    )
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return pl


@router.post("/preview", response_model=schemas.SmartPlaylistPreviewResponse)
def preview_smart_playlist(data: schemas.SmartPlaylistPreviewRequest, db: Session = Depends(get_db)):
    """Stateless preview — evaluates conditions without saving. Used by the builder UI."""
    songs = _execute_conditions(db, data.conditions, data.match_all)
    return schemas.SmartPlaylistPreviewResponse(song_count=len(songs), songs=songs)


@router.get("/{playlist_id}", response_model=schemas.SmartPlaylistPreviewResponse)
def get_smart_playlist(playlist_id: UUID, db: Session = Depends(get_db)):
    pl = db.query(models.SmartPlaylist).filter(models.SmartPlaylist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    conditions = [schemas.SmartPlaylistCondition(**c) for c in pl.conditions]
    songs = _execute_conditions(db, conditions, pl.match_all)
    return schemas.SmartPlaylistPreviewResponse(song_count=len(songs), songs=songs)


@router.put("/{playlist_id}", response_model=schemas.SmartPlaylistRead)
def update_smart_playlist(
    playlist_id: UUID, data: schemas.SmartPlaylistUpdate, db: Session = Depends(get_db)
):
    pl = db.query(models.SmartPlaylist).filter(models.SmartPlaylist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    if data.name is not None:
        pl.name = data.name
    if data.match_all is not None:
        pl.match_all = data.match_all
    if data.conditions is not None:
        pl.conditions = [c.model_dump() for c in data.conditions]
    db.commit()
    db.refresh(pl)
    return pl


@router.delete("/{playlist_id}", status_code=204)
def delete_smart_playlist(playlist_id: UUID, db: Session = Depends(get_db)):
    pl = db.query(models.SmartPlaylist).filter(models.SmartPlaylist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    db.delete(pl)
    db.commit()


@router.get("/{playlist_id}/export/m3u", response_class=PlainTextResponse)
def export_smart_playlist_m3u(playlist_id: UUID, db: Session = Depends(get_db)):
    pl = db.query(models.SmartPlaylist).filter(models.SmartPlaylist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Smart playlist not found")
    conditions = [schemas.SmartPlaylistCondition(**c) for c in pl.conditions]
    songs = _execute_conditions(db, conditions, pl.match_all)

    lines = ["#EXTM3U"]
    for song in songs:
        principals = [sa.artist.name for sa in song.song_artists if sa.role == "principal"]
        artist_str = ", ".join(principals) if principals else "Unknown"
        duration = song.duration if song.duration else -1
        lines.append(f"#EXTINF:{duration},{artist_str} - {song.title}")
        lines.append(song.file_path or song.title)

    content = "\n".join(lines)
    filename = pl.name.replace(" ", "_")
    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f'attachment; filename="{filename}.m3u"'},
    )


# ---------------------------------------------------------------------------
# Genre-based Smart Playlist Creation
# ---------------------------------------------------------------------------

# Lista de tags "basura" conocidos de MusicBrainz/Last.fm que no son géneros
_GARBAGE_TAGS = {
    "special purpose artist",
    "composer",
    "conductor",
    "non-music",
    "unknown",
    "various artists",
    # NOTE: "soundtrack"/"original soundtrack"/"score"/"instrumental"/"acoustic"
    # are deliberately NOT here — they're real style categories once a song
    # already has them as primary_genre (e.g. film-score/cinematic music),
    # not junk tags to filter out.
    "live",
    "remix",
    "cover",
    "karaoke",
    "tribute",
    "compilation",
    "anthology",
    "greatest hits",
    "essential",
    "best of",
    "the best",
    "complete",
    "collector",
    "deluxe",
    "anniversary",
    "remastered",
    "reissue",
    "bonus",
    "explicit",
    "clean",
    "radio edit",
    "single",
    "ep",
    "lp",
    "album",
    "mixtape",
    "demo",
    "unreleased",
    "bootleg",
    "promo",
    "white label",
    "unknown artist",
    "no artist",
    "untitled",
}

# Gentilicios/idiomas/países comunes que NO son géneros musicales
_LANGUAGE_COUNTRY_TAGS = {
    # Idiomas
    "english", "spanish", "french", "german", "italian", "portuguese", "japanese",
    "chinese", "korean", "russian", "dutch", "swedish", "norwegian", "danish",
    "finnish", "polish", "czech", "hungarian", "greek", "turkish", "arabic",
    "hebrew", "hindi", "urdu", "bengali", "thai", "vietnamese", "indonesian",
    "malay", "tagalog", "swahili", "afrikaans", "catalan", "basque", "galician",
    "welsh", "irish", "scottish", "breton", "luxembourgish", "icelandic",
    "estonian", "latvian", "lithuanian", "slovak", "slovene", "croatian",
    "serbian", "bosnian", "macedonian", "bulgarian", "romanian", "ukrainian",
    "belarusian", "georgian", "armenian", "azerbaijani", "kazakh", "uzbek",
    "kurdish", "persian", "pashto", "tamil", "telugu", "kannada", "malayalam",
    "marathi", "gujarati", "punjabi", "sinhala", "burmese", "khmer", "lao",
    "mongolian", "tibetan", "uyghur", "nepali", "sanskrit",
    # NOTE: "latin" deliberately excluded from this language list — it's a
    # real, widely-used music genre umbrella (reggaeton/salsa/tropical etc.),
    # not just the language, and should stay eligible as a suggestion.
    # Países
    "american", "british", "canadian", "mexican", "colombian", "argentine",
    "brazilian", "chilean", "peruvian", "venezuelan", "ecuadorian", "uruguayan",
    "paraguayan", "bolivian", "cuban", "puerto rican", "dominican", "jamaican",
    "haitian", "panamanian", "costa rican", "guatemalan", "honduran", "nicaraguan",
    "salvadoran", "belizean", "spanish", "french", "german", "italian",
    "portuguese", "dutch", "belgian", "swiss", "austrian", "swedish", "norwegian",
    "danish", "finnish", "icelandic", "irish", "scottish", "welsh", "english",
    "polish", "czech", "hungarian", "romanian", "bulgarian", "greek", "turkish",
    "russian", "ukrainian", "belarusian", "lithuanian", "latvian", "estonian",
    "slovak", "slovenian", "croatian", "serbian", "bosnian", "montenegrin",
    "macedonian", "albanian", "kosovar", "moldovan", "georgian", "armenian",
    "azerbaijani", "kazakh", "uzbek", "turkmen", "kyrgyz", "tajik", "mongolian",
    "chinese", "japanese", "korean", "taiwanese", "hong kong", "singaporean",
    "malaysian", "thai", "vietnamese", "indonesian", "filipino", "burmese",
    "cambodian", "laotian", "indian", "pakistani", "bangladeshi", "sri lankan",
    "nepali", "bhutanese", "maldivian", "afghan", "iranian", "iraqi", "syrian",
    "lebanese", "jordanian", "israeli", "palestinian", "saudi", "kuwaiti",
    "qatari", "bahraini", "emirati", "omani", "yemeni", "egyptian", "libyan",
    "tunisian", "algerian", "moroccan", "mauritanian", "sudanese", "ethiopian",
    "eritrean", "somali", "djiboutian", "kenyan", "tanzanian", "ugandan",
    "rwandan", "burundian", "south sudanese", "chadian", "nigerian", "ghanaian",
    "ivorian", "senegalese", "malian", "burkinabe", "nigerien", "beninese",
    "togolese", "sierra leonean", "liberian", "guinean", "gambian", "guinea-bissauan",
    "cape verdean", "sao tomean", "equatorial guinean", "gabonese", "congolese",
    "central african", "cameroonian", "zambian", "zimbabwean", "malawian",
    "mozambican", "angolan", "namibian", "botswanan", "south african", "lesotho",
    "swazi", "comoran", "mauritian", "seychellois", "malagasy", "australian",
    "new zealander", "papua new guinean", "fijian", "solomon islander", "vanuatu",
    "new caledonian", "samoan", "tongan", "niuean", "cook islander", "tuvaluan",
    "nauruan", "palauan", "marshallese", "micronesian", "kiribati", "tuvalu",
    "iceland",
    # Variantes específicas encontradas
    "japan", "korea", "china", "mexico", "colombia", "argentina", "peru",
    "venezuela", "chile", "ecuador", "uruguay", "paraguay", "bolivia",
    "spain", "england", "france", "germany", "italy", "portugal", "netherlands",
    "belgium", "switzerland", "austria", "sweden", "norway", "denmark",
    "finland", "ireland", "scotland", "wales", "poland", "czech republic",
    "hungary", "romania", "bulgaria", "greece", "turkey", "russia", "ukraine",
    "belarus", "lithuania", "latvia", "estonia", "slovakia", "slovenia",
    "croatia", "serbia", "bosnia", "macedonia", "albania", "moldova",
    "georgia", "armenia", "azerbaijan", "kazakhstan", "uzbekistan",
    "turkmenistan", "kyrgyzstan", "tajikistan", "mongolia", "china",
    "taiwan", "hong kong", "singapore", "malaysia", "thailand", "vietnam",
    "indonesia", "philippines", "myanmar", "cambodia", "laos", "india",
    "pakistan", "bangladesh", "sri lanka", "nepal", "bhutan", "maldives",
    "afghanistan", "iran", "iraq", "syria", "lebanon", "jordan", "israel",
    "palestine", "saudi arabia", "kuwait", "qatar", "bahrain", "uae",
    "oman", "yemen", "egypt", "libya", "tunisia", "algeria", "morocco",
    "mauritania", "sudan", "ethiopia", "eritrea", "somalia", "djibouti",
    "kenya", "tanzania", "uganda", "rwanda", "burundi", "south sudan",
    "chad", "niger", "nigeria", "ghana", "ivory coast", "senegal", "mali",
    "burkina faso", "benin", "togo", "sierra leone", "liberia", "guinea",
    "gambia", "guinea-bissau", "cape verde", "sao tome", "equatorial guinea",
    "gabon", "congo", "central african republic", "cameroon", "zambia",
    "zimbabwe", "malawi", "mozambique", "angola", "namibia", "botswana",
    "south africa", "lesotho", "eswatini", "comoros", "mauritius", "seychelles",
    "madagascar", "australia", "new zealand", "papua new guinea", "fiji",
    "solomon islands", "vanuatu", "new caledonia", "samoa", "tonga", "niue",
    "cook islands", "tuvalu", "nauru", "palau", "marshall islands",
    "micronesia", "kiribati",
}


def _is_valid_genre(genre: str, db: Session) -> bool:
    """Check if a genre tag is valid (not an artist name, not garbage, not language/country)."""
    if not genre or not genre.strip():
        return False

    genre_lower = genre.lower().strip()

    # 1. Check against garbage tags
    if genre_lower in _GARBAGE_TAGS:
        return False

    # 2. Check against language/country tags
    if genre_lower in _LANGUAGE_COUNTRY_TAGS:
        return False

    # 3. Check if it matches an existing artist name (case-insensitive)
    # This catches cases like "nightwish", "metallica", "juan gabriel"
    artist_exists = db.query(models.Artist.id).filter(
        models.Artist.name.ilike(genre_lower)
    ).first()
    if artist_exists:
        return False

    return True


@router.get("/genre-suggestions", response_model=schemas.GenreSuggestionsResponse)
def get_genre_suggestions(
    min_songs: int = Query(5, ge=1),
    db: Session = Depends(get_db),
):
    """Return filtered genre suggestions for smart playlist creation.
    
    Filters out:
    - Artist names (case-insensitive match against Artist table)
    - Known garbage tags from MusicBrainz/Last.fm
    - Language/country tags ("japanese", "spanish", "colombia", etc.)
    """
    from collections import Counter

    # Get all primary genres with their counts
    rows = db.query(models.Song.primary_genre).filter(
        models.Song.primary_genre.isnot(None)
    ).all()
    genres = [r[0] for r in rows]
    counts = Counter(genres)

    # Filter and build suggestions
    suggestions = []
    for genre, count in counts.most_common():
        if count < min_songs:
            continue
        if _is_valid_genre(genre, db):
            suggestions.append(schemas.GenreSuggestion(
                genre=genre,
                song_count=count,
                checked=True,
            ))

    return schemas.GenreSuggestionsResponse(suggestions=suggestions)


@router.post("/create-from-genres", response_model=schemas.CreateGenrePlaylistsResponse)
def create_genre_playlists(
    data: schemas.CreateGenrePlaylistsRequest,
    db: Session = Depends(get_db),
):
    """Create SmartPlaylists from selected genres.
    
    Each playlist will have a single condition: primary_genre IS <genre>
    """
    created = []
    skipped = []

    for genre in data.genres:
        if not genre or not genre.strip():
            continue

        name = genre.strip().title()

        # Check if playlist with this name already exists
        existing = db.query(models.SmartPlaylist).filter(
            models.SmartPlaylist.name == name
        ).first()
        if existing:
            skipped.append(name)
            continue

        # Create the smart playlist
        conditions = [
            {
                "field": "primary_genre",
                "op": "is",
                "value": genre.strip(),
            }
        ]

        pl = models.SmartPlaylist(
            name=name,
            match_all=True,
            conditions=conditions,
        )
        db.add(pl)
        created.append(name)

    db.commit()

    return schemas.CreateGenrePlaylistsResponse(
        created=created,
        skipped=skipped,
    )
