import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getAlbums, createAlbum, deleteAlbum } from '../api/albums'
import { getArtists } from '../api/artists'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'

function CreateAlbumModal({ onClose, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ title: '', year: '', artist_id: '' })
  const [artists, setArtists] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getArtists({ limit: 200 }).then(d => setArtists(d.items)).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createAlbum({
        title: form.title,
        year: form.year ? parseInt(form.year) : null,
        artist_id: form.artist_id || null,
      })
      onSaved()
    } catch { alert('Error creando álbum') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{t('albums.new')}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">{t('library.col.title')} *</label>
            <input
              autoFocus required
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Nombre del álbum"
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">{t('library.col.artist')}</label>
            <select
              value={form.artist_id}
              onChange={e => set('artist_id', e.target.value)}
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
            >
              <option value="">— Sin artista —</option>
              {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">{t('library.col.year')}</label>
            <input
              type="number" min={1900} max={2099}
              value={form.year}
              onChange={e => set('year', e.target.value)}
              placeholder="2024"
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">{t('common.cancel')}</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? t('common.saving') : t('albums.new')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Albums() {
  const { t } = useTranslation()
  const [albums, setAlbums] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const limit = 48

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getAlbums({ search: search || undefined, page, limit })
      setAlbums(data.items); setTotal(data.total)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, page])
  useEffect(() => { setPage(1) }, [search])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar este álbum?')) return
    await deleteAlbum(id)
    load()
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('albums.title')}</h1>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('albums.new')}
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <input type="text" placeholder={t('albums.search')} value={search} onChange={e => setSearch(e.target.value)}
          className="w-64 px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500" />
        {total > 0 && <span className="text-[#94a3b8] text-sm">{total} {t('albums.count')}</span>}
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && albums.length === 0 && (
        <EmptyState title={t('albums.empty.title')} description={t('albums.empty.desc')}
          action={<button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">{t('albums.new')}</button>} />
      )}

      {!loading && !error && albums.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {albums.map(album => (
              <div key={album.id}
                className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-4 hover:border-purple-500/50 hover:bg-[#22223a] transition-all group relative">
                <div className="w-full aspect-square rounded-lg bg-[#22223a] mb-3 flex items-center justify-center overflow-hidden">
                  {album.cover_url ? (
                    <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-10 h-10 text-[#2e2e4a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  )}
                </div>
                <p className="font-medium text-sm text-[#e2e8f0] truncate">{album.title}</p>
                {album.artist && <p className="text-xs text-[#94a3b8] truncate mt-0.5">{album.artist.name}</p>}
                {album.year && <p className="text-xs text-[#94a3b8] mt-0.5">{album.year}</p>}
                <button onClick={(e) => handleDelete(e, album.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded text-sm disabled:opacity-40 text-[#94a3b8] hover:text-white transition-colors">{t('common.prev')}</button>
              <span className="text-[#94a3b8] text-sm">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded text-sm disabled:opacity-40 text-[#94a3b8] hover:text-white transition-colors">{t('common.next')}</button>
            </div>
          )}
        </>
      )}

      {showCreate && <CreateAlbumModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />}
    </div>
  )
}
