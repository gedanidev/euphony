import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [albums, setAlbums] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('albums-view') || 'grid')
  const [letter, setLetter] = useState(null)
  const limit = 48
  const [page, setPageState] = useState(() => parseInt(sessionStorage.getItem('albums-page') || '1', 10))
  const setPage = (v) => setPageState(prev => {
    const next = typeof v === 'function' ? v(prev) : v
    sessionStorage.setItem('albums-page', String(next))
    return next
  })

  const filtersReady = useRef(false)
  const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getAlbums({ search: search || undefined, letter: letter || undefined, page, limit })
      setAlbums(data.items); setTotal(data.total)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!filtersReady.current) { filtersReady.current = true; return }
    setPage(1)
  }, [search, letter])

  useEffect(() => { load() }, [search, letter, page])

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
        <input type="text" placeholder={t('albums.search')} value={search} onChange={e => { setSearch(e.target.value); setLetter(null) }}
          className="w-64 px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500" />
        {total > 0 && <span className="text-[#94a3b8] text-sm">{total} {t('albums.count')}</span>}
        <div className="ml-auto flex items-center gap-1 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg p-1">
          <button onClick={() => { setViewMode('grid'); localStorage.setItem('albums-view', 'grid') }}
            className={`px-2.5 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'grid' ? 'bg-[#22223a] text-white' : 'text-[#94a3b8] hover:text-white'}`}
            title="Vista en cuadrícula">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h7v7H3zm0 11h7v7H3zm11-11h7v7h-7zm0 11h7v7h-7z"/>
            </svg>
          </button>
          <button onClick={() => { setViewMode('list'); localStorage.setItem('albums-view', 'list') }}
            className={`px-2.5 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'list' ? 'bg-[#22223a] text-white' : 'text-[#94a3b8] hover:text-white'}`}
            title="Vista en lista">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {LETTERS.map(l => (
          <button
            key={l}
            onClick={() => { setLetter(letter === l ? null : l); setSearch('') }}
            className={`flex-shrink-0 w-8 h-8 rounded-md text-xs font-medium transition-colors ${
              letter === l
                ? 'bg-purple-600 text-white'
                : 'bg-[#1a1a24] border border-[#2e2e4a] text-[#94a3b8] hover:border-purple-500/50 hover:text-white'
            }`}
          >{l}</button>
        ))}
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && albums.length === 0 && (
        <EmptyState title={t('albums.empty.title')} description={t('albums.empty.desc')}
          action={<button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">{t('albums.new')}</button>} />
      )}

      {!loading && !error && albums.length > 0 && (
        <>
          {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {albums.map(album => (
              <div key={album.id}
                onClick={() => navigate(`/albums/${album.id}`)}
                className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-4 hover:border-purple-500/50 hover:bg-[#22223a] transition-all group relative cursor-pointer">
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
                <button onClick={(e) => { e.stopPropagation(); handleDelete(e, album.id) }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          ) : (
          <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-hidden">
            {albums.map((album, idx) => (
              <div key={album.id}
                onClick={() => navigate(`/albums/${album.id}`)}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-[#22223a]/60 transition-colors cursor-pointer group relative ${idx < albums.length - 1 ? 'border-b border-[#2e2e4a]' : ''}`}>
                <div className="w-12 h-12 rounded-lg bg-[#22223a] flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {album.cover_url ? (
                    <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-[#2e2e4a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-[#e2e8f0] truncate">{album.title}</p>
                  <div className="flex items-center gap-2 text-xs text-[#94a3b8] mt-0.5">
                    {album.artist && <span className="truncate">{album.artist.name}</span>}
                    {album.artist && album.year && <span>·</span>}
                    {album.year && <span>{album.year}</span>}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(e, album.id) }}
                  className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded text-sm disabled:opacity-40 text-[#94a3b8] hover:text-white transition-colors">{t('common.prev')}</button>
              <input
                key={page}
                type="number" min={1} max={totalPages} defaultValue={page}
                onBlur={e => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= totalPages) setPage(v) }}
                onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= totalPages) { setPage(v); e.target.blur() } } }}
                className="w-14 text-center bg-[#1a1a24] border border-[#2e2e4a] rounded-lg py-1 text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[#94a3b8] text-sm">/ {totalPages}</span>
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
