import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getGenres, createGenre } from '../api/genres'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'

export default function Genres() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState(null)

  const load = useCallback(() => {
    getGenres()
      .then(setGenres)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    setCreateError(null)
    try {
      await createGenre({ name: newName.trim() })
      setNewName('')
      setCreating(false)
      load()
    } catch (e) {
      setCreateError(e.response?.data?.detail || t('genres.createError', 'Error creating genre'))
    } finally {
      setSaving(false)
    }
  }

  const filtered = genres.filter(g => g.genre.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="p-6"><LoadingSpinner /></div>
  if (error) return <div className="p-6"><ErrorState /></div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('genres.title')}</h1>
        <div className="flex items-center gap-4">
          {genres.length > 0 && (
            <span className="text-[#94a3b8] text-sm">{genres.length} {t('genres.count')}</span>
          )}
          <button
            onClick={() => { setCreating(true); setCreateError(null) }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('genres.new', 'Nuevo género')}
          </button>
        </div>
      </div>

      {creating && (
        <div className="mb-6 p-4 bg-[#13131a] border border-[#2e2e4a] rounded-xl flex items-center gap-3">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
            placeholder={t('genres.newPlaceholder', 'Nombre del género…')}
            className="flex-1 px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || saving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button onClick={() => setCreating(false)} className="text-sm text-[#94a3b8] hover:text-white">
            {t('common.cancel')}
          </button>
          {createError && <span className="text-sm text-red-400">{createError}</span>}
        </div>
      )}

      <input
        type="text"
        placeholder={t('genres.search')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-64 mb-6 px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
      />

      {filtered.length === 0 ? (
        <EmptyState title={t('genres.empty')} />
      ) : (
        <div className="border border-[#2e2e4a] rounded-xl overflow-hidden">
          {filtered.map((g, i) => (
            <button
              key={g.genre}
              onClick={() => navigate(`/genres/${encodeURIComponent(g.genre)}`)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1e1e30] transition-colors ${i !== 0 ? 'border-t border-[#2e2e4a]' : ''}`}
            >
              <span className="text-[#e2e8f0] font-medium capitalize">{g.genre}</span>
              <span className="text-[#94a3b8] text-sm tabular-nums">
                {g.artist_count} {t('genres.artists')} · {g.song_count} {t('common.songs')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
