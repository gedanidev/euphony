import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlaylists, createPlaylist, deletePlaylist } from '../api/playlists'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'

function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const pl = await createPlaylist(form)
      onCreate(pl)
    } catch {
      alert('Error creating playlist')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New Playlist</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Name *</label>
            <input
              autoFocus
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
              placeholder="My Playlist"
            />
          </div>
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
              placeholder="Optional description"
            />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Playlists() {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getPlaylists({ search, limit: 100 })
      setPlaylists(data.items)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this playlist?')) return
    await deletePlaylist(id)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Playlists</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Playlist
        </button>
      </div>

      <input
        type="text"
        placeholder="Search playlists…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm mb-6 px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
      />

      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && playlists.length === 0 && (
        <EmptyState
          title="No playlists yet"
          description="Create your first playlist to get started"
          action={
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
              Create Playlist
            </button>
          }
        />
      )}

      {!loading && !error && playlists.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {playlists.map(pl => (
            <div
              key={pl.id}
              onClick={() => navigate(`/playlists/${pl.id}`)}
              className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-4 cursor-pointer hover:border-purple-500/50 hover:bg-[#22223a] transition-all group"
            >
              <div className="w-full aspect-square rounded-lg bg-purple-700/20 flex items-center justify-center mb-3">
                <svg className="w-10 h-10 text-purple-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <p className="font-medium text-sm truncate">{pl.name}</p>
              <p className="text-[#94a3b8] text-xs mt-0.5">{pl.song_count} {pl.song_count === 1 ? 'song' : 'songs'}</p>
              {pl.description && <p className="text-[#94a3b8] text-xs mt-1 truncate">{pl.description}</p>}
              <button
                onClick={e => handleDelete(e, pl.id)}
                className="mt-2 text-xs text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(pl) => navigate(`/playlists/${pl.id}`)}
        />
      )}
    </div>
  )
}
