import { useState, useCallback } from 'react'
import { importSpotifyPlaylist, importSpotifyCsv } from '../api/playlists'

// Spotify blocks reading playlist track contents via its API for personal/
// development-mode apps (same restriction category that killed artist
// genres earlier) — confirmed with a 403 regardless of playlist ownership,
// visibility, or query params. Until/unless Extended Quota Mode is granted
// for this app, these two paths (paste text, or upload a CSV from a
// third-party exporter like Exportify) are what actually work.
export default function SpotifyImportModal({ onClose, onImported }) {
  const [mode, setMode] = useState('paste') // 'paste' | 'csv'
  const [manualText, setManualText] = useState('')
  const [csvFile, setCsvFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

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
      let importResult
      if (mode === 'csv') {
        if (!csvFile) throw new Error('Choose a CSV file first')
        importResult = await importSpotifyCsv(csvFile)
      } else {
        const tracks = parseManualText(manualText)
        if (!tracks.length) {
          throw new Error('No tracks found')
        }
        importResult = await importSpotifyPlaylist({
          playlist_name: 'Imported Playlist',
          tracks,
        })
      }

      setResult(importResult)
      if (onImported) onImported(importResult)
    } catch (e) {
      const detail = e.response?.data?.detail
      setError(detail || e.message)
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
          <h2 className="text-lg font-semibold">Import Playlist</h2>
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
              onClick={() => setMode('csv')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'csv' ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'
              }`}
            >
              Upload CSV
            </button>
            <button
              onClick={() => setMode('paste')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'paste' ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'
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
              {mode === 'csv' ? (
                <div>
                  <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">
                    Playlist CSV
                  </label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={e => setCsvFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-[#e2e8f0] file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:text-sm file:font-medium hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
                  />
                  <p className="text-xs text-[#94a3b8] mt-2">
                    Export a playlist from a tool like Exportify (Spotify doesn't let personal apps read playlist tracks directly), then upload the CSV here.
                  </p>
                </div>
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
                    One track per line in "Artist - Title" format.
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
                disabled={loading || (mode === 'csv' ? !csvFile : !manualText.trim())}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Importing…' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
