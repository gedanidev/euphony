import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getArtist, updateArtist, enrichArtist, getArtistSongs, getArtistRelations, addArtistRelation, deleteArtistRelation, toggleArtistPreferred, setArtistImage, getArtistImageCandidates } from '../api/artists'
import { getAlbums } from '../api/albums'
import { setSongRating, toggleSongFavorite } from '../api/songs'
import RatingStars from '../components/RatingStars'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorState from '../components/ErrorState'

function fmt(seconds) {
  if (!seconds) return '--:--'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function AlbumIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  )
}

function SongRow({ song, idx, onRating, onFavorite }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <tr className="border-b border-[#2e2e4a] last:border-0 hover:bg-[#22223a]/40 text-sm group">
      <td className="px-4 py-2.5 text-right text-[#94a3b8] tabular-nums w-10 select-none">{idx + 1}</td>
      <td className="px-4 py-2.5 font-medium text-[#e2e8f0]">
        {song.title}
        {song.artists?.filter(a => a.role === 'colaborador').length > 0 && (
          <span className="text-[#94a3b8] text-xs font-normal ml-1.5">
            feat. {song.artists.filter(a => a.role === 'colaborador').map(a => a.artist.name).join(', ')}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-[#94a3b8] text-xs truncate max-w-[140px]">
        {song.album?.title || '—'}
      </td>
      <td className="px-4 py-2.5 text-[#94a3b8] text-right tabular-nums">{fmt(song.duration)}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <RatingStars rating={song.rating} onChange={r => onRating(song.id, r)} compact />
      </td>
      <td className="px-2 py-2.5">
        <button onClick={() => onFavorite(song.id)}
          className={`text-base transition-colors ${song.is_favorite ? 'text-pink-500' : 'text-[#3d3d5c] hover:text-pink-400'}`}>
          {song.is_favorite ? '♥' : '♡'}
        </button>
      </td>
      <td className="px-2 py-2.5 relative">
        <button onClick={() => setMenuOpen(o => !o)}
          className="opacity-0 group-hover:opacity-100 text-[#94a3b8] hover:text-white transition-all p-1 rounded">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-44 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg shadow-xl overflow-hidden"
            onMouseLeave={() => setMenuOpen(false)}>
            <div className="px-3 py-2 text-xs text-[#64748b] border-b border-[#2e2e4a]">Próximamente</div>
            <button className="w-full text-left px-3 py-2 text-sm text-[#94a3b8] hover:bg-[#22223a] transition-colors">
              Agregar a playlist…
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

const RELATION_TYPES = [
  { value: 'band_member', label: 'Miembro de banda' },
  { value: 'collaborator', label: 'Colaborador frecuente' },
  { value: 'solo_project', label: 'Proyecto solista' },
]

export default function ArtistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [artist, setArtist] = useState(null)
  const [songs, setSongs] = useState([])
  const [albums, setAlbums] = useState([])
  const [relations, setRelations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAlbumId, setSelectedAlbumId] = useState(null)
  const [imageModal, setImageModal] = useState(false)
  const [imageInput, setImageInput] = useState('')
  const [savingImage, setSavingImage] = useState(false)
  const [searchingImage, setSearchingImage] = useState(false)
  const [imageCandidates, setImageCandidates] = useState([])
  const [imageSearchQuery, setImageSearchQuery] = useState('')
  const [enriching, setEnriching] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [showAddRelation, setShowAddRelation] = useState(false)

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const [a, rels] = await Promise.all([getArtist(id), getArtistRelations(id)])
      setArtist(a)
      setRelations(rels)
      setEditForm({ name: a.name, bio: a.bio || '', country: a.country || '', region: a.region || '' })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const loadSongs = async () => {
    try {
      const data = await getArtistSongs(id, {})
      setSongs(data)
    } catch { setSongs([]) }
  }

  const loadAlbums = async () => {
    try {
      const data = await getAlbums({ artist_id: id, limit: 200 })
      setAlbums(data.items || [])
    } catch { setAlbums([]) }
  }

  const handleSongRating = async (songId, rating) => {
    await setSongRating(songId, rating)
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, rating } : s))
  }

  const handleSongFavorite = async (songId) => {
    const updated = await toggleSongFavorite(songId)
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_favorite: updated.is_favorite } : s))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { if (artist) { loadSongs(); loadAlbums() } }, [artist])

  // Group songs by album, sorted by album year
  const songsByAlbum = useMemo(() => {
    const groups = {}
    songs.forEach(song => {
      const key = song.album?.id || '__none__'
      if (!groups[key]) groups[key] = { album: song.album || null, songs: [] }
      groups[key].songs.push(song)
    })
    return Object.values(groups).sort((a, b) => {
      if (!a.album) return 1
      if (!b.album) return -1
      return (a.album.year || 9999) - (b.album.year || 9999)
    })
  }, [songs])

  const handleEnrich = async () => {
    setEnriching(true)
    try {
      const updated = await enrichArtist(id)
      setArtist(updated)
    } catch { alert('Error enriqueciendo artista') }
    finally { setEnriching(false) }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateArtist(id, {
        name: editForm.name,
        bio: editForm.bio || null,
        country: editForm.country || null,
        region: editForm.region || null,
      })
      setArtist(updated)
      setEditing(false)
    } catch { alert('Error guardando') }
    finally { setSaving(false) }
  }

  const handleDeleteRelation = async (relId) => {
    if (!confirm('¿Eliminar esta relación?')) return
    await deleteArtistRelation(id, relId)
    setRelations(rels => rels.filter(r => r.id !== relId))
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>
  if (!artist) return null

  return (
    <div className="p-6 max-w-5xl">
      {/* Back */}
      <button onClick={() => navigate('/artists')} className="text-[#94a3b8] hover:text-white text-sm mb-6 flex items-center gap-2 transition-colors">
        ← Artistas
      </button>

      {/* Artist header */}
      <div className="flex gap-6 mb-8">
        <button
          onClick={() => { setImageInput(artist.image_url || ''); setImageCandidates([]); setImageSearchQuery(artist.name); setImageModal(true) }}
          className="w-28 h-28 rounded-xl bg-[#22223a] flex-shrink-0 flex items-center justify-center overflow-hidden group relative"
          title="Cambiar imagen"
        >
          {artist.image_url ? (
            <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-12 h-12 text-[#2e2e4a]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </button>

        <div className="flex-1">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-lg font-bold text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
              <div className="grid grid-cols-2 gap-3">
                <input value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} placeholder="País"
                  className="px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
                <input value={editForm.region} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))} placeholder="Región / Ciudad"
                  className="px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
              </div>
              <textarea value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} rows={3} placeholder="Biografía…"
                className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500 resize-none" />
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setEditing(false)}
                  className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancelar</button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold">{artist.name}</h1>
                <button
                  onClick={async () => {
                    const updated = await toggleArtistPreferred(artist.id)
                    setArtist(a => ({ ...a, is_preferred: updated.is_preferred }))
                  }}
                  className={`text-2xl transition-colors ${artist.is_preferred ? 'text-amber-400' : 'text-[#3d3d5c] hover:text-amber-300'}`}
                  title={artist.is_preferred ? t('artist.removePreferred') : t('artist.addPreferred')}
                >
                  {artist.is_preferred ? '★' : '☆'}
                </button>
              </div>
              <div className="flex items-center gap-3 text-[#94a3b8] text-sm mb-3">
                {artist.country && <span>{artist.country}{artist.region ? ` · ${artist.region}` : ''}</span>}
                {artist.mbid && (
                  <a href={`https://musicbrainz.org/artist/${artist.mbid}`} target="_blank" rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 transition-colors">MusicBrainz ↗</a>
                )}
              </div>
              {artist.bio && <p className="text-[#94a3b8] text-sm leading-relaxed mb-3 max-w-2xl">{artist.bio}</p>}
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)}
                  className="px-3 py-1.5 bg-[#22223a] hover:bg-[#2e2e4a] text-white rounded-lg text-sm transition-colors">
                  Editar
                </button>
                <button onClick={handleEnrich} disabled={enriching}
                  className="px-3 py-1.5 bg-[#22223a] hover:bg-[#2e2e4a] text-white rounded-lg text-sm transition-colors disabled:opacity-50">
                  {enriching ? 'Enriqueciendo…' : '✦ Enriquecer con MusicBrainz'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Songs section */}
      <div className="mb-8">
        {selectedAlbumId ? (
          /* Vista inline del álbum */
          (() => {
            const album = albums.find(a => a.id === selectedAlbumId)
            const group = songsByAlbum.find(g => g.album?.id === selectedAlbumId)
            const albumSongs = group?.songs || []
            return (
              <div>
                <button onClick={() => setSelectedAlbumId(null)}
                  className="text-[#94a3b8] hover:text-white text-sm mb-5 flex items-center gap-2 transition-colors">
                  ← {artist.name}
                </button>
                <div className="flex gap-5 mb-6 items-center">
                  <div className="w-24 h-24 rounded-xl bg-[#22223a] flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {album?.cover_url
                      ? <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                      : <AlbumIcon className="w-10 h-10 text-[#2e2e4a]" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#e2e8f0]">{album?.title}</h2>
                    {album?.year && <p className="text-[#94a3b8] text-sm mt-0.5">{album.year}</p>}
                    <p className="text-[#94a3b8] text-sm mt-0.5">{albumSongs.length} canciones</p>
                  </div>
                </div>
                <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left">
                    <tbody>
                      {albumSongs.map((song, idx) => (
                        <SongRow key={song.id} song={song} idx={idx}
                          onRating={handleSongRating} onFavorite={handleSongFavorite} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const composerMap = {}
                  albumSongs.forEach(s =>
                    (s.composers || []).forEach(c => { composerMap[c.artist.id] = c.artist.name })
                  )
                  const composers = Object.values(composerMap)
                  const bandMembers = relations.filter(r => r.relation_type === 'band_member')
                  if (composers.length === 0 && bandMembers.length === 0) return null
                  return (
                    <div className="mt-5 space-y-4">
                      {composers.length > 0 && (
                        <div>
                          <h3 className="text-xs text-[#94a3b8] uppercase tracking-wider mb-2">Producción / Composición</h3>
                          <div className="flex flex-wrap gap-2">
                            {composers.map(name => (
                              <span key={name} className="px-3 py-1 bg-[#1a1a24] border border-[#2e2e4a] text-[#e2e8f0] text-sm rounded-lg">{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {bandMembers.length > 0 && (
                        <div>
                          <h3 className="text-xs text-[#94a3b8] uppercase tracking-wider mb-2">Integrantes</h3>
                          <div className="flex flex-wrap gap-2">
                            {bandMembers.map(rel => {
                              const member = rel.artist1.id === id ? rel.artist2 : rel.artist1
                              return (
                                <span key={rel.id} className="px-3 py-1 bg-[#1a1a24] border border-[#2e2e4a] text-[#e2e8f0] text-sm rounded-lg">{member.name}</span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })()
        ) : (
          <>
            {/* Top canciones */}
            {songs.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-3">Canciones</h2>
                <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left">
                    <tbody>
                      {(songs.filter(s => s.is_favorite).length > 0
                        ? songs.filter(s => s.is_favorite)
                        : songs
                      ).slice(0, 10).map((song, idx) => (
                        <SongRow key={song.id} song={song} idx={idx}
                          onRating={handleSongRating} onFavorite={handleSongFavorite} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Lista de álbumes */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Álbumes</h2>
              {albums.length === 0 ? (
                <p className="text-[#94a3b8] text-sm">Sin álbumes registrados.</p>
              ) : (
                <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-hidden">
                  {albums
                    .slice()
                    .sort((a, b) => (a.year || 9999) - (b.year || 9999))
                    .map((album, idx, arr) => (
                      <button key={album.id} onClick={() => setSelectedAlbumId(album.id)}
                        className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-[#22223a]/60 transition-colors text-left ${idx < arr.length - 1 ? 'border-b border-[#2e2e4a]' : ''}`}>
                        <div className="w-12 h-12 rounded-lg bg-[#22223a] flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {album.cover_url
                            ? <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                            : <AlbumIcon className="w-6 h-6 text-[#2e2e4a]" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-[#e2e8f0] truncate">{album.title}</p>
                          {album.year && <p className="text-xs text-[#94a3b8] mt-0.5">{album.year}</p>}
                        </div>
                        <svg className="w-4 h-4 text-[#3d3d5c] ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Relations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Relaciones</h2>
          <button onClick={() => setShowAddRelation(true)}
            className="px-3 py-1.5 bg-[#22223a] hover:bg-[#2e2e4a] text-white rounded-lg text-sm transition-colors">
            + Agregar
          </button>
        </div>

        {relations.length === 0 ? (
          <p className="text-[#94a3b8] text-sm">Sin relaciones definidas.</p>
        ) : (
          <div className="space-y-2">
            {relations.map(rel => {
              const other = rel.artist1.id === id ? rel.artist2 : rel.artist1
              const typeLabel = RELATION_TYPES.find(t => t.value === rel.relation_type)?.label || rel.relation_type
              return (
                <div key={rel.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2e2e4a] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link to={`/artists/${other.id}`} className="font-medium hover:text-purple-400 transition-colors">{other.name}</Link>
                    <span className="text-xs text-[#94a3b8] bg-[#22223a] px-2 py-0.5 rounded">{typeLabel}</span>
                  </div>
                  <button onClick={() => handleDeleteRelation(rel.id)} className="text-red-400/50 hover:text-red-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddRelation && (
        <AddRelationModal
          currentArtistId={id}
          onClose={() => setShowAddRelation(false)}
          onSaved={(rel) => { setRelations(r => [...r, rel]); setShowAddRelation(false) }}
        />
      )}

      {imageModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setImageModal(false)}>
          <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-lg h-[600px] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4">Imagen del artista</h2>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={imageSearchQuery}
                onChange={e => setImageSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !searchingImage && document.getElementById('btn-search-image').click()}
                placeholder="Buscar por nombre…"
                className="flex-1 px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
              />
              <button
                id="btn-search-image"
                disabled={searchingImage || !imageSearchQuery.trim()}
                onClick={async () => {
                  setSearchingImage(true)
                  setImageCandidates([])
                  try {
                    const results = await getArtistImageCandidates(id, imageSearchQuery.trim())
                    setImageCandidates(results)
                    if (results.length === 0) alert('No se encontraron imágenes. Intenta con otro término o pega una URL.')
                  } finally { setSearchingImage(false) }
                }}
                className="px-4 py-2 bg-[#22223a] hover:bg-[#2e2e4a] disabled:opacity-50 text-[#e2e8f0] rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                {searchingImage ? 'Buscando…' : '✦ Buscar'}
              </button>
            </div>

            {imageCandidates.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {imageCandidates.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setImageInput(url)}
                    className={`relative rounded-lg overflow-hidden aspect-square border-2 transition-all ${
                      imageInput === url ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-transparent hover:border-[#2e2e4a]'
                    }`}
                  >
                    <img src={url} alt={`opción ${i + 1}`} className="w-full h-full object-cover bg-[#22223a]"
                      onError={e => { e.target.parentElement.style.display = 'none' }} />
                    {imageInput === url && (
                      <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <input
              type="url"
              value={imageInput}
              onChange={e => setImageInput(e.target.value)}
              placeholder="O pega una URL manualmente…"
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500 mb-4"
            />

            {imageInput && (
              <img src={imageInput} alt="preview" className="w-full h-36 object-cover rounded-lg mb-4 bg-[#22223a]"
                onError={e => e.target.style.display = 'none'} />
            )}

            <div className="flex gap-3 justify-between">
              {artist.image_url && (
                <button
                  disabled={savingImage}
                  onClick={async () => {
                    setSavingImage(true)
                    try { const u = await setArtistImage(id, null); setArtist(u); setImageModal(false) }
                    finally { setSavingImage(false) }
                  }}
                  className="px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors">
                  Quitar imagen
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setImageModal(false)} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancelar</button>
                <button
                  disabled={savingImage || !imageInput.trim()}
                  onClick={async () => {
                    setSavingImage(true)
                    try { const u = await setArtistImage(id, imageInput.trim()); setArtist(u); setImageModal(false) }
                    finally { setSavingImage(false) }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  {savingImage ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddRelationModal({ currentArtistId, onClose, onSaved }) {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState([])
  const [selected, setSelected] = useState(null)
  const [relationType, setRelationType] = useState('collaborator')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (search.length < 1) { setOptions([]); return }
    import('../api/artists').then(({ getArtists }) =>
      getArtists({ search, limit: 10 }).then(d =>
        setOptions(d.items.filter(a => a.id !== currentArtistId))
      )
    )
  }, [search])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const rel = await addArtistRelation(currentArtistId, { artist2_id: selected.id, relation_type: relationType })
      onSaved(rel)
    } catch { alert('Error agregando relación') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold mb-4">Agregar Relación</h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Artista</label>
            <input value={selected ? selected.name : search} onChange={e => { setSearch(e.target.value); setSelected(null) }}
              placeholder="Buscar artista…"
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500" />
            {!selected && options.length > 0 && (
              <div className="mt-1 bg-[#22223a] border border-[#2e2e4a] rounded-lg overflow-hidden">
                {options.map(a => (
                  <button key={a.id} type="button" onMouseDown={() => { setSelected(a); setSearch(a.name) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#2e2e4a] text-[#e2e8f0] transition-colors">
                    {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Tipo de relación</label>
            <select value={relationType} onChange={e => setRelationType(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
              {RELATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={saving || !selected}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
