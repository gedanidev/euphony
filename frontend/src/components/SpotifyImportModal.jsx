import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { importSpotifyPlaylist } from '../api/playlists'

function extractPlaylistId(url) {
  // Supports: https://open.spotify.com/playlist/XXXX?...
  //           spotify:playlist:XXXX
  const match = url.match(/playlist[/:]([a-zA-Z0-9]{22})/)
  return match ? match[1] : null
}

export default function SpotifyImportModal({ onClose, onImported }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('url') // 'url' | 'manual'
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [manualText, setManualText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const fetchSpotifyTracks = useCallback(async (playlistId, accessToken) => {
    const tracks = []
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(name,artists(name),album(name),id)),next`

    while (nextUrl && tracks.length < 500) {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `Spotify API error: ${res.status}`)
      }
      const data = await res.json()
      for (const item of data.items || []) {
        const track = item.track
        if (!track) continue
        tracks.push({
          title: track.name,
          artist: track.artists?.map(a => a.name).join(', ') || '',
          album: track.album?.name || '',
          spotify_id: track.id,
        })
      }
      nextUrl = data.next
    }
    return tracks
  }, [])

  const parseManualText = useCallback((text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const tracks = []
    for (const line of lines) {
      // Try "Artist - Title" format
      const splitIdx = line.indexOf(' - ')
      if (splitIdx > 0) {
        tracks.push({
          title: line.slice(splitIdx + 3).trim(),
          artist: line.slice(0, splitIdx).trim(),
          album: '',
          spotify_id: null,
        })
      } else {
        // Fallback: treat whole line as title, unknown artist
        tracks.push({
          title: line,
          artist: '',
          album: '',
          spotify_id: null,
        })
      }
    }
    return tracks
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let tracks = []
      let playlistName = 'Imported from Spotify'

      if (mode === 'url') {
        const playlistId = extractPlaylistId(url)
        if (!playlistId) {
          throw new Error('Invalid Spotify playlist URL')
        }
        if (!token.trim()) {
          throw new Error('Access token is required. Get one at https://developer.spotify.com/documentation/web-api/concepts/access-token')
        }

        // Fetch playlist metadata for name
        const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (metaRes.ok) {
          const meta = await metaRes.json()
          playlistName = meta.name || playlistName
        }

        tracks = await fetchSpotifyTracks(playlistId, token)
      } else {
        tracks = parseManualText(manualText)
        playlistName = 'Imported Playlist'
      }

      if (!tracks.length) {
        throw new Error('No tracks found')
      }

      const importResult = await importSpotifyPlaylist({
        playlist_name: playlistName,
        tracks,
      })

      setResult(importResult)
      if (onImported) onImported(importResult)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#2e2e4a] flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import from Spotify</h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode tabs */}
        {!result && (
          <div className="flex gap-2 px-5 pt-4">
            <button
              onClick={() => setMode('url')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'url' ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'
              }`}
            >
              From URL
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'manual' ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'
              }`}
            >
              Paste List
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'url' ? (
                <>
                  <div>
                    <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">
                      Spotify Playlist URL
                    </label>
                    <input
                      type="text"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://open.spotify.com/playlist/..."
                      className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-[#94a3b8] mt-1">
                      Paste a public or private playlist link
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">
                      Access Token
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      placeholder="Bearer token from Spotify Developer"
                      className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-[#94a3b8] mt-1">
                      Get a temporary token at{' '}
                      <a
                        href="https://developer.spotify.com/documentation/web-api/concepts/access-token"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 underline"
                      >
                        Spotify Developer
                      </a>
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">
                    Track List
                  </label>
                  <textarea
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    placeholder={`Artist - Song Title\nAnother Artist - Another Song\n...`}
                    rows={12}
                    className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500 resize-none"
                  />
                  <p className="text-xs text-[#94a3b8] mt-1">
                    One track per line in "Artist - Title" format
                  </p>
                </div>
              )}

              {error && (
                <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <h3 className="text-green-400 font-medium mb-2">✓ Playlist imported</h3>
                <div className="text-sm text-[#e2e8f0] space-y-1">
                  <p><span className="text-[#94a3b8]">Name:</span> {result.playlist_name}</p>
                  <p><span className="text-[#94a3b8]">Total tracks:</span> {result.total}</p>
                  <p><span className="text-[#94a3b8]">Matched locally:</span> {result.matched}</p>
                  <p><span className="text-[#94a3b8]">Not found:</span> {result.unresolved}</p>
                </div>
              </div>

              {result.unmatched_tracks?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-[#94a3b8] mb-2">
                    Unmatched tracks ({result.unmatched_tracks.length}):
                  </h4>
                  <div className="bg-[#0f0f13] border border-[#2e2e4a] rounded-lg p-3 max-h-40 overflow-y-auto">
                    <ul className="text-sm text-[#e2e8f0] space-y-1">
                      {result.unmatched_tracks.map((track, i) => (
                        <li key={i} className="text-red-400/70">
                          {track.artist} - {track.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#2e2e4a] flex justify-end gap-3">
          {result ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || (mode === 'url' ? !url.trim() : !manualText.trim())}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Importing…' : `Import ${mode === 'url' ? 'from Spotify' : 'Tracks'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
