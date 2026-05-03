import { useState, useEffect } from 'react'
import { getSongs, createSong, updateSong, deleteSong } from '../api/songs'
import { getPlaylists, addSongsToPlaylist } from '../api/playlists'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'

function fmt(seconds) {
  if (!seconds) return '--:--'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const EMPTY = { title: '', artist_display: '', album: '', duration: '', year: '', version_type: '' }

function SongModal({ initial, onClose, onSaved }) {
  const [form, setForm]   = useState(initial || EMPTY)
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial?.id

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        duration: form.duration ? parseInt(form.duration) : null,
        year:     form.year     ? parseInt(form.year)     : null,
        album:        form.album        || null,
        version_type: form.version_type || null,
      }
      if (isEdit) {
        await updateSong(initial.id, payload)
      } else {
        await createSong(payload)
      }
      onSaved()
    } catch { alert('Error saving song') }
    finally { setSaving(false) }
  }

  const field = (label, key, opts = {}) => (
    <div>
      <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">{label}</label>
      <input
        {...opts}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{isEdit ? 'Edit Song' : 'Add Song'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">{field('Title *', 'title', { required: true, autoFocus: true, placeholder: 'Song title' })}</div>
            <div className="col-span-2">{field('Artist *', 'artist_display', { required: true, placeholder: 'Artist name' })}</div>
            {field('Album', 'album', { placeholder: 'Album name' })}
            {field('Year', 'year', { type: 'number', min: 1900, max: 2099, placeholder: '2024' })}
            {field('Duration (seconds)', 'duration', { type: 'number', min: 0, placeholder: '240' })}
            {field('Version Type', 'version_type', { placeholder: 'live, remix, acoustic…' })}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add Song'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddToPlaylistModal({ songId, onClose }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading]     = useState(true)
  const [done, setDone]           = useState(null)

  useEffect(() => {
    getPlaylists({ limit: 100 }).then(d => { setPlaylists(d.items); setLoading(false) })
  }, [])

  const pick = async (pl) => {
    await addSongsToPlaylist(pl.id, [songId])
    setDone(pl.name)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold mb-4">Add to Playlist</h2>
        {done ? (
          <div className="text-center py-4">
            <p className="text-purple-400 font-medium">Added to "{done}"</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-[#22223a] hover:bg-[#2e2e4a] text-white rounded-lg text-sm transition-colors">Close</button>
          </div>
        ) : loading ? <LoadingSpinner size="sm" /> : playlists.length === 0 ? (
          <p className="text-[#94a3b8] text-sm">No playlists yet. Create one first.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {playlists.map(pl => (
              <button
                key={pl.id}
                onClick={() => pick(pl)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#22223a] text-sm transition-colors flex items-center justify-between"
              >
                <span className="font-medium">{pl.name}</span>
                <span className="text-[#94a3b8] text-xs">{pl.song_count} songs</span>
              </button>
            ))}
          </div>
        )}
        {!done && (
          <button onClick={onClose} className="mt-4 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancel</button>
        )}
      </div>
    </div>
  )
}

export default function Library() {
  const [songs, setSongs]     = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const limit = 50

  const [songModal, setSongModal]         = useState(null)   // null | { mode: 'create' | 'edit', song? }
  const [addToPlaylist, setAddToPlaylist] = useState(null)   // song id

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getSongs({ search, page, limit })
      setSongs(data.items); setTotal(data.total)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, page])
  useEffect(() => { setPage(1) }, [search])

  const handleDelete = async (id) => {
    if (!confirm('Delete this song?')) return
    await deleteSong(id)
    load()
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Library</h1>
        <button
          onClick={() => setSongModal({ mode: 'create' })}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Song
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by title, artist or album…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
        />
        {total > 0 && <span className="text-[#94a3b8] text-sm">{total} songs</span>}
      </div>

      {loading && <LoadingSpinner />}
      {error   && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && songs.length === 0 && (
        <EmptyState
          title="No songs yet"
          description="Add your first song to the library"
          action={
            <button onClick={() => setSongModal({ mode: 'create' })} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
              Add Song
            </button>
          }
        />
      )}

      {!loading && !error && songs.length > 0 && (
        <>
          <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2e2e4a] text-[#94a3b8] text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Artist</th>
                  <th className="px-4 py-3">Album</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Duration</th>
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {songs.map(song => (
                  <tr key={song.id} className="border-b border-[#2e2e4a] hover:bg-[#22223a]/40 group text-sm">
                    <td className="px-4 py-2 font-medium text-[#e2e8f0]">{song.title}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.artist_display}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.album || '—'}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.year || '—'}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.version_type || '—'}</td>
                    <td className="px-4 py-2 text-[#94a3b8] text-right tabular-nums">{fmt(song.duration)}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all justify-end">
                        <button
                          onClick={() => setAddToPlaylist(song.id)}
                          className="text-purple-400/70 hover:text-purple-400 text-xs font-medium transition-colors"
                          title="Add to playlist"
                        >
                          + Playlist
                        </button>
                        <button
                          onClick={() => setSongModal({ mode: 'edit', song })}
                          className="text-[#94a3b8] hover:text-white transition-colors"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(song.id)}
                          className="text-red-400/50 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded text-sm disabled:opacity-40 text-[#94a3b8] hover:text-white disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-[#94a3b8] text-sm">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded text-sm disabled:opacity-40 text-[#94a3b8] hover:text-white disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {songModal && (
        <SongModal
          initial={songModal.mode === 'edit' ? { ...songModal.song, duration: songModal.song.duration?.toString() || '', year: songModal.song.year?.toString() || '' } : null}
          onClose={() => setSongModal(null)}
          onSaved={() => { setSongModal(null); load() }}
        />
      )}

      {addToPlaylist && (
        <AddToPlaylistModal
          songId={addToPlaylist}
          onClose={() => setAddToPlaylist(null)}
        />
      )}
    </div>
  )
}
