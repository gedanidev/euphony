import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getArtists, createArtist, deleteArtist } from '../api/artists'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'

function CreateArtistModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', country: '', region: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createArtist({ ...form, bio: form.bio || null, country: form.country || null, region: form.region || null })
      onSaved()
    } catch { alert('Error creando artista') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Nuevo Artista</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {field('Nombre *', 'name', { required: true, autoFocus: true, placeholder: 'Nombre del artista o banda' })}
          <div className="grid grid-cols-2 gap-3">
            {field('País', 'country', { placeholder: 'Colombia' })}
            {field('Región / Ciudad', 'region', { placeholder: 'Medellín' })}
          </div>
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Biografía</label>
            <textarea
              value={form.bio}
              onChange={e => set('bio', e.target.value)}
              rows={3}
              placeholder="Descripción del artista…"
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Guardando…' : 'Crear Artista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Artists() {
  const [artists, setArtists] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const limit = 48
  const navigate = useNavigate()
  const { t } = useTranslation()

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getArtists({ search: search || undefined, page, limit })
      setArtists(data.items); setTotal(data.total)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, page])
  useEffect(() => { setPage(1) }, [search])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar este artista? Se eliminarán sus créditos en canciones.')) return
    await deleteArtist(id)
    load()
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('artists.title')}</h1>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('artists.new')}
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <input type="text" placeholder={t('artists.search')} value={search} onChange={e => setSearch(e.target.value)}
          className="w-64 px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500" />
        {total > 0 && <span className="text-[#94a3b8] text-sm">{total} {t('artists.count')}</span>}
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && artists.length === 0 && (
        <EmptyState title={t('artists.empty.title')} description={t('artists.empty.desc')}
          action={<button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">{t('artists.new')}</button>} />
      )}

      {!loading && !error && artists.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artists.map(artist => (
              <div key={artist.id} onClick={() => navigate(`/artists/${artist.id}`)}
                className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-4 cursor-pointer hover:border-purple-500/50 hover:bg-[#22223a] transition-all group relative">
                {/* Avatar */}
                <div className="w-full aspect-square rounded-lg bg-[#22223a] mb-3 flex items-center justify-center overflow-hidden">
                  {artist.image_url ? (
                    <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-10 h-10 text-[#2e2e4a]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  )}
                </div>
                <p className="font-medium text-sm text-[#e2e8f0] truncate">{artist.name}</p>
                {artist.country && <p className="text-xs text-[#94a3b8] truncate mt-0.5">{artist.country}</p>}
                <button onClick={(e) => handleDelete(e, artist.id)}
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

      {showCreate && <CreateArtistModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />}
    </div>
  )
}
