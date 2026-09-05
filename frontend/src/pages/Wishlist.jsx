import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSongs, updateSong, deleteSong } from '../api/songs'
import { createWishlistItem } from '../api/walkman'
import ShazamSearch from '../components/ShazamSearch'

function AddWishlistModal({ onClose, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ title: '', artist_name: '', album_name: '', wishlist_notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createWishlistItem(form)
      onSaved()
    } catch { alert('Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{t('wishlist.add')}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key: 'title', label: t('wishlist.addTitle'), required: true },
            { key: 'artist_name', label: t('wishlist.addArtist'), required: true },
            { key: 'album_name', label: t('wishlist.addAlbum'), required: false },
            { key: 'wishlist_notes', label: t('wishlist.addNotes'), required: false },
          ].map(({ key, label, required }) => (
            <div key={key}>
              <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">{label}</label>
              <input
                required={required}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
              />
            </div>
          ))}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Wishlist() {
  const { t } = useTranslation()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showShazam, setShowShazam] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getSongs({ walkman_status: 'wishlist', limit: 200 })
      setSongs(data.items ?? data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar del wishlist?')) return
    await deleteSong(id)
    setSongs(prev => prev.filter(s => s.id !== id))
  }

  const handleAcquired = async (song) => {
    await updateSong(song.id, { walkman_status: 'removed' })
    setSongs(prev => prev.filter(s => s.id !== song.id))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('wishlist.title')}</h1>
          {songs.length > 0 && (
            <p className="text-sm text-[#94a3b8] mt-1">{songs.length} {t('wishlist.pending')}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowShazam(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
            </svg>
            {t('shazam.searchButton')}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-[#2e2e4a] hover:bg-[#3d3d5c] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('wishlist.add')}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && songs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-[#e2e8f0] mb-2">{t('shazam.emptyWishlistTitle')}</p>
          <p className="text-sm text-[#94a3b8] mb-6">{t('shazam.emptyWishlistDesc')}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setShowShazam(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
              </svg>
              {t('shazam.searchButton')}
            </button>
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-[#2e2e4a] hover:bg-[#3d3d5c] text-white rounded-lg text-sm transition-colors">
              {t('wishlist.add')}
            </button>
          </div>
        </div>
      )}

      {!loading && songs.length > 0 && (
        <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-hidden">
          {songs.map((song, idx) => (
            <div key={song.id}
              className={`flex items-center gap-4 px-4 py-3 group ${idx < songs.length - 1 ? 'border-b border-[#2e2e4a]' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[#e2e8f0] truncate">{song.title}</p>
                <p className="text-xs text-[#94a3b8] truncate mt-0.5">
                  {song.artist_display}
                  {song.album && ` · ${song.album.title}`}
                </p>
                {song.wishlist_notes && (
                  <p className="text-xs text-purple-400/70 mt-0.5 truncate">{song.wishlist_notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleAcquired(song)}
                  className="text-xs px-2 py-1 bg-green-700/30 text-green-400 rounded hover:bg-green-700/50 transition-colors">
                  {t('wishlist.markAcquired')}
                </button>
                <button onClick={() => handleDelete(song.id)}
                  className="text-red-400/60 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddWishlistModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}

      {showShazam && (
        <ShazamSearch
          onSongAdded={() => { setShowShazam(false); load() }}
          onClose={() => setShowShazam(false)}
          library={songs}
        />
      )}
    </div>
  )
}
