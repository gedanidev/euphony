import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getArtist, updateArtist, enrichArtist, getArtistSongs, getArtistRelations, addArtistRelation, deleteArtistRelation } from '../api/artists'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorState from '../components/ErrorState'

function fmt(seconds) {
  if (!seconds) return '--:--'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const ROLE_TABS = [
  { key: null, label: 'Todas' },
  { key: 'principal', label: 'Intérprete principal' },
  { key: 'colaborador', label: 'Colaborador' },
  { key: 'composer', label: 'Compositor' },
]

const RELATION_TYPES = [
  { value: 'band_member', label: 'Miembro de banda' },
  { value: 'collaborator', label: 'Colaborador frecuente' },
  { value: 'solo_project', label: 'Proyecto solista' },
]

export default function ArtistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [artist, setArtist] = useState(null)
  const [songs, setSongs] = useState([])
  const [relations, setRelations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [roleTab, setRoleTab] = useState(null)
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
      const params = roleTab ? { role: roleTab } : {}
      const data = await getArtistSongs(id, params)
      setSongs(data)
    } catch { setSongs([]) }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { if (artist) loadSongs() }, [artist, roleTab])

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
        <div className="w-28 h-28 rounded-xl bg-[#22223a] flex-shrink-0 flex items-center justify-center overflow-hidden">
          {artist.image_url ? (
            <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-12 h-12 text-[#2e2e4a]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          )}
        </div>

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
              <h1 className="text-3xl font-bold mb-1">{artist.name}</h1>
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

      {/* Songs */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Canciones</h2>
        <div className="flex gap-1 mb-4">
          {ROLE_TABS.map(tab => (
            <button key={String(tab.key)} onClick={() => setRoleTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${roleTab === tab.key
                ? 'bg-purple-600 text-white' : 'text-[#94a3b8] hover:text-white hover:bg-[#22223a]'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {songs.length === 0 ? (
          <p className="text-[#94a3b8] text-sm">Sin canciones en esta categoría.</p>
        ) : (
          <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2e2e4a] text-[#94a3b8] text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Artistas</th>
                  <th className="px-4 py-3">Álbum</th>
                  <th className="px-4 py-3 text-right">Duración</th>
                </tr>
              </thead>
              <tbody>
                {songs.map(song => (
                  <tr key={song.id} className="border-b border-[#2e2e4a] hover:bg-[#22223a]/40 text-sm">
                    <td className="px-4 py-2 font-medium text-[#e2e8f0]">{song.title}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">
                      {song.artists.map((sa, i) => (
                        <span key={sa.artist.id}>
                          {i > 0 && ', '}
                          <Link to={`/artists/${sa.artist.id}`}
                            className="hover:text-purple-400 transition-colors"
                            onClick={e => e.stopPropagation()}>
                            {sa.artist.name}
                          </Link>
                          {sa.role !== 'principal' && <span className="text-xs text-[#64748b] ml-1">({sa.role})</span>}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2 text-[#94a3b8]">{song.album?.title || '—'}</td>
                    <td className="px-4 py-2 text-[#94a3b8] text-right tabular-nums">{fmt(song.duration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
