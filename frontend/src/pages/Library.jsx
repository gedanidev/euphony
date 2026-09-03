import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getSongs, createSong, updateSong, deleteSong, enrichSong, batchDelete, batchAvailability, batchDeleteAll, setSongRating, toggleSongFavorite } from '../api/songs'
import { getArtists, createArtist } from '../api/artists'
import { getAlbums } from '../api/albums'
import { getMoods } from '../api/moods'
import { getPlaylists, addSongsToPlaylist } from '../api/playlists'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import LyricsModal from '../components/LyricsModal'
import ErrorState from '../components/ErrorState'
import RatingStars from '../components/RatingStars'
import SongEditModal from '../components/SongEditModal'

function fmt(seconds) {
  if (!seconds) return '--:--'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const AVAILABILITY_LABELS = {
  available: { label: 'Disponible', color: 'bg-green-500/20 text-green-400' },
  not_available: { label: 'No disponible', color: 'bg-gray-500/20 text-gray-400' },
  wishlist: { label: 'Wishlist', color: 'bg-yellow-500/20 text-yellow-400' },
}

function AvailabilityBadge({ value }) {
  const cfg = AVAILABILITY_LABELS[value] || AVAILABILITY_LABELS.available
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// Artist search/select with inline create
function ArtistSelector({ value, onChange, required }) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState([])
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (query.length < 1) { setOptions([]); return }
    getArtists({ search: query, limit: 10 }).then(d => setOptions(d.items)).catch(() => {})
  }, [query])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (artist) => {
    onChange(artist)
    setQuery(artist.name)
    setOpen(false)
  }

  const handleCreate = async () => {
    if (!query.trim()) return
    setCreating(true)
    try {
      const artist = await createArtist({ name: query.trim() })
      select(artist)
    } catch { alert('Error creating artist') }
    finally { setCreating(false) }
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Artista Principal *</label>
      <input
        required={required}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar artista…"
        className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
      />
      {open && (query.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg shadow-xl overflow-hidden">
          {options.map(a => (
            <button key={a.id} onMouseDown={() => select(a)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[#22223a] text-[#e2e8f0] transition-colors">
              {a.name}{a.country ? ` — ${a.country}` : ''}
            </button>
          ))}
          {options.length === 0 && query.trim() && (
            <button onMouseDown={handleCreate} disabled={creating}
              className="w-full text-left px-3 py-2 text-sm text-purple-400 hover:bg-[#22223a] transition-colors">
              {creating ? 'Creando…' : `+ Crear "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function MultiSelect({ label, options, selected, onChange }) {
  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id))
    else onChange([...selected, id])
  }
  return (
    <div>
      <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">{label}</label>
      <div className="flex flex-wrap gap-1 mt-1">
        {options.map(opt => {
          const active = selected.includes(opt.id)
          return (
            <button key={opt.id} type="button" onClick={() => toggle(opt.id)}
              className={`px-2 py-1 rounded text-xs transition-colors ${active ? 'bg-purple-600 text-white' : 'bg-[#22223a] text-[#94a3b8] hover:bg-[#2e2e4a]'}`}>
              {opt.name}
            </button>
          )
        })}
        {options.length === 0 && <span className="text-xs text-[#94a3b8]">Sin opciones</span>}
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  title: '', duration: '', year: '', version_type: '',
  availability: 'available', lyrics: '',
}

function SongModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [selectedArtist, setSelectedArtist] = useState(
    initial?.artists?.[0]?.artist || null
  )
  const [selectedAlbum, setSelectedAlbum] = useState(initial?.album || null)
  const [moods, setMoods] = useState([])
  const [albums, setAlbums] = useState([])
  const [selMoods, setSelMoods] = useState(initial?.moods?.map(m => m.mood?.id ?? m.id) || [])
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial?.id

  // If editing, pre-fill artist query
  const [artistQuery, setArtistQuery] = useState(
    initial?.artists?.[0]?.artist?.name || ''
  )

  useEffect(() => {
    getMoods().then(setMoods).catch(() => {})
    if (selectedArtist) {
      getAlbums({ artist_id: selectedArtist.id, limit: 100 }).then(d => setAlbums(d.items)).catch(() => {})
    }
  }, [selectedArtist])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedArtist) { alert('Selecciona un artista'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        duration: form.duration ? parseInt(form.duration) : null,
        year: form.year ? parseInt(form.year) : null,
        version_type: form.version_type || null,
        availability: form.availability,
        lyrics: form.lyrics || null,
        album_id: selectedAlbum?.id || null,
        artist_ids: [selectedArtist.id],
        mood_ids: selMoods,
      }
      if (isEdit) await updateSong(initial.id, payload)
      else await createSong(payload)
      onSaved()
    } catch { alert('Error guardando canción') }
    finally { setSaving(false) }
  }

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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{isEdit ? 'Editar Canción' : 'Agregar Canción'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {field('Título *', 'title', { required: true, autoFocus: true, placeholder: 'Nombre de la canción' })}

          <ArtistSelector
            value={selectedArtist}
            onChange={a => { setSelectedArtist(a); setSelectedAlbum(null) }}
            required
          />

          {/* Album selector */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Álbum</label>
            <select
              value={selectedAlbum?.id || ''}
              onChange={e => {
                const found = albums.find(a => a.id === e.target.value)
                setSelectedAlbum(found || null)
              }}
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
            >
              <option value="">— Sin álbum —</option>
              {albums.map(a => <option key={a.id} value={a.id}>{a.title}{a.year ? ` (${a.year})` : ''}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('Año', 'year', { type: 'number', min: 1900, max: 2099, placeholder: '2024' })}
            {field('Duración (seg)', 'duration', { type: 'number', min: 0, placeholder: '240' })}
            {field('Tipo de versión', 'version_type', { placeholder: 'cover, live, remix…' })}
            <div>
              <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Disponibilidad</label>
              <select
                value={form.availability}
                onChange={e => set('availability', e.target.value)}
                className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
              >
                <option value="available">Disponible</option>
                <option value="not_available">No disponible</option>
                <option value="wishlist">Wishlist</option>
              </select>
            </div>
          </div>

          <MultiSelect label="Moods" options={moods} selected={selMoods} onChange={setSelMoods} />

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddToPlaylistModal({ songId, onClose }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(null)

  useEffect(() => {
    getPlaylists({ limit: 100 }).then(d => { setPlaylists(d.items); setLoading(false) })
  }, [])

  const pick = async (pl) => {
    await addSongsToPlaylist(pl.id, [songId])
    setDone(pl.name)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold mb-4">Agregar a Playlist</h2>
        {done ? (
          <div className="text-center py-4">
            <p className="text-purple-400 font-medium">Agregado a "{done}"</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-[#22223a] hover:bg-[#2e2e4a] text-white rounded-lg text-sm transition-colors">Cerrar</button>
          </div>
        ) : loading ? <LoadingSpinner size="sm" /> : playlists.length === 0 ? (
          <p className="text-[#94a3b8] text-sm">No hay playlists. Crea una primero.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {playlists.map(pl => (
              <button key={pl.id} onClick={() => pick(pl)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#22223a] text-sm transition-colors flex items-center justify-between">
                <span className="font-medium">{pl.name}</span>
                <span className="text-[#94a3b8] text-xs">{pl.song_count} canciones</span>
              </button>
            ))}
          </div>
        )}
        {!done && (
          <button onClick={onClose} className="mt-4 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancelar</button>
        )}
      </div>
    </div>
  )
}

function BulkAddToPlaylistModal({ songIds, onClose, onSaved }) {
  const [playlists, setPlaylists] = useState([])
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getPlaylists({ limit: 100 }).then(d => setPlaylists(d.items ?? d))
  }, [])

  const addToExisting = async (playlistId) => {
    setSaving(true)
    try {
      await addSongsToPlaylist(playlistId, songIds)
      onSaved()
    } catch { alert('Error al agregar a playlist') }
    finally { setSaving(false) }
  }

  const createAndAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const { createPlaylist: cp } = await import('../api/playlists')
      const pl = await cp({ name: newName.trim() })
      await addSongsToPlaylist(pl.id, songIds)
      onSaved()
    } catch { alert('Error al crear playlist') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Agregar {songIds.length} canciones a playlist</h2>
        <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
          {playlists.map(pl => (
            <button key={pl.id} onClick={() => addToExisting(pl.id)} disabled={saving}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#22223a] text-sm text-[#e2e8f0] transition-colors">
              {pl.name} <span className="text-[#94a3b8]">({pl.song_count ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="border-t border-[#2e2e4a] pt-4">
          <p className="text-xs text-[#94a3b8] mb-2 uppercase tracking-wider">Nueva playlist</p>
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Nombre de la playlist"
              className="flex-1 px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
            <button onClick={createAndAdd} disabled={!newName.trim() || saving}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors">
              Crear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RowActionsMenu({ song, onAddToPlaylist, onEditSong, onLyrics, onEnrich, onEdit, onDelete, enriching, onFavorite }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div className="flex items-center gap-1 justify-end" ref={ref} onClick={e => e.stopPropagation()}>
      <button onClick={() => onFavorite()}
        className={`w-6 h-6 flex items-center justify-center text-sm rounded transition-colors ${song.is_favorite ? 'text-pink-500' : 'text-[#3d3d5c] hover:text-pink-400'}`}>
        {song.is_favorite ? '♥' : '♡'}
      </button>
      <div className="relative">
        <button onClick={() => setOpen(v => !v)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#64748b] hover:text-white hover:bg-[#2e2e4a] transition-colors leading-none font-bold tracking-widest">
          ···
        </button>
        {open && (
          <div className="absolute right-0 top-8 z-30 bg-[#1a1a24] border border-[#2e2e4a] rounded-xl shadow-2xl py-1 w-44 text-sm">
            <button onClick={() => { onAddToPlaylist(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[#e2e8f0] hover:bg-[#22223a] transition-colors">
              + Agregar a playlist
            </button>
            <button onClick={() => { onEditSong(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[#e2e8f0] hover:bg-[#22223a] transition-colors">
              ♬ Género / vocal
            </button>
            <button onClick={() => { onLyrics(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[#e2e8f0] hover:bg-[#22223a] transition-colors">
              ♪ Letras
            </button>
            <button onClick={() => { onEnrich(); setOpen(false) }} disabled={enriching}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[#e2e8f0] hover:bg-[#22223a] transition-colors disabled:opacity-40">
              {enriching ? '…' : '✦'} Enriquecer
            </button>
            <button onClick={() => { onEdit(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[#e2e8f0] hover:bg-[#22223a] transition-colors">
              ✎ Editar
            </button>
            <div className="border-t border-[#2e2e4a] my-1" />
            <button onClick={() => { onDelete(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-400 hover:bg-red-900/20 transition-colors">
              ✕ Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Library() {
  const { t } = useTranslation()

  const AVAILABILITY_TABS = [
    { key: '', label: t('library.availability.all') },
    { key: 'available', label: t('library.availability.available') },
    { key: 'wishlist', label: t('library.availability.wishlist') },
    { key: 'not_available', label: t('library.availability.not_available') },
  ]

  const [songs, setSongs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [availability, setAvailability] = useState('')
  const [filterMood, setFilterMood] = useState('')
  const [walkmanFilter, setWalkmanFilter] = useState('')
  const [sortBy, setSortBy] = useState('title')
  const [sortDir, setSortDir] = useState('asc')
  const [moods, setMoods] = useState([])
  const limit = 100
  const [page, setPageState] = useState(() => parseInt(sessionStorage.getItem('library-page') || '1', 10))
  const setPage = (v) => setPageState(prev => {
    const next = typeof v === 'function' ? v(prev) : v
    sessionStorage.setItem('library-page', String(next))
    return next
  })
  const filtersReady = useRef(false)

  const [songModal, setSongModal] = useState(null)
  const [addToPlaylist, setAddToPlaylist] = useState(null)
  const [enriching, setEnriching] = useState(null)
  const [lyricsModal, setLyricsModal] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [editSong, setEditSong] = useState(null)
  const [showBulkPlaylist, setShowBulkPlaylist] = useState(false)

  useEffect(() => {
    getMoods().then(setMoods).catch(() => {})
  }, [])

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const params = { search: search || undefined, page, limit, sort_by: sortBy, sort_dir: sortDir }
      if (availability) params.availability = availability
      if (filterMood) params.mood_id = filterMood
      if (walkmanFilter) params.walkman_status = walkmanFilter
      const data = await getSongs(params)
      setSongs(data.items); setTotal(data.total)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!filtersReady.current) { filtersReady.current = true; return }
    setPage(1)
  }, [search, availability, filterMood, walkmanFilter, sortBy, sortDir])
  useEffect(() => { load() }, [page, search, availability, filterMood, walkmanFilter, sortBy, sortDir])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta canción?')) return
    await deleteSong(id)
    load()
  }

  const handleRating = async (songId, rating) => {
    await setSongRating(songId, rating)
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, rating } : s))
  }

  const handleFavorite = async (songId) => {
    const updated = await toggleSongFavorite(songId)
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_favorite: updated.is_favorite } : s))
  }

  const handleEnrich = async (id) => {
    setEnriching(id)
    try {
      await enrichSong(id)
      load()
    } catch { alert('Error enriqueciendo canción') }
    finally { setEnriching(null) }
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(songs.map(s => s.id)))
  const clearSelection = () => setSelected(new Set())

  const handleBatchAvailability = async (availability) => {
    if (selected.size === 0) return
    setBatchLoading(true)
    try {
      await batchAvailability([...selected], availability)
      setSelected(new Set())
      load()
    } finally { setBatchLoading(false) }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(t('library.batch.deleteConfirm', { n: selected.size }))) return
    setBatchLoading(true)
    try {
      await batchDelete([...selected])
      setSelected(new Set())
      load()
    } finally { setBatchLoading(false) }
  }

  const handleDeleteAll = async () => {
    setBatchLoading(true)
    try {
      await batchDeleteAll()
      setShowDeleteAllConfirm(false)
      setSelected(new Set())
      load()
    } finally { setBatchLoading(false) }
  }

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const SortTh = ({ col, label, className = '' }) => {
    const active = sortBy === col
    return (
      <th className={`px-4 py-3 cursor-pointer select-none hover:text-white transition-colors ${active ? 'text-white' : ''} ${className}`}
        onClick={() => toggleSort(col)}>
        <span className="flex items-center gap-1">
          {label}
          <span className="text-xs opacity-60">
            {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </span>
      </th>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('library.title')}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            className="px-3 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg text-sm transition-colors"
          >
            {t('library.batch.deleteAll')}
          </button>
          <button
            onClick={() => setSongModal({ mode: 'create' })}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('library.addSong')}
          </button>
        </div>
      </div>

      {/* Availability tabs */}
      <div className="flex gap-1 mb-4">
        {AVAILABILITY_TABS.map(tab => (
          <button key={tab.key} onClick={() => setAvailability(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${availability === tab.key
              ? 'bg-purple-600 text-white'
              : 'text-[#94a3b8] hover:text-white hover:bg-[#22223a]'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder={t('library.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64 px-4 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
        />
        <select value={filterMood} onChange={e => setFilterMood(e.target.value)}
          className="px-3 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
          <option value="">Todos los moods</option>
          {moods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select
          value={walkmanFilter}
          onChange={e => setWalkmanFilter(e.target.value)}
          className="px-3 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
        >
          <option value="">{t('library.allStatuses')}</option>
          <option value="on_walkman">{t('library.onWalkman')}</option>
          <option value="wishlist">{t('library.wishlist')}</option>
          <option value="removed">{t('library.removed')}</option>
        </select>
        {total > 0 && <span className="text-[#94a3b8] text-sm ml-auto">{total} {t('library.songs')} · p. {page}/{Math.ceil(total / limit)}</span>}
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 px-4 py-3 bg-purple-900/20 border border-purple-700/40 rounded-xl">
          <span className="text-sm text-purple-300 font-medium mr-1">
            {t('library.batch.selected', { n: selected.size })}
          </span>
          <button onClick={() => handleBatchAvailability('available')} disabled={batchLoading}
            className="px-3 py-1.5 bg-green-700/20 hover:bg-green-700/40 text-green-400 text-xs rounded-lg transition-colors disabled:opacity-50">
            {t('library.batch.markAvailable')}
          </button>
          <button onClick={() => handleBatchAvailability('wishlist')} disabled={batchLoading}
            className="px-3 py-1.5 bg-yellow-700/20 hover:bg-yellow-700/40 text-yellow-400 text-xs rounded-lg transition-colors disabled:opacity-50">
            {t('library.batch.markWishlist')}
          </button>
          <button onClick={() => handleBatchAvailability('not_available')} disabled={batchLoading}
            className="px-3 py-1.5 bg-[#22223a] hover:bg-[#2e2e4a] text-[#94a3b8] text-xs rounded-lg transition-colors disabled:opacity-50">
            {t('library.batch.markNotAvailable')}
          </button>
          <button onClick={handleBatchDelete} disabled={batchLoading}
            className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs rounded-lg transition-colors disabled:opacity-50">
            {t('library.batch.delete')}
          </button>
          <button onClick={() => setShowBulkPlaylist(true)}
            className="px-3 py-1.5 bg-purple-700/20 hover:bg-purple-700/40 text-purple-400 text-xs rounded-lg transition-colors">
            + Agregar a playlist
          </button>
          <button onClick={clearSelection}
            className="ml-auto text-xs text-[#94a3b8] hover:text-white transition-colors">
            {t('library.batch.clearAll')}
          </button>
        </div>
      )}

      {loading && <LoadingSpinner />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && songs.length === 0 && (
        <EmptyState
          title={t('library.empty.title')}
          description={availability ? t('library.empty.filtered') : t('library.empty.desc')}
          action={!availability ? (
            <button onClick={() => setSongModal({ mode: 'create' })}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
              {t('library.addSong')}
            </button>
          ) : null}
        />
      )}

      {!loading && !error && songs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[#2e2e4a]" style={{ maxHeight: 'calc(100dvh - 280px)', overflowY: 'auto' }}>
          <table className="w-full min-w-[700px] text-left bg-[#1a1a24]">
              <thead className="sticky top-0 z-10 bg-[#1a1a24]">
                <tr className="border-b border-[#2e2e4a] text-[#94a3b8] text-xs uppercase tracking-wider">
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox"
                      className="rounded border-[#2e2e4a] bg-[#0f0f13] accent-purple-600 cursor-pointer"
                      checked={songs.length > 0 && songs.every(s => selected.has(s.id))}
                      onChange={e => e.target.checked ? selectAll() : clearSelection()}
                    />
                  </th>
                  <SortTh col="title" label={t('library.col.title')} />
                  <SortTh col="artist" label={t('library.col.artist')} />
                  <SortTh col="album" label={t('library.col.album')} />
                  <th className="px-4 py-3">{t('library.col.year')}</th>
                  <th className="px-4 py-3">{t('library.col.status')}</th>
                  <th className="px-4 py-3 text-right">{t('library.col.duration')}</th>
                  <th className="px-2 py-3 w-24" />
                  <th className="px-2 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {songs.map(song => (
                  <tr key={song.id} className={`border-b border-[#2e2e4a] hover:bg-[#22223a]/40 group text-sm ${selected.has(song.id) ? 'bg-purple-900/10' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox"
                        className="rounded border-[#2e2e4a] bg-[#0f0f13] accent-purple-600 cursor-pointer"
                        checked={selected.has(song.id)}
                        onChange={() => toggleSelect(song.id)}
                      />
                    </td>
                    <td className="px-4 py-2 font-medium text-[#e2e8f0]">{song.title}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.artist_display || '—'}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.album?.title || '—'}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.year || '—'}</td>
                    <td className="px-4 py-2"><AvailabilityBadge value={song.availability} /></td>
                    <td className="px-4 py-2 text-[#94a3b8] text-right tabular-nums">{fmt(song.duration)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <RatingStars
                        rating={song.rating || null}
                        onChange={(r) => handleRating(song.id, r)}
                        compact
                        size="sm"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <RowActionsMenu
                        song={song}
                        enriching={enriching === song.id}
                        onFavorite={() => handleFavorite(song.id)}
                        onAddToPlaylist={() => setAddToPlaylist(song.id)}
                        onEditSong={() => setEditSong(song)}
                        onLyrics={() => setLyricsModal(song)}
                        onEnrich={() => handleEnrich(song.id)}
                        onEdit={() => setSongModal({ mode: 'edit', song })}
                        onDelete={() => handleDelete(song.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}

      {/* Pagination */}
      {Math.ceil(total / limit) > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 pb-4">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
            className="px-3 py-1.5 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#94a3b8] hover:text-white disabled:opacity-40 transition-colors">
            ← Anterior
          </button>
          <div className="flex items-center gap-1.5 text-sm text-[#94a3b8]">
            <input
              key={page}
              type="number"
              min={1}
              max={Math.ceil(total / limit)}
              defaultValue={page}
              onBlur={e => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= Math.ceil(total / limit)) setPage(v) }}
              onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= Math.ceil(total / limit)) { setPage(v); e.target.blur() } } }}
              className="w-14 text-center bg-[#1a1a24] border border-[#2e2e4a] rounded-lg py-1 text-[#e2e8f0] focus:outline-none focus:border-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span>/ {Math.ceil(total / limit)}</span>
          </div>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)}
            className="px-3 py-1.5 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#94a3b8] hover:text-white disabled:opacity-40 transition-colors">
            Siguiente →
          </button>
        </div>
      )}

      {songModal && (
        <SongModal
          initial={songModal.mode === 'edit' ? songModal.song : null}
          onClose={() => setSongModal(null)}
          onSaved={() => { setSongModal(null); load() }}
        />
      )}

      {addToPlaylist && (
        <AddToPlaylistModal songId={addToPlaylist} onClose={() => setAddToPlaylist(null)} />
      )}

      {lyricsModal && (
        <LyricsModal song={lyricsModal} onClose={() => setLyricsModal(null)} />
      )}

      {editSong && (
        <SongEditModal song={editSong} onClose={() => setEditSong(null)} onSaved={(updated) => {
          setSongs(prev => prev.map(s => s.id === updated.id ? updated : s))
          setEditSong(null)
        }} />
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#22223a] border border-[#3e3e6a] rounded-xl px-4 py-3 shadow-xl">
          <span className="text-sm text-[#94a3b8]">{selected.size} seleccionadas</span>
          <button
            onClick={() => setShowBulkPlaylist(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Agregar a playlist
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-[#94a3b8] hover:text-white transition-colors text-sm">
            Cancelar
          </button>
        </div>
      )}

      {showBulkPlaylist && (
        <BulkAddToPlaylistModal
          songIds={[...selected]}
          onClose={() => setShowBulkPlaylist(false)}
          onSaved={() => { setShowBulkPlaylist(false); setSelected(new Set()) }}
        />
      )}

      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="bg-[#1a1a24] border border-red-900/50 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="font-semibold text-red-400">{t('library.batch.deleteAll')}</h2>
            </div>
            <p className="text-sm text-[#94a3b8] mb-6">{t('library.batch.deleteAllConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteAllConfirm(false)}
                className="px-4 py-2 bg-[#22223a] hover:bg-[#2e2e4a] text-[#e2e8f0] text-sm rounded-lg transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleDeleteAll} disabled={batchLoading}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                {batchLoading ? '…' : t('library.batch.deleteAllConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
