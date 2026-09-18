/**
 * Shazam API client via RapidAPI
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
 * Buscar canciones por query string
 *
 * NOTE: this RapidAPI key is subscribed to the Shazam v2 API, which mirrors
 * the Apple Music Catalog schema (results.songs.data[].attributes) — not the
 * older v1 scraper-style schema (tracks.hits[].track) this file originally
 * assumed. Verified against a live response 2026-09-03.
 *
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

  const tracks = data?.results?.songs?.data || []
  return tracks.map(item => {
    const a = item.attributes || {}
    const cover = a.artwork?.url ? a.artwork.url.replace('{w}x{h}', '400x400') : ''
    const year = a.releaseDate ? parseInt(a.releaseDate.slice(0, 4)) || null : null
    const duration = a.durationInMillis ? Math.floor(a.durationInMillis / 1000) : null
    const genre = a.genreNames?.[0] || ''

    return {
      id: item.id,
      title: a.name || '',
      artist: a.artistName || '',
      album: a.albumName || '',
      year,
      duration,
      durationText: null,
      cover,
      shazamId: item.id,
      shazamUrl: a.url || '',
      genre,
      label: '',
      // Para crear la canción localmente
      normalized: {
        title: a.name || '',
        artist_name: a.artistName || '',
        album: a.albumName || '',
        year,
        duration,
        source_url: a.url || '',
        source: 'shazam',
        external_id: item.id,
        cover_url: cover,
        genre,
      }
    }
  })
}

/**
 * Obtener detalles de una canción por Shazam ID
 *
 * NOT USED by ShazamSearch.jsx currently, and NOT verified against the v2
 * API this key is subscribed to (unlike searchSongs/getSearchSuggestions,
 * which were fixed and tested 2026-09-03) — still on the old v1 path/shape.
 * Fix this the same way (test against /v2/... first) before wiring it up.
 *
 * @param {string} key - Shazam song key
 * @returns {Promise<Object>} Detalles de la canción
 */
export async function getSongDetails(key) {
  const data = await shazamFetch('/songs/get-details', { key })

  const track = data?.track
  if (!track) throw new Error('Song not found')

  return {
    id: track.key,
    title: track.title || '',
    artist: track.subtitle || '',
    artistId: track.artists?.[0]?.adamid,
    album: track.sections?.[0]?.metadata?.find(m => m.title === 'Album')?.text || '',
    year: track.sections?.[0]?.metadata?.find(m => m.title === 'Released')?.text || '',
    duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : null,
    durationText: track.duration_label || '',
    cover: track.share?.image || track.images?.coverart || '',
    shazamId: track.key,
    shazamUrl: track.url || '',
    genre: track.genres?.primary || '',
    label: track.hub?.actions?.[0]?.label || '',
    lyrics: track.sections?.find(s => s.type === 'LYRICS')?.text || '',
    previewUrl: track.hub?.actions?.[1]?.uri || '', // Preview audio
    normalized: {
      title: track.title || '',
      artist_name: track.subtitle || '',
      album: track.sections?.[0]?.metadata?.find(m => m.title === 'Album')?.text || '',
      year: parseInt(track.sections?.[0]?.metadata?.find(m => m.title === 'Released')?.text) || null,
      duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : null,
      source_url: track.url || '',
      source: 'shazam',
      external_id: track.key,
      cover_url: track.share?.image || track.images?.coverart || '',
      genre: track.genres?.primary || '',
      preview_url: track.hub?.actions?.[1]?.uri || '',
    }
  }
}

/**
 * Buscar artistas
 *
 * NOT USED by ShazamSearch.jsx currently, and NOT verified against v2 (see
 * getSongDetails note above) — still on the old v1 path/shape.
 *
 * @param {string} query - Nombre del artista
 * @param {number} limit - Límite de resultados
 * @returns {Promise<Array>} Artistas encontrados
 */
export async function searchArtists(query, { limit = 10 } = {}) {
  if (!query?.trim()) return []

  const data = await shazamFetch('/search', {
    term: query,
    locale: 'en-US',
    limit: Math.min(limit, 50),
  })

  const artists = data?.artists?.hits || []
  return artists.map(hit => ({
    id: hit.artist?.adamid,
    name: hit.artist?.name || hit.heading?.name || '',
    avatar: hit.artist?.avatar || hit.heading?.avatar || '',
    url: hit.artist?.url || '',
  }))
}

/**
 * Autocompletar sugerencias mientras escribe
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

    return data?.results?.terms || []
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
    type: 'original', // Asumimos original por defecto
    availability: 'wishlist', // Default a wishlist
    source_url: shazamResult.normalized.source_url,
    source: 'shazam',
    external_id: shazamResult.normalized.external_id,
    cover_url: shazamResult.normalized.cover_url,
    genre: shazamResult.normalized.genre,
    mood: null, // Sin mood por defecto
    comment: `Imported from Shazam: ${shazamResult.shazamUrl}`,
  }
}
