import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getPlaylists, createPlaylist, deletePlaylist } from '../api/playlists'
import { getSmartPlaylists, deleteSmartPlaylist, exportSmartPlaylistM3U } from '../api/smart_playlists'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import SmartPlaylistBuilder from '../components/SmartPlaylistBuilder'

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

function SmartTab() {
  const [smartPlaylists, setSmartPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editing, setEditing] = useState(null)
  const { t } = useTranslation()

  const load = async () => {
    try {
      setLoading(true); setError(null)
      setSmartPlaylists(await getSmartPlaylists())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm(t('smartPlaylist.deleteConfirm'))) return
    try {
      await deleteSmartPlaylist(id)
      load()
    } catch {
      alert(t('smartPlaylist.deleteError'))
    }
  }

  const handleExport = async (e, id, name) => {
    e.stopPropagation()
    try {
      await exportSmartPlaylistM3U(id, name)
    } catch {
      alert(t('smartPlaylist.exportError'))
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { setEditing(null); setShowBuilder(true) }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('smartPlaylist.new')}
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && smartPlaylists.length === 0 && (
        <EmptyState
          title={t('smartPlaylist.empty.title')}
          description={t('smartPlaylist.empty.desc')}
          action={
            <button onClick={() => setShowBuilder(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
              {t('smartPlaylist.new')}
            </button>
          }
        />
      )}

      {!loading && !error && smartPlaylists.length > 0 && (
        <div className="space-y-2">
          {smartPlaylists.map(pl => (
            <div key={pl.id} className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl px-4 py-3 flex items-center justify-between hover:border-purple-500/30 transition-colors">
              <div>
                <p className="font-medium text-sm text-[#e2e8f0]">{pl.name}</p>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  {pl.conditions.length} {t('smartPlaylist.conditionCount')} · {pl.match_all ? t('smartPlaylist.matchAll') : t('smartPlaylist.matchAny')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => handleExport(e, pl.id, pl.name)}
                  className="px-3 py-1.5 text-xs bg-[#1e1e30] hover:bg-[#2e2e4a] text-[#94a3b8] hover:text-white rounded-lg transition-colors"
                >
                  M3U ↓
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setEditing(pl); setShowBuilder(true) }}
                  className="px-3 py-1.5 text-xs bg-[#1e1e30] hover:bg-[#2e2e4a] text-[#94a3b8] hover:text-white rounded-lg transition-colors"
                >
                  {t('common.edit')}
                </button>
                <button
                  onClick={e => handleDelete(e, pl.id)}
                  className="px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <SmartPlaylistBuilder
          existing={editing}
          onClose={() => { setShowBuilder(false); setEditing(null) }}
          onSaved={() => { setShowBuilder(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

export default function Playlists() {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab]             = useState('normal')
  const navigate = useNavigate()
  const { t } = useTranslation()

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
        <h1 className="text-2xl font-bold">{t('playlists.title')}</h1>
        {tab === 'normal' && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('playlists.new')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('normal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'normal' ? 'bg-purple-600 text-white' : 'bg-[#1a1a24] text-[#94a3b8] hover:text-white hover:bg-[#22223a]'}`}
        >
          {t('playlists.tab.normal')}
        </button>
        <button
          onClick={() => setTab('smart')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'smart' ? 'bg-purple-600 text-white' : 'bg-[#1a1a24] text-[#94a3b8] hover:text-white hover:bg-[#22223a]'}`}
        >
          {t('smartPlaylist.tab')}
        </button>
      </div>

      {tab === 'smart' ? (
        <SmartTab />
      ) : (
        <>
          <input
            type="text"
            placeholder={t('playlists.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm mb-6 px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
          />

          {loading && <LoadingSpinner />}
          {error && <ErrorState message={error} onRetry={load} />}

          {!loading && !error && playlists.length === 0 && (
            <EmptyState
              title={t('playlists.empty.title')}
              description={t('playlists.empty.desc')}
              action={
                <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
                  {t('playlists.new')}
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
                  <p className="text-[#94a3b8] text-xs mt-0.5">{pl.song_count} {t('common.songs')}</p>
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
        </>
      )}
    </div>
  )
}
