import { useState, useRef } from 'react'
import { importM3U8 } from '../api/import'

export default function Import() {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showFailed, setShowFailed] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true); setResult(null); setError(null)
    try {
      const summary = await importM3U8(file)
      setResult(summary)
      setFile(null)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Error importando')
    } finally { setLoading(false) }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Importar Playlist</h1>
      <p className="text-[#94a3b8] text-sm mb-8">
        Sube un archivo M3U/M3U8 para importar canciones a tu biblioteca. Se crearán automáticamente artistas y canciones nuevas. Las existentes quedarán vinculadas.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          dragging ? 'border-purple-500 bg-purple-500/10' : file ? 'border-green-500/50 bg-green-500/5' : 'border-[#2e2e4a] hover:border-purple-500/50 hover:bg-[#22223a]/50'
        }`}
      >
        <input ref={inputRef} type="file" accept=".m3u,.m3u8" className="hidden" onChange={e => setFile(e.target.files[0])} />

        {file ? (
          <div>
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-medium text-[#e2e8f0]">{file.name}</p>
            <p className="text-xs text-[#94a3b8] mt-1">{(file.size / 1024).toFixed(1)} KB — haz clic para cambiar</p>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 bg-[#22223a] rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="font-medium text-[#e2e8f0]">Arrastra tu archivo M3U/M3U8 aquí</p>
            <p className="text-xs text-[#94a3b8] mt-1">o haz clic para seleccionar</p>
          </div>
        )}
      </div>

      {file && (
        <button onClick={handleImport} disabled={loading}
          className="mt-4 w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors">
          {loading ? 'Importando…' : 'Importar Playlist'}
        </button>
      )}

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6">
          <h2 className="font-semibold mb-4">Resultado de importación</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-400">{result.created}</p>
              <p className="text-xs text-[#94a3b8] mt-1">Canciones creadas</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-400">{result.matched}</p>
              <p className="text-xs text-[#94a3b8] mt-1">Ya existían</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-bold ${result.failed > 0 ? 'text-red-400' : 'text-[#94a3b8]'}`}>{result.failed}</p>
              <p className="text-xs text-[#94a3b8] mt-1">Fallidas</p>
            </div>
          </div>

          {result.failed_lines?.length > 0 && (
            <div>
              <button onClick={() => setShowFailed(!showFailed)}
                className="text-sm text-[#94a3b8] hover:text-white transition-colors">
                {showFailed ? '▼' : '▶'} Ver líneas con error ({result.failed_lines.length})
              </button>
              {showFailed && (
                <div className="mt-2 bg-[#0f0f13] rounded-lg p-3 max-h-40 overflow-y-auto">
                  {result.failed_lines.map((line, i) => (
                    <p key={i} className="text-xs text-red-400/70 font-mono">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={() => setResult(null)}
            className="mt-4 px-4 py-2 bg-[#22223a] hover:bg-[#2e2e4a] text-white rounded-lg text-sm transition-colors">
            Importar otra playlist
          </button>
        </div>
      )}

      {/* Format reference */}
      <div className="mt-8 bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-4">
        <p className="text-xs text-[#94a3b8] font-semibold uppercase tracking-wider mb-2">Formato esperado</p>
        <pre className="text-xs text-[#64748b] font-mono leading-relaxed">{`#EXTM3U
#EXTINF:245,Lady Gaga - Die with a Smile
/Walkman/Music/lady_gaga_die_with_a_smile.mp3
#EXTINF:183,Bruno Mars - Just the Way You Are
/Walkman/Music/bruno_mars_just_the_way.mp3`}</pre>
      </div>
    </div>
  )
}
