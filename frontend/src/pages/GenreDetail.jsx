import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getGenreArtists, reassignGenre } from '../api/genres'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorState from '../components/ErrorState'

export default function GenreDetail() {
  const { genre: encodedGenre } = useParams()
  const genre = decodeURIComponent(encodedGenre)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(genre)
  const [saving, setSaving] = useState(false)

  const [movingArtistId, setMovingArtistId] = useState(null)
  const [moveTarget, setMoveTarget] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getGenreArtists(genre)
      .then(setArtists)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [genre])

  useEffect(() => { load() }, [load])

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === genre) { setRenaming(false); return }
    setSaving(true)
    try {
      await reassignGenre({ from_genre: genre, to_genre: newName.trim() })
      navigate(`/genres/${encodeURIComponent(newName.trim())}`, { replace: true })
    } catch {
      setSaving(false)
    }
  }

  const handleMoveArtist = async (artistId) => {
    if (!moveTarget.trim()) return
    setSaving(true)
    try {
      await reassignGenre({ from_genre: genre, to_genre: moveTarget.trim(), artist_id: artistId })
      setMovingArtistId(null)
      setMoveTarget('')
      load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>
  if (error) return <div className="p-6"><ErrorState onRetry={load} /></div>

  return (
    <div className="p-6">
      <button onClick={() => navigate('/genres')} className="text-sm text-[#94a3b8] hover:text-white mb-4 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('genres.title')}
      </button>

      <div className="flex items-center justify-between mb-6">
        {renaming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
              className="px-3 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-xl font-bold text-[#e2e8f0] focus:outline-none focus:border-purple-500"
            />
            <button onClick={handleRename} disabled={saving} className="text-sm text-green-400 hover:text-green-300 disabled:opacity-50">
              {t('common.save')}
            </button>
            <button onClick={() => { setRenaming(false); setNewName(genre) }} className="text-sm text-[#94a3b8] hover:text-white">
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <h1 className="text-2xl font-bold capitalize flex items-center gap-3">
            {genre}
            <button
              onClick={() => setRenaming(true)}
              className="text-xs font-normal text-[#94a3b8] hover:text-purple-400 normal-case"
            >
              {t('common.edit')}
            </button>
          </h1>
        )}
        <span className="text-[#94a3b8] text-sm">{artists.length} {t('genres.artists')}</span>
      </div>

      <div className="border border-[#2e2e4a] rounded-xl overflow-hidden">
        {artists.map((a, i) => (
          <div
            key={a.id}
            className={`flex items-center justify-between px-4 py-3 hover:bg-[#1e1e30] transition-colors ${i !== 0 ? 'border-t border-[#2e2e4a]' : ''}`}
          >
            <Link to={`/artists/${a.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              {a.image_url ? (
                <img src={a.image_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#22223a] flex-shrink-0" />
              )}
              <span className="text-[#e2e8f0] font-medium truncate hover:text-purple-400">{a.name}</span>
              <span className="text-[#94a3b8] text-xs flex-shrink-0">{a.song_count} {t('common.songs')}</span>
            </Link>

            {movingArtistId === a.id ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  autoFocus
                  value={moveTarget}
                  onChange={e => setMoveTarget(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleMoveArtist(a.id); if (e.key === 'Escape') setMovingArtistId(null) }}
                  placeholder={t('genres.moveToPlaceholder')}
                  className="px-2 py-1 bg-[#0f0f13] border border-[#2e2e4a] rounded text-xs text-[#e2e8f0] focus:outline-none focus:border-purple-500"
                />
                <button onClick={() => handleMoveArtist(a.id)} disabled={saving} className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50">
                  {t('genreEditor.apply')}
                </button>
                <button onClick={() => setMovingArtistId(null)} className="text-xs text-[#94a3b8] hover:text-white">
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setMovingArtistId(a.id); setMoveTarget('') }}
                className="text-xs text-[#94a3b8] hover:text-purple-400 flex-shrink-0"
              >
                {t('genres.moveArtist')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
