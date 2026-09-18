import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { listArtists } from '../api/artists'
import { listAlbums } from '../api/albums'
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
        listArtists({ limit: 10000 }),
        listAlbums({ limit: 10000 }),
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
      <h1 className="text-2xl font-bold mb-6">{t('genreEditor.title')}</h1>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Mode selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setMode('artist'); setSelectedId(null); setSongs([]); }}
          className={`px-4 py-2 rounded ${mode === 'artist' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          {t('genreEditor.byArtist')}
        </button>
        <button
          onClick={() => { setMode('album'); setSelectedId(null); setSongs([]); }}
          className={`px-4 py-2 rounded ${mode === 'album' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          {t('genreEditor.byAlbum')}
        </button>
      </div>

      {/* Artist/Album selector */}
      <div className="mb-6">
        <select
          value={selectedId || ''}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="w-full max-w-md p-2 border rounded"
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
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedSongs.size === songs.length && songs.length > 0}
                onChange={toggleAll}
              />
              <span>{t('genreEditor.selectAll', { count: songs.length })}</span>
            </label>
            <span className="text-sm text-gray-600">
              {t('genreEditor.selected', { count: selectedSongs.size })}
            </span>
          </div>

          <div className="overflow-x-auto border rounded mb-6">
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 w-10"></th>
                  <th className="p-2">{t('song.title')}</th>
                  <th className="p-2">{t('song.artist')}</th>
                  <th className="p-2">{t('song.album')}</th>
                  <th className="p-2">{t('song.genre')}</th>
                </tr>
              </thead>
              <tbody>
                {songs.map(song => (
                  <tr key={song.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedSongs.has(song.id)}
                        onChange={() => toggleSong(song.id)}
                      />
                    </td>
                    <td className="p-2">{song.title}</td>
                    <td className="p-2">
                      {song.artists?.map(a => a.name).join(', ') || '-'}
                    </td>
                    <td className="p-2">{song.album?.title || '-'}</td>
                    <td className="p-2">
                      <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-800 text-sm">
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
            <div className="bg-gray-50 p-4 rounded border">
              <h3 className="font-semibold mb-3">{t('genreEditor.editSelected')}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  placeholder={t('genreEditor.newGenrePlaceholder')}
                  className="px-3 py-2 border rounded"
                  disabled={saving}
                />
                <button
                  onClick={applyGenre}
                  disabled={!newGenre.trim() || saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('genreEditor.apply')}
                </button>
                <button
                  onClick={clearGenre}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                >
                  {t('genreEditor.clear')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedId && songs.length === 0 && !loading && (
        <p className="text-gray-500">{t('genreEditor.noSongs')}</p>
      )}
    </div>
  )
}
