/**
 * Shazam API client via RapidAPI - v2 API (Apple Music Catalog schema)
 * Plan gratuito: 500 requests/mes
 */

const SHAZAM_API_KEY = import.meta.env.VITE_SHAZAM_API_KEY || ''
const SHAZAM_HOST = 'shazam.p.rapidapi.com'

async function shazamFetch(endpoint, params = {}) {
  if (!SHAZAM_API_KEY) {
    throw new Error('Shazam API key not configured. Set VITE_SHAZAM_API_KEY in your .env file.')
  }

  const url = new URL(`https://${SHAZAM_HOST}${endpoint}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': SHAZAM_API_KEY,
      'X-RapidAPI-Host': SHAZAM_HOST,
    },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Shazam API error: ${res.status} ${err}`)
  }

  return res.json()
}

/**
 * Parse artwork URL - replace {w}x{h} with actual dimensions
 * @param {string} url - URL with {w}x{h} placeholder
 * @param {number} size - Desired size (default 400)
 * @returns {string} URL with actual dimensions
 */
function parseArtworkUrl(url, size = 400) {
  if (!url) return ''
  return url.replace(/{w}x{h}/g, `${size}x${size}`)
}

/**
 * Formatear duración en ms a MM:SS
 * @param {number} ms - Duración en milisegundos
 * @returns {string} Formato MM:SS
 */
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Buscar canciones por query string (v2 API)
 * @param {string} term - Término de búsqueda
 * @param {number} limit - Límite de resultados (max 50)
 * @param {number} offset - Offset para paginación
 * @returns {Promise<Array>} Resultados de búsqueda
 */
export async function searchSongs(term, { limit = 10, offset = 0 } = {}) {
  if (!term?.trim()) return []

  const data = await shazamFetch('/v2/search', {
    term,
    locale: 'en-US',
    offset,
    limit: Math.min(limit, 50),
  })

  // v2 API: results.songs.data[].attributes (Apple Music Catalog schema)
  const songs = data?.results?.songs?.data || []
  return songs.map(song => {
    const attrs = song.attributes || {}
    return {
      id: song.id,
      title: attrs.name || '',
      artist: attrs.artistName || '',
      artistId: attrs.artistId,
      album: attrs.albumName || '',
      year: attrs.releaseDate ? parseInt(attrs.releaseDate.slice(0, 4)) : null,
      duration: attrs.durationInMillis ? Math.floor(attrs.durationInMillis / 1000) : null,
      durationText: attrs.durationInMillis ? formatDuration(attrs.durationInMillis) : '',
      cover: parseArtworkUrl(attrs.artwork?.url, 400),
      shazamId: song.id,
      shazamUrl: attrs.url || '',
      genre: attrs.genreNames?.[0] || '',
      // Para crear la canción localmente
      normalized: {
        title: attrs.name || '',
        artist_name: attrs.artistName || '',
        album: attrs.albumName || '',
        year: attrs.releaseDate ? parseInt(attrs.releaseDate.slice(0, 4)) : null,
        duration: attrs.durationInMillis ? Math.floor(attrs.durationInMillis / 1000) : null,
        source_url: attrs.url || '',
        source: 'shazam',
        external_id: song.id,
        cover_url: parseArtworkUrl(attrs.artwork?.url, 400),
        genre: attrs.genreNames?.[0] || '',
      }
    }
  })
}

/**
 * Autocompletar sugerencias mientras escribe (v2 API)
 * @param {string} query - Query parcial
 * @returns {Promise<Array>} Sugerencias
 */
export async function getSearchSuggestions(query) {
  if (!query?.trim()) return []

  try {
    const data = await shazamFetch('/v2/auto-complete', {
      term: query,
      locale: 'en-US',
    })

    // v2 API returns suggestions in results.suggestions
    return data?.results?.suggestions || []
  } catch {
    return []
  }
}

/**
 * Extraer metadatos normalizados de un resultado de Shazam
 * para crear una canción en el sistema local
 * @param {Object} shazamResult - Resultado de searchSongs
 * @returns {Object} Datos normalizados para createSong
 */
export function extractSongData(shazamResult) {
  if (!shazamResult?.normalized) {
    throw new Error('Invalid Shazam result')
  }

  return {
    title: shazamResult.normalized.title,
    artist_name: shazamResult.normalized.artist_name,
    album: shazamResult.normalized.album,
    year: shazamResult.normalized.year,
    duration: shazamResult.normalized.duration,
    type: 'original',
    availability: 'wishlist',
    source_url: shazamResult.normalized.source_url,
    source: 'shazam',
    external_id: shazamResult.normalized.external_id,
    cover_url: shazamResult.normalized.cover_url,
    primary_genre: shazamResult.normalized.genre, // v2 uses primary_genre, not genre
    mood: null,
    comment: `Imported from Shazam: ${shazamResult.shazamUrl}`,
  }
}

// Note: getSongDetails and searchArtists are not used by the UI currently.
// If needed, they should also be migrated to v2 endpoints.
