import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { searchSongs, extractSongData } from '../services/shazam'
import { createSong } from '../api/songs'
import { getArtists, createArtist } from '../api/artists'

export default function ShazamSearch({ onSongAdded, onClose, library = [] }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(new Set())
  const [added, setAdded] = useState(new Set())
  const [confirmSong, setConfirmSong] = useState(null)
  const debounceRef = useRef(null)

  // Build a quick lookup of existing songs by title+artist
  const existingLookup = useRef(new Set())
  useEffect(() => {
    const set = new Set()
    library.forEach(s => {
      const key = `${(s.title || '').toLowerCase().trim()}|${(s.artist_name || '').toLowerCase().trim()}`
      set.add(key)
    })
    existingLookup.current = set
  }, [library])

  const isInLibrary = useCallback((song) => {
    const key = `${(song.title || '').toLowerCase().trim()}|${(song.artist || '').toLowerCase().trim()}`
    return existingLookup.current.has(key)
  }, [])

  /**
   * Resolve artist ID by name - search existing or create new
   * @param {string} artistName - Name of the artist
   * @returns {Promise<string>} Artist UUID
   */
  const resolveArtistId = useCallback(async (artistName) => {
    if (!artistName?.trim()) {
      throw new Error('Artist name is required')
    }

    // Search for existing artist
    const response = await getArtists({ search: artistName.trim() })
    const artists = response.items || []

    // Look for exact or close match
    const normalizedName = artistName.toLowerCase().trim()
    const match = artists.find(a =>
      a.name?.toLowerCase().trim() === normalizedName
    )

    if (match) {
      return match.id
    }

    // Create new artist if not found
    const newArtist = await createArtist({ name: artistName.trim() })
    return newArtist.id
  }, [])

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

  const handleConfirmAdd = useCallback(async () => {
    if (!confirmSong) return
    const song = confirmSong
    setConfirmSong(null)

    const id = song.id
    if (adding.has(id) || added.has(id)) return

    setAdding(prev => new Set(prev).add(id))

    try {
      // Resolve artist ID first (required by API)
      const artistId = await resolveArtistId(song.artist)

      const songData = extractSongData(song)
      const payload = {
        ...songData,
        availability: 'wishlist',
        artist_ids: [artistId], // Required field
      }

      const created = await createSong(payload)
      setAdded(prev => new Set(prev).add(id))
      onSongAdded?.(created)
    } catch (e) {
      alert(`${t('shazam.addError')}: ${e.message}`)
    } finally {
      setAdding(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [confirmSong, adding, added, onSongAdded, t, resolveArtistId])

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const min = Math.floor(seconds / 60)
    const sec = String(seconds % 60).padStart(2, '0')
    return `${min}:${sec}`
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#2e2e4a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-[#e2e8f0]">{t('shazam.searchTitle')}</h2>
              <p className="text-xs text-[#94a3b8]">{t('shazam.searchPlaceholder')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#94a3b8] hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            aria-label={t('actions.close')}
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
              placeholder={t('shazam.searchPlaceholder')}
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
                  {t('shazam.apiNotConfigured')}
                </p>
              )}
            </div>
          ) : !query.trim() ? (
            <div className="p-8 text-center text-[#94a3b8]">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p>{t('shazam.searchPlaceholder')}</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-8 text-center text-[#94a3b8]">
              <p>{t('shazam.noResults')}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2e2e4a]">
              {results.map(song => {
                const isAddingSong = adding.has(song.id)
                const isAddedSong = added.has(song.id)
                const inLibrary = isInLibrary(song)

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
                      {isAddedSong ? (
                        <span className="flex items-center gap-1 px-3 py-2 text-sm text-green-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('shazam.addedSuccess')}
                        </span>
                      ) : inLibrary ? (
                        <span className="flex items-center gap-1 px-3 py-2 text-sm text-[#64748b]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('shazam.alreadyInLibrary')}
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmSong(song)}
                          disabled={isAddingSong}
                          className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {isAddingSong ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              {t('common.saving')}
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              {t('shazam.addToWishlist')}
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
          Shazam via RapidAPI
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmSong && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-[#e2e8f0] mb-2">
              {t('shazam.addConfirmTitle')}
            </h3>
            <p className="text-[#94a3b8] mb-6">
              {t('shazam.addConfirmDesc', { title: confirmSong.title, artist: confirmSong.artist })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmSong(null)}
                className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmAdd}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {t('shazam.addToWishlist')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
