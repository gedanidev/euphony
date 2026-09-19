import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getArtists } from '../api/artists'
import { getAlbums } from '../api/albums'
import { getSongs, batchGenre } from '../api/songs'
import LoadingSpinner from '../components/LoadingSpinner'

export default function GenreEditor() {
  const { t } = useTranslation()
  const [mode, setMode] = useState('artist') // 'artist' | 'album'
  const [artists, setArtists] = useState([])
  const [albums, setAlbums] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedSongs, setSelectedSongs] = useState(new Set())
  const [newGenre, setNewGenre] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Load artists/albums on mount
  useEffect(() => {
    async function load() {
      const [aRes, alRes] = await Promise.all([
        getArtists({ limit: 10000 }),
        getAlbums({ limit: 10000 }),
      ])
      setArtists(aRes.items || [])
      setAlbums(alRes.items || [])
    }
    load()
  }, [])

  // Load songs when selection changes
  const loadSongs = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      let res
      if (mode === 'artist') {
        res = await getSongs({ artist_id: selectedId, limit: 10000 })
      } else {
        res = await getSongs({ album_id: selectedId, limit: 10000 })
      }
      setSongs(res.items || [])
      setSelectedSongs(new Set())
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [mode, selectedId])

  useEffect(() => {
    loadSongs()
  }, [loadSongs])

  const toggleSong = (id) => {
    const next = new Set(selectedSongs)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedSongs(next)
  }

  const toggleAll = () => {
    if (selectedSongs.size === songs.length) {
      setSelectedSongs(new Set())
    } else {
      setSelectedSongs(new Set(songs.map(s => s.id)))
    }
  }

  const applyGenre = async () => {
    if (selectedSongs.size === 0 || !newGenre.trim()) return
    setSaving(true)
    try {
      await batchGenre(Array.from(selectedSongs), newGenre.trim())
      setMessage({ type: 'success', text: t('genreEditor.success', { count: selectedSongs.size }) })
      setSelectedSongs(new Set())
      setNewGenre('')
      loadSongs() // Refresh
    } catch (e) {
      setMessage({ type: 'error', text: e.message || t('genreEditor.error') })
    }
    setSaving(false)
    setTimeout(() => setMessage(null), 5000)
  }

  const clearGenre = async () => {
    if (selectedSongs.size === 0) return
    setSaving(true)
    try {
      await batchGenre(Array.from(selectedSongs), '')
      setMessage({ type: 'success', text: t('genreEditor.cleared', { count: selectedSongs.size }) })
      setSelectedSongs(new Set())
      loadSongs()
    } catch (e) {
      setMessage({ type: 'error', text: e.message || t('genreEditor.error') })
    }
    setSaving(false)
    setTimeout(() => setMessage(null), 5000)
  }

  const filteredItems = mode === 'artist' ? artists : albums

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6 text-white">{t('genreEditor.title')}</h1>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Mode selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setMode('artist'); setSelectedId(null); setSongs([]); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'artist' ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'}`}
        >
          {t('genreEditor.byArtist')}
        </button>
        <button
          onClick={() => { setMode('album'); setSelectedId(null); setSongs([]); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'album' ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'}`}
        >
          {t('genreEditor.byAlbum')}
        </button>
      </div>

      {/* Artist/Album selector */}
      <div className="mb-6">
        <select
          value={selectedId || ''}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="w-full max-w-md px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
        >
          <option value="">{mode === 'artist' ? t('genreEditor.selectArtist') : t('genreEditor.selectAlbum')}</option>
          {filteredItems.map(item => (
            <option key={item.id} value={item.id}>
              {item.name || item.title} {mode === 'album' && item.artist ? `- ${item.artist.name}` : ''}
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingSpinner />}

      {/* Songs table */}
      {songs.length > 0 && !loading && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[#e2e8f0]">
              <input
                type="checkbox"
                checked={selectedSongs.size === songs.length && songs.length > 0}
                onChange={toggleAll}
                className="accent-purple-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-sm">{t('genreEditor.selectAll', { count: songs.length })}</span>
            </label>
            <span className="text-sm text-[#94a3b8]">
              {t('genreEditor.selected', { count: selectedSongs.size })}
            </span>
          </div>

          <div className="overflow-x-auto border border-[#2e2e4a] rounded-xl mb-6">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#1e1e30] text-[#94a3b8]">
                <tr>
                  <th className="p-2 w-10"></th>
                  <th className="p-2 font-medium">{t('library.col.title')}</th>
                  <th className="p-2 font-medium">{t('library.col.artist')}</th>
                  <th className="p-2 font-medium">{t('library.col.album')}</th>
                  <th className="p-2 font-medium">{t('library.col.genre')}</th>
                </tr>
              </thead>
              <tbody>
                {songs.map(song => (
                  <tr key={song.id} className="border-t border-[#2e2e4a] hover:bg-[#1e1e30] text-[#e2e8f0]">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedSongs.has(song.id)}
                        onChange={() => toggleSong(song.id)}
                        className="accent-purple-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2">{song.title}</td>
                    <td className="p-2">
                      {song.artists?.map(a => a.name).join(', ') || '-'}
                    </td>
                    <td className="p-2">{song.album?.title || '-'}</td>
                    <td className="p-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300 capitalize">
                        {song.primary_genre || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Genre editor */}
          {selectedSongs.size > 0 && (
            <div className="bg-[#13131a] border border-[#2e2e4a] rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-[#e2e8f0]">{t('genreEditor.editSelected')}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  placeholder={t('genreEditor.newGenrePlaceholder')}
                  className="px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
                  disabled={saving}
                />
                <button
                  onClick={applyGenre}
                  disabled={!newGenre.trim() || saving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? t('common.saving') : t('genreEditor.apply')}
                </button>
                <button
                  onClick={clearGenre}
                  disabled={saving}
                  className="px-4 py-2 bg-[#1e1e30] hover:bg-[#2e2e4a] disabled:opacity-50 text-[#94a3b8] hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {t('genreEditor.clear')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedId && songs.length === 0 && !loading && (
        <p className="text-[#94a3b8]">{t('genreEditor.noSongs')}</p>
      )}
    </div>
  )
}
