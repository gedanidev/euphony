import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getSongs, createSong, updateSong, deleteSong, enrichSong } from '../api/songs'
import { getArtists, createArtist } from '../api/artists'
import { getAlbums } from '../api/albums'
import { getGenres } from '../api/genres'
import { getMoods } from '../api/moods'
import { getPlaylists, addSongsToPlaylist } from '../api/playlists'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import LyricsModal from '../components/LyricsModal'
import ErrorState from '../components/ErrorState'

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
  const [genres, setGenres] = useState([])
  const [moods, setMoods] = useState([])
  const [albums, setAlbums] = useState([])
  const [selGenres, setSelGenres] = useState(initial?.genres?.map(g => g.id) || [])
  const [selMoods, setSelMoods] = useState(initial?.moods?.map(m => m.id) || [])
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial?.id

  // If editing, pre-fill artist query
  const [artistQuery, setArtistQuery] = useState(
    initial?.artists?.[0]?.artist?.name || ''
  )

  useEffect(() => {
    getGenres().then(setGenres).catch(() => {})
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
        genre_ids: selGenres,
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

          <MultiSelect label="Géneros" options={genres} selected={selGenres} onChange={setSelGenres} />
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
  const [filterGenre, setFilterGenre] = useState('')
  const [filterMood, setFilterMood] = useState('')
  const [page, setPage] = useState(1)
  const [genres, setGenres] = useState([])
  const [moods, setMoods] = useState([])
  const limit = 50

  const [songModal, setSongModal] = useState(null)
  const [addToPlaylist, setAddToPlaylist] = useState(null)
  const [enriching, setEnriching] = useState(null)
  const [lyricsModal, setLyricsModal] = useState(null)

  useEffect(() => {
    getGenres().then(setGenres).catch(() => {})
    getMoods().then(setMoods).catch(() => {})
  }, [])

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const params = { search: search || undefined, page, limit }
      if (availability) params.availability = availability
      if (filterGenre) params.genre_id = filterGenre
      if (filterMood) params.mood_id = filterMood
      const data = await getSongs(params)
      setSongs(data.items); setTotal(data.total)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, page, availability, filterGenre, filterMood])
  useEffect(() => { setPage(1) }, [search, availability, filterGenre, filterMood])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta canción?')) return
    await deleteSong(id)
    load()
  }

  const handleEnrich = async (id) => {
    setEnriching(id)
    try {
      await enrichSong(id)
      load()
    } catch { alert('Error enriqueciendo canción') }
    finally { setEnriching(null) }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('library.title')}</h1>
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
        <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}
          className="px-3 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
          <option value="">Todos los géneros</option>
          {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={filterMood} onChange={e => setFilterMood(e.target.value)}
          className="px-3 py-2 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
          <option value="">Todos los moods</option>
          {moods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {total > 0 && <span className="text-[#94a3b8] text-sm ml-auto">{total} {t('library.songs')}</span>}
      </div>

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
        <>
          <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2e2e4a] text-[#94a3b8] text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">{t('library.col.title')}</th>
                  <th className="px-4 py-3">{t('library.col.artist')}</th>
                  <th className="px-4 py-3">{t('library.col.album')}</th>
                  <th className="px-4 py-3">{t('library.col.year')}</th>
                  <th className="px-4 py-3">{t('library.col.status')}</th>
                  <th className="px-4 py-3 text-right">{t('library.col.duration')}</th>
                  <th className="px-4 py-3 w-40" />
                </tr>
              </thead>
              <tbody>
                {songs.map(song => (
                  <tr key={song.id} className="border-b border-[#2e2e4a] hover:bg-[#22223a]/40 group text-sm">
                    <td className="px-4 py-2 font-medium text-[#e2e8f0]">{song.title}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.artist_display || '—'}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.album?.title || '—'}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.year || '—'}</td>
                    <td className="px-4 py-2"><AvailabilityBadge value={song.availability} /></td>
                    <td className="px-4 py-2 text-[#94a3b8] text-right tabular-nums">{fmt(song.duration)}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all justify-end">
                        <button onClick={() => setAddToPlaylist(song.id)}
                          className="text-purple-400/70 hover:text-purple-400 text-xs font-medium transition-colors"
                          title="Agregar a playlist">
                          + Lista
                        </button>
                        <button onClick={() => setLyricsModal(song)}
                          className="text-yellow-400/70 hover:text-yellow-400 text-xs font-medium transition-colors"
                          title={t('lyrics.title')}>
                          ♪
                        </button>
                        <button onClick={() => handleEnrich(song.id)} disabled={enriching === song.id}
                          className="text-blue-400/70 hover:text-blue-400 text-xs font-medium transition-colors disabled:opacity-40"
                          title="Enriquecer metadata">
                          {enriching === song.id ? '…' : '✦'}
                        </button>
                        <button onClick={() => setSongModal({ mode: 'edit', song })}
                          className="text-[#94a3b8] hover:text-white transition-colors" title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(song.id)}
                          className="text-red-400/50 hover:text-red-400 transition-colors" title="Eliminar">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded text-sm disabled:opacity-40 text-[#94a3b8] hover:text-white disabled:cursor-not-allowed transition-colors">
                {t('common.prev')}
              </button>
              <span className="text-[#94a3b8] text-sm">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded text-sm disabled:opacity-40 text-[#94a3b8] hover:text-white disabled:cursor-not-allowed transition-colors">
                {t('common.next')}
              </button>
            </div>
          )}
        </>
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
    </div>
  )
}
