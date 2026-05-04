import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getGenres, createGenre, deleteGenre } from '../api/genres'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorState from '../components/ErrorState'

export default function Genres() {
  const { t } = useTranslation()
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getGenres()
      setGenres(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      await createGenre({ name: newName.trim() })
      setNewName('')
      load()
    } catch { alert('Error creando género') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este género?')) return
    await deleteGenre(id)
    load()
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">{t('genres.title')}</h1>

      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={t('genres.placeholder')}
          className="flex-1 px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
        />
        <button type="submit" disabled={saving || !newName.trim()}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          {saving ? t('common.saving') : t('genres.add')}
        </button>
      </form>

      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && genres.length === 0 && (
        <p className="text-[#94a3b8] text-sm">{t('genres.empty')}</p>
      )}

      {!loading && !error && genres.length > 0 && (
        <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-hidden">
          {genres.map((genre, i) => (
            <div key={genre.id}
              className={`flex items-center justify-between px-4 py-3 hover:bg-[#22223a] transition-colors group ${i > 0 ? 'border-t border-[#2e2e4a]' : ''}`}>
              <span className="text-sm text-[#e2e8f0]">{genre.name}</span>
              <button onClick={() => handleDelete(genre.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
