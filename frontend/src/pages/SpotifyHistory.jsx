import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSpotifyHistory, syncSpotify, getSpotifyStatus, addToLibrary } from '../api/auth'

function PlayCountBadge({ count, plays, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 bg-[#22223a] hover:bg-[#2e2e4a] rounded text-xs text-[#94a3b8] transition-colors"
      title="Ver reproducciones"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {count}
    </button>
  )
}

function PlaysModal({ track, onClose }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-sm">{track.track_title}</p>
            <p className="text-xs text-[#94a3b8]">{track.artist_name}</p>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {track.plays.map((play, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#22223a] last:border-0">
              <span className="text-xs text-[#e2e8f0]">
                {new Date(play.played_at).toLocaleString()}
              </span>
              <span className="text-xs text-[#94a3b8] capitalize">{play.source}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TrackRow({ track, onAction }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(null)
  const [showPlays, setShowPlays] = useState(false)

  const handleAdd = async (availability) => {
    setLoading(availability)
    try {
      await onAction(track.spotify_track_id, availability)
    } finally {
      setLoading(null)
    }
  }

  const availabilityBadge = {
    available: <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">{t('spotify.inLibrary')}</span>,
    wishlist: <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">{t('spotify.inWishlist')}</span>,
    not_available: <span className="px-2 py-0.5 bg-[#22223a] text-[#94a3b8] text-xs rounded">{t('spotify.notAvailable')}</span>,
  }

  return (
    <>
      <div className="flex items-center gap-3 py-3 border-b border-[#22223a] last:border-0">
        {/* Cover */}
        <div className="w-10 h-10 flex-shrink-0 rounded bg-[#22223a] overflow-hidden">
          {track.cover_url
            ? <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-[#94a3b8]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                </svg>
              </div>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{track.track_title}</p>
          <p className="text-xs text-[#94a3b8] truncate">{track.artist_name}{track.album_name ? ` · ${track.album_name}` : ''}</p>
        </div>

        {/* Play count */}
        <PlayCountBadge count={track.play_count} plays={track.plays} onClick={() => setShowPlays(true)} />

        {/* Status / Actions */}
        <div className="flex-shrink-0">
          {track.availability ? (
            availabilityBadge[track.availability] || null
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={() => handleAdd('available')}
                disabled={!!loading}
                className="px-2.5 py-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs rounded transition-colors disabled:opacity-50"
              >
                {loading === 'available' ? '…' : t('spotify.iHaveIt')}
              </button>
              <button
                onClick={() => handleAdd('wishlist')}
                disabled={!!loading}
                className="px-2.5 py-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 text-xs rounded transition-colors disabled:opacity-50"
              >
                {loading === 'wishlist' ? '…' : t('spotify.addWishlist')}
              </button>
            </div>
          )}
        </div>
      </div>

      {showPlays && <PlaysModal track={track} onClose={() => setShowPlays(false)} />}
    </>
  )
}

export default function SpotifyHistory() {
  const { t } = useTranslation()
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      await getSpotifyStatus()
      setConnected(true)
      const data = await getSpotifyHistory()
      setTracks(data)
    } catch (e) {
      if (e.response?.status === 404) {
        setConnected(false)
      } else {
        setError(t('common.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncSpotify()
      setSyncResult(result)
      const data = await getSpotifyHistory()
      setTracks(data)
    } catch (e) {
      alert(e.response?.data?.detail || t('settings.spotify.syncError'))
    } finally {
      setSyncing(false)
    }
  }

  async function handleAction(spotifyTrackId, availability) {
    await addToLibrary(spotifyTrackId, availability)
    setTracks(prev => prev.map(t =>
      t.spotify_track_id === spotifyTrackId ? { ...t, availability } : t
    ))
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('spotify.title')}</h1>
        {connected && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-[#1DB954] hover:bg-[#1aa34a] disabled:opacity-50 text-black font-medium rounded-lg text-sm transition-colors"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? t('settings.spotify.syncing') : t('settings.spotify.sync')}
          </button>
        )}
      </div>

      {syncResult && (
        <div className="mb-4 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg px-4 py-3 text-sm">
          <p className="text-green-400">{t('settings.spotify.syncDone')}</p>
          <p className="text-[#94a3b8] text-xs mt-0.5">
            {t('spotify.syncStats', { added: syncResult.history_entries_added, skipped: syncResult.history_entries_skipped })}
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 bg-[#1a1a24] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !connected ? (
        <div className="text-center py-16 text-[#94a3b8]">
          <p className="text-lg mb-2">{t('spotify.notConnected')}</p>
          <p className="text-sm">
            {t('spotify.goToSettings')}
          </p>
        </div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : tracks.length === 0 ? (
        <div className="text-center py-16 text-[#94a3b8]">
          <p className="text-lg mb-2">{t('spotify.empty')}</p>
          <p className="text-sm">{t('spotify.emptyDesc')}</p>
        </div>
      ) : (
        <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl px-4">
          <p className="text-xs text-[#94a3b8] py-3 border-b border-[#22223a]">
            {tracks.length} {t('spotify.tracks')}
          </p>
          {tracks.map((track, i) => (
            <TrackRow
              key={track.spotify_track_id || i}
              track={track}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}
