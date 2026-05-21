import { useState, useEffect, useRef } from 'react'
import { updateSong, getGenresUsed, getSubgenresUsed } from '../api/songs'

const VOCAL_OPTIONS = [
  { value: null,           label: 'No especificado' },
  { value: 'vocal',        label: 'Vocal' },
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'a_capella',    label: 'A capella' },
]

export default function SongEditModal({ song, onClose, onSaved }) {
  const [title, setTitle] = useState(song.title)
  const [primaryGenre, setPrimaryGenre] = useState(song.primary_genre || '')
  const [subgenres, setSubgenres] = useState(song.subgenres || [])
  const [vocalType, setVocalType] = useState(song.vocal_type ?? null)
  const [subgenreInput, setSubgenreInput] = useState('')
  const [genreOptions, setGenreOptions] = useState([])
  const [subgenreOptions, setSubgenreOptions] = useState([])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    getGenresUsed().then(setGenreOptions).catch(() => {})
    getSubgenresUsed().then(setSubgenreOptions).catch(() => {})
  }, [])

  const addSubgenre = (value) => {
    const v = value.trim()
    if (!v || subgenres.includes(v)) return
    setSubgenres(prev => [...prev, v])
    setSubgenreInput('')
  }

  const removeSubgenre = (sg) => {
    setSubgenres(prev => prev.filter(s => s !== sg))
  }

  const handleSubgenreKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSubgenre(subgenreInput)
    }
    if (e.key === 'Backspace' && subgenreInput === '' && subgenres.length > 0) {
      setSubgenres(prev => prev.slice(0, -1))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateSong(song.id, {
        title: title.trim(),
        primary_genre: primaryGenre.trim() || null,
        subgenres,
        vocal_type: vocalType,
      })
      onSaved(updated)
    } catch { alert('Error guardando canción') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Editar canción</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Título */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Título</label>
            <input
              autoFocus required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Género principal */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Género principal</label>
            <input
              list="genre-options"
              value={primaryGenre}
              onChange={e => setPrimaryGenre(e.target.value)}
              placeholder="Metal, Pop, Jazz…"
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500"
            />
            <datalist id="genre-options">
              {genreOptions.map(g => <option key={g} value={g} />)}
            </datalist>
          </div>

          {/* Subgéneros */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-1 block uppercase tracking-wider">Subgéneros</label>
            <div
              className="min-h-[40px] px-2 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg flex flex-wrap gap-1.5 cursor-text"
              onClick={() => inputRef.current?.focus()}
            >
              {subgenres.map(sg => (
                <span key={sg} className="flex items-center gap-1 px-2 py-0.5 bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs rounded-full">
                  {sg}
                  <button type="button" onClick={() => removeSubgenre(sg)} className="text-purple-400 hover:text-white transition-colors leading-none">×</button>
                </span>
              ))}
              <input
                ref={inputRef}
                list="subgenre-options"
                value={subgenreInput}
                onChange={e => setSubgenreInput(e.target.value)}
                onKeyDown={handleSubgenreKey}
                onBlur={() => { if (subgenreInput.trim()) addSubgenre(subgenreInput) }}
                placeholder={subgenres.length === 0 ? 'Escribe y presiona Enter…' : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none"
              />
            </div>
            <datalist id="subgenre-options">
              {subgenreOptions.filter(s => !subgenres.includes(s)).map(s => <option key={s} value={s} />)}
            </datalist>
            <p className="text-xs text-[#94a3b8] mt-1">Escribe y presiona Enter para agregar. Click en chip para eliminar.</p>
          </div>

          {/* Tipo vocal */}
          <div>
            <label className="text-xs text-[#94a3b8] mb-2 block uppercase tracking-wider">Tipo vocal</label>
            <div className="flex gap-1">
              {VOCAL_OPTIONS.map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setVocalType(opt.value)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                    vocalType === opt.value
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-[#0f0f13] border-[#2e2e4a] text-[#94a3b8] hover:text-white hover:border-purple-500/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
