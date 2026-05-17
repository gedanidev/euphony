import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  getPlaylist, updatePlaylist, deletePlaylist,
  removeSongFromPlaylist, addSongsToPlaylist,
  reorderPlaylist, exportPlaylist,
} from '../api/playlists'
import { getSongs } from '../api/songs'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'

function fmt(seconds) {
  if (!seconds) return '--:--'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// ── Sortable row ─────────────────────────────────────────────────────────────

function SortableRow({ item, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.song.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-[#2e2e4a] hover:bg-[#22223a]/40 group text-sm">
      <td className="px-3 py-2 w-8">
        <button
          {...attributes} {...listeners}
          className="text-[#94a3b8] hover:text-purple-400 cursor-grab active:cursor-grabbing"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>
      </td>
      <td className="px-3 py-2 w-10 text-[#94a3b8] tabular-nums">{index + 1}</td>
      <td className="px-3 py-2 font-medium text-[#e2e8f0]">{item.song.title}</td>
      <td className="px-3 py-2 text-[#94a3b8]">{item.song.artist_display}</td>
      <td className="px-3 py-2 text-[#94a3b8]">{item.song.album || '—'}</td>
      <td className="px-3 py-2 text-[#94a3b8]">{item.song.year || '—'}</td>
      <td className="px-3 py-2 text-[#94a3b8] text-right tabular-nums">{fmt(item.song.duration)}</td>
      <td className="px-3 py-2 w-8">
        <button
          onClick={() => onRemove(item.song.id)}
          className="text-red-400/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

// ── Add Songs Modal ───────────────────────────────────────────────────────────

function AddSongsModal({ playlistId, existingIds, onClose, onAdded }) {
  const [songs, setSongs]     = useState([])
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSongs({ search, limit: 100 }).then(data => {
      if (!cancelled) { setSongs(data.items); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [search])

  const toggle = (id) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleAdd = async () => {
    if (!selected.size) return
    setAdding(true)
    try {
      await addSongsToPlaylist(playlistId, [...selected])
      onAdded()
    } catch { alert('Error adding songs') }
    finally { setAdding(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-[#2e2e4a] flex items-center justify-between">
          <h2 className="font-semibold">Add Songs</h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 border-b border-[#2e2e4a]">
          <input
            autoFocus
            type="text"
            placeholder="Search songs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <LoadingSpinner /> : songs.length === 0 ? (
            <div className="py-12 text-center text-[#94a3b8] text-sm">No songs found</div>
          ) : (
            <table className="w-full">
              <tbody>
                {songs.map(song => {
                  const inPl  = existingIds.has(song.id)
                  const isSel = selected.has(song.id)
                  return (
                    <tr
                      key={song.id}
                      onClick={() => !inPl && toggle(song.id)}
                      className={`border-b border-[#2e2e4a] text-sm ${inPl ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-[#22223a]/50'} ${isSel ? 'bg-purple-700/20' : ''}`}
                    >
                      <td className="px-4 py-2 w-8">
                        {inPl ? (
                          <span className="text-purple-400 text-xs">✓</span>
                        ) : (
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSel ? 'bg-purple-500 border-purple-500' : 'border-[#2e2e4a]'}`}>
                            {isSel && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                              </svg>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-medium text-[#e2e8f0]">{song.title}</td>
                      <td className="px-4 py-2 text-[#94a3b8]">{song.artist_display}</td>
                      <td className="px-4 py-2 text-[#94a3b8]">{song.album || '—'}</td>
                      <td className="px-4 py-2 text-[#94a3b8] text-right tabular-nums">{fmt(song.duration)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t border-[#2e2e4a] flex items-center justify-between">
          <span className="text-sm text-[#94a3b8]">{selected.size} selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={!selected.size || adding}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {adding ? 'Adding…' : `Add ${selected.size > 0 ? selected.size + ' ' : ''}Song${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlaylistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [playlist, setPlaylist]   = useState(null)
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState(false)
  const [editForm, setEditForm]   = useState({ name: '', description: '' })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const load = async () => {
    try {
      setLoading(true); setError(null)
      const data = await getPlaylist(id)
      setPlaylist(data)
      setItems(data.songs)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex(i => i.song.id === active.id)
    const newIdx = items.findIndex(i => i.song.id === over.id)
    const next   = arrayMove(items, oldIdx, newIdx).map((item, idx) => ({ ...item, position: idx }))
    setItems(next)
    try {
      await reorderPlaylist(id, next.map(i => ({ song_id: i.song.id, position: i.position })))
    } catch { load() }
  }

  const handleRemove = async (songId) => {
    try {
      const data = await removeSongFromPlaylist(id, songId)
      setItems(data.songs)
    } catch { alert('Error removing song') }
  }

  const handleSaveEdit = async () => {
    try {
      await updatePlaylist(id, editForm)
      setPlaylist(p => ({ ...p, ...editForm }))
      setEditing(false)
    } catch { alert('Error updating playlist') }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this playlist?')) return
    await deletePlaylist(id)
    navigate('/playlists')
  }

  const handleExport = async (format) => {
    try {
      const blob = await exportPlaylist(id, format)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${playlist.name}.${format}`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Export failed') }
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>
  if (error)   return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>

  const existingIds = new Set(items.map(i => i.song.id))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <button onClick={() => navigate('/playlists')} className="text-[#94a3b8] hover:text-white text-sm mb-3 flex items-center gap-1 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Playlists
          </button>

          {editing ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="text-2xl font-bold bg-[#1a1a24] border border-purple-500 rounded-lg px-3 py-1 text-white focus:outline-none"
              />
              <input
                value={editForm.description || ''}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                className="block text-sm bg-[#1a1a24] border border-[#2e2e4a] rounded-lg px-3 py-1 text-[#94a3b8] focus:outline-none focus:border-purple-500"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">Save</button>
                <button onClick={() => setEditing(false)} className="px-3 py-1 text-[#94a3b8] hover:text-white text-sm transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {playlist.name}
                <button
                  onClick={() => { setEditForm({ name: playlist.name, description: playlist.description || '' }); setEditing(true) }}
                  className="text-[#94a3b8] hover:text-purple-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </h1>
              {playlist.description && <p className="text-[#94a3b8] text-sm mt-1">{playlist.description}</p>}
              <p className="text-[#94a3b8] text-sm mt-1">{items.length} {items.length === 1 ? 'song' : 'songs'}</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative group">
            <button className="px-3 py-2 bg-[#1a1a24] border border-[#2e2e4a] hover:border-purple-500/50 text-[#94a3b8] hover:text-white rounded-lg text-sm transition-colors">
              Export ▾
            </button>
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a24] border border-[#2e2e4a] rounded-lg overflow-hidden hidden group-hover:block z-10 min-w-[80px]">
              <button onClick={() => handleExport('m3u')}  className="block w-full px-4 py-2 text-sm text-left hover:bg-[#22223a] text-[#e2e8f0]">M3U</button>
              <button onClick={() => handleExport('json')} className="block w-full px-4 py-2 text-sm text-left hover:bg-[#22223a] text-[#e2e8f0]">JSON</button>
              <button onClick={() => handleExport('csv')}  className="block w-full px-4 py-2 text-sm text-left hover:bg-[#22223a] text-[#e2e8f0]">CSV</button>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + Add Songs
          </button>

          <button onClick={handleDelete} className="px-3 py-2 text-red-400/50 hover:text-red-400 text-sm transition-colors">
            Delete
          </button>
        </div>
      </div>

      {/* Songs table */}
      {items.length === 0 ? (
        <EmptyState
          title="No songs in this playlist"
          description="Add songs from your library"
          action={
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors">
              Add Songs
            </button>
          }
        />
      ) : (
        <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-hidden">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2e2e4a] text-[#94a3b8] text-xs uppercase tracking-wider">
                  <th className="px-3 py-3 w-8" />
                  <th className="px-3 py-3 w-10">#</th>
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Artist</th>
                  <th className="px-3 py-3">Album</th>
                  <th className="px-3 py-3">Year</th>
                  <th className="px-3 py-3 text-right">Duration</th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <SortableContext items={items.map(i => i.song.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {items.map((item, idx) => (
                    <SortableRow key={item.song.id} item={item} index={idx} onRemove={handleRemove} />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}

      {showAdd && (
        <AddSongsModal
          playlistId={id}
          existingIds={existingIds}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load() }}
        />
      )}
    </div>
  )
}
