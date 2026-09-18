import { useState, useEffect } from 'react'
import { getGenreSuggestions, createGenrePlaylists } from '../api/smart_playlists'
import LoadingSpinner from './LoadingSpinner'

export default function GenrePlaylistSuggestion({ onClose, onCreated }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editedName, setEditedName] = useState('')

  useEffect(() => {
    loadSuggestions()
  }, [])

  const loadSuggestions = async () => {
    try {
      setLoading(true)
      const res = await getGenreSuggestions()
      setSuggestions(res.suggestions || [])
      setError(null)
    } catch (err) {
      setError('Error loading genre suggestions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleChecked = (index) => {
    setSuggestions(prev => prev.map((s, i) =>
      i === index ? { ...s, checked: !s.checked } : s
    ))
  }

  const startEditing = (index) => {
    setEditingIndex(index)
    setEditedName(suggestions[index].genre)
  }

  const saveEdit = () => {
    if (editingIndex === null || !editedName.trim()) return
    setSuggestions(prev => prev.map((s, i) =>
      i === editingIndex ? { ...s, genre: editedName.trim() } : s
    ))
    setEditingIndex(null)
    setEditedName('')
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditedName('')
  }

  const handleCreate = async () => {
    const selected = suggestions
      .filter(s => s.checked)
      .map(s => s.genre)

    if (selected.length === 0) {
      alert('Select at least one genre')
      return
    }

    setCreating(true)
    try {
      const result = await createGenrePlaylists({ genres: selected })
      onCreated(result)
    } catch (err) {
      alert('Error creating playlists')
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const selectedCount = suggestions.filter(s => s.checked).length

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1">Suggested Genre Playlists</h2>
        <p className="text-sm text-[#94a3b8] mb-4">
          {suggestions.length} genres found with ≥5 songs. Check any you want to create.
        </p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {suggestions.length === 0 && !error && (
          <div className="text-center py-8 text-[#94a3b8]">
            No genre suggestions available. Songs may need genre enrichment first.
          </div>
        )}

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-1 min-h-0">
          {suggestions.map((s, index) => (
            <div
              key={s.genre}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1e1e30] transition-colors group"
            >
              <input
                type="checkbox"
                checked={s.checked}
                onChange={() => toggleChecked(index)}
                className="accent-purple-500 w-4 h-4 cursor-pointer"
              />

              {editingIndex === index ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="flex-1 px-2 py-1 bg-[#0f0f13] border border-[#2e2e4a] rounded text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
                  />
                  <button onClick={saveEdit} className="text-sm text-green-400 hover:text-green-300">Save</button>
                  <button onClick={cancelEdit} className="text-sm text-[#94a3b8] hover:text-[#e2e8f0]">Cancel</button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm text-[#e2e8f0]">{s.genre}</span>
                  <span className="text-xs text-[#94a3b8] tabular-nums">{s.song_count} songs</span>
                  <button
                    onClick={() => startEditing(index)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-[#94a3b8] hover:text-purple-400 transition-opacity"
                  >
                    Rename
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-[#2e2e4a] pt-4 mt-4 flex items-center justify-between">
          <div className="text-sm text-[#94a3b8]">
            <button
              onClick={() => setSuggestions(prev => prev.map(s => ({ ...s, checked: true })))}
              className="hover:text-[#e2e8f0] mr-3"
            >
              All
            </button>
            <button
              onClick={() => setSuggestions(prev => prev.map(s => ({ ...s, checked: false })))}
              className="hover:text-[#e2e8f0] mr-3"
            >
              None
            </button>
            <span>
              {selectedCount} selected
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || selectedCount === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {creating ? 'Creating...' : `Create ${selectedCount > 0 ? selectedCount : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
