import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { searchSongs, extractSongData } from '../services/shazam'
import { createSong } from '../api/songs'
import { getArtists, createArtist } from '../api/artists'

// The deployed backend requires artist_ids (UUIDs), but Shazam only gives us
// an artist name string — look up an existing artist by that name, or create
// one, and return its id.
async function resolveArtistId(name) {
  const trimmed = name?.trim()
  if (!trimmed) return null

  const { items } = await getArtists({ search: trimmed, limit: 5 })
  const exact = items?.find(a => a.name.toLowerCase() === trimmed.toLowerCase())
  if (exact) return exact.id
  if (items?.length) return items[0].id

  const created = await createArtist({ name: trimmed })
  return created.id
}

export default function ShazamSearch({ onSongAdded, onClose }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(new Set())
  const [added, setAdded] = useState(new Set())
  const debounceRef = useRef(null)

  const search = useCallback(async (term) => {
    if (!term?.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const songs = await searchSongs(term, { limit: 20 })
      setResults(songs)
    } catch (e) {
      setError(e.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (query.trim().length >= 2) {
        search(query)
      } else {
        setResults([])
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  const handleAddToWishlist = useCallback(async (song) => {
    const id = song.id
    if (adding.has(id) || added.has(id)) return

    setAdding(prev => new Set(prev).add(id))

    try {
      const songData = extractSongData(song)
      const artistId = await resolveArtistId(songData.artist_name)
      if (!artistId) throw new Error('Could not resolve an artist for this song')

      const payload = {
        title: songData.title,
        duration: songData.duration,
        year: songData.year,
        availability: 'wishlist',
        primary_genre: songData.genre || null,
        artist_ids: [artistId],
      }
      const created = await createSong(payload)
      setAdded(prev => new Set(prev).add(id))
      onSongAdded?.(created)
    } catch (e) {
      alert(`Error adding to wishlist: ${e.message}`)
    } finally {
      setAdding(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [adding, added, onSongAdded])

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const min = Math.floor(seconds / 60)
    const sec = String(seconds % 60).padStart(2, '0')
    return `${min}:${sec}`
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col modal-content">
        {/* Header */}
        <div className="p-4 border-b border-[#2e2e4a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-[#e2e8f0]">Buscar en Shazam</h2>
              <p className="text-xs text-[#94a3b8]">Encuentra canciones y agrégalas a tu wishlist</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#94a3b8] hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#2e2e4a]">
          <div className="relative">
            <input
              autoFocus
              type="text"
              placeholder="Buscar canciones, artistas, álbumes..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-[#0f0f13] border border-[#2e2e4a] rounded-lg pl-10 pr-4 py-3 text-base text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="p-8 text-center">
              <p className="text-red-400 mb-2">{error}</p>
              {error.includes('API key not configured') && (
                <p className="text-sm text-[#94a3b8]">
                  Configura VITE_SHAZAM_API_KEY en tu archivo .env
                </p>
              )}
            </div>
          ) : !query.trim() ? (
            <div className="p-8 text-center text-[#94a3b8]">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p>Escribe al menos 2 caracteres para buscar</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-8 text-center text-[#94a3b8]">
              <p>No se encontraron canciones</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2e2e4a]">
              {results.map(song => {
                const isAdding = adding.has(song.id)
                const isAdded = added.has(song.id)

                return (
                  <div key={song.id} className="p-4 flex items-center gap-4 hover:bg-[#22223a]/50 transition-colors">
                    {/* Cover */}
                    <div className="flex-shrink-0 w-16 h-16 bg-[#0f0f13] rounded-lg overflow-hidden border border-[#2e2e4a]">
                      {song.cover ? (
                        <img
                          src={song.cover}
                          alt={song.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div className="w-full h-full hidden items-center justify-center bg-[#22223a]">
                        <svg className="w-8 h-8 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[#e2e8f0] truncate">{song.title}</h3>
                      <p className="text-sm text-[#94a3b8] truncate">{song.artist}</p>
                      <div className="flex items-center gap-2 text-xs text-[#64748b] mt-1">
                        {song.album && <span>{song.album}</span>}
                        {song.year && <span>• {song.year}</span>}
                        {song.duration && <span>• {formatDuration(song.duration)}</span>}
                        {song.genre && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                            {song.genre}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0">
                      {isAdded ? (
                        <span className="flex items-center gap-1 px-3 py-2 text-sm text-green-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Agregado
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddToWishlist(song)}
                          disabled={isAdding}
                          className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {isAdding ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Agregando...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              A wishlist
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2e2e4a] text-center text-xs text-[#64748b]">
          Datos proporcionados por Shazam vía RapidAPI
        </div>
      </div>
    </div>
  )
}
