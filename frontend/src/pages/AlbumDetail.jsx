import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getAlbum, setAlbumRating, setAlbumCover, getAlbumCoverCandidates } from '../api/albums'
import { setSongRating, toggleSongFavorite } from '../api/songs'
import RatingStars from '../components/RatingStars'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorState from '../components/ErrorState'

function fmt(seconds) {
  if (!seconds) return '--:--'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function AlbumDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [album, setAlbum] = useState(null)
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [coverModal, setCoverModal] = useState(false)
  const [coverInput, setCoverInput] = useState('')
  const [savingCover, setSavingCover] = useState(false)
  const [searchingCover, setSearchingCover] = useState(false)
  const [coverCandidates, setCoverCandidates] = useState([])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAlbum(id)
      .then(a => { setAlbum(a); setSongs(a.songs || []) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleRating = async (rating) => {
    const updated = await setAlbumRating(id, rating)
    setAlbum(a => ({ ...a, rating: updated.rating }))
  }

  const handleSongRating = async (songId, rating) => {
    await setSongRating(songId, rating)
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, rating } : s))
  }

  const handleSongFavorite = async (songId) => {
    const updated = await toggleSongFavorite(songId)
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_favorite: updated.is_favorite } : s))
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={() => window.location.reload()} /></div>
  if (!album) return null

  const totalDuration = songs.reduce((acc, s) => acc + (s.duration || 0), 0)

  return (
    <div className="p-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-white mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Álbumes
      </button>

      {/* Header */}
      <div className="flex gap-6 mb-8 items-end">
        <button
          onClick={() => { setCoverInput(album.cover_url || ''); setCoverCandidates([]); setCoverModal(true) }}
          className="w-32 h-32 flex-shrink-0 rounded-xl bg-[#22223a] flex items-center justify-center overflow-hidden shadow-xl group relative"
          title="Cambiar portada"
        >
          {album.cover_url ? (
            <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-14 h-14 text-[#2e2e4a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </button>

        <div className="min-w-0">
          <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1">Álbum</p>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">{album.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#94a3b8]">
            {album.artist && (
              <Link
                to={`/artists/${album.artist.id}`}
                className="text-purple-400 hover:text-purple-300 transition-colors font-medium"
              >
                {album.artist.name}
              </Link>
            )}
            {album.artist && album.year && <span>·</span>}
            {album.year && <span>{album.year}</span>}
            {songs.length > 0 && (
              <>
                <span>·</span>
                <span>{songs.length} canciones</span>
                {totalDuration > 0 && (
                  <>
                    <span>·</span>
                    <span>{fmt(totalDuration)}</span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="mt-3">
            <RatingStars rating={album.rating} onChange={handleRating} />
          </div>
        </div>
      </div>

      {/* Songs table */}
      {songs.length > 0 ? (
        <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-[#2e2e4a] text-[#94a3b8] text-xs uppercase tracking-wider">
                <th className="px-4 py-3 w-10 text-right">#</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Artistas</th>
                <th className="px-4 py-3 text-right">Duración</th>
                <th className="px-3 py-3" />
                <th className="px-3 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {songs.map((song, idx) => (
                <tr key={song.id} className="border-b border-[#2e2e4a] hover:bg-[#22223a]/40 text-sm group">
                  <td className="px-4 py-2.5 text-right text-[#94a3b8] tabular-nums w-10">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-[#e2e8f0]">
                    {song.title}
                    {song.artists?.filter(a => a.role === 'colaborador').length > 0 && (
                      <span className="text-[#94a3b8] text-xs font-normal ml-1.5">
                        feat. {song.artists.filter(a => a.role === 'colaborador').map(a => a.artist.name).join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[#94a3b8]">
                    {song.artists?.filter(a => a.role === 'principal').map((sa, i) => (
                      <span key={sa.artist.id}>
                        {i > 0 && <span className="text-[#3d3d5c]">, </span>}
                        <Link to={`/artists/${sa.artist.id}`} className="hover:text-purple-400 transition-colors">
                          {sa.artist.name}
                        </Link>
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-2.5 text-[#94a3b8] text-right tabular-nums">{fmt(song.duration)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <RatingStars rating={song.rating} onChange={r => handleSongRating(song.id, r)} compact />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => handleSongFavorite(song.id)}
                      className={`text-lg transition-colors ${song.is_favorite ? 'text-pink-500' : 'text-[#3d3d5c] hover:text-pink-400'}`}
                    >
                      {song.is_favorite ? '♥' : '♡'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[#94a3b8] text-sm">Este álbum no tiene canciones registradas.</p>
      )}

      {/* Créditos e Integrantes */}
      {(() => {
        const composerMap = {}
        songs.forEach(s =>
          (s.composers || []).forEach(c => { composerMap[c.artist.id] = c.artist.name })
        )
        const composers = Object.values(composerMap)
        const bandMembers = album.band_members || []
        if (composers.length === 0 && bandMembers.length === 0) return null
        return (
          <div className="mt-6 space-y-5">
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
                    const member = rel.artist1.id === album.artist?.id ? rel.artist2 : rel.artist1
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

      {coverModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setCoverModal(false)}>
          <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4">Portada del álbum</h2>

            {/* Buscar opciones */}
            <button
              disabled={searchingCover}
              onClick={async () => {
                setSearchingCover(true)
                setCoverCandidates([])
                try {
                  const results = await getAlbumCoverCandidates(id)
                  setCoverCandidates(results)
                  if (results.length === 0) alert('No se encontraron portadas. Puedes pegar una URL manualmente.')
                } finally { setSearchingCover(false) }
              }}
              className="w-full mb-4 px-4 py-2 bg-[#22223a] hover:bg-[#2e2e4a] disabled:opacity-50 text-[#e2e8f0] rounded-lg text-sm transition-colors"
            >
              {searchingCover ? 'Buscando…' : '✦ Buscar portadas automáticamente'}
            </button>

            {/* Grid de candidatos */}
            {coverCandidates.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {coverCandidates.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setCoverInput(url)}
                    className={`relative rounded-lg overflow-hidden aspect-square border-2 transition-all ${
                      coverInput === url ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-transparent hover:border-[#2e2e4a]'
                    }`}
                  >
                    <img src={url} alt={`opción ${i + 1}`} className="w-full h-full object-cover bg-[#22223a]"
                      onError={e => { e.target.parentElement.style.display = 'none' }} />
                    {coverInput === url && (
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

            {/* URL manual */}
            <input
              type="url"
              value={coverInput}
              onChange={e => setCoverInput(e.target.value)}
              placeholder="O pega una URL manualmente…"
              className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-purple-500 mb-4"
            />

            {/* Preview de la selección */}
            {coverInput && (
              <img src={coverInput} alt="preview" className="w-full h-36 object-cover rounded-lg mb-4 bg-[#22223a]"
                onError={e => e.target.style.display = 'none'} />
            )}

            <div className="flex gap-3 justify-between">
              {album.cover_url && (
                <button
                  disabled={savingCover}
                  onClick={async () => {
                    setSavingCover(true)
                    try { const u = await setAlbumCover(id, null); setAlbum(u); setCoverModal(false) }
                    finally { setSavingCover(false) }
                  }}
                  className="px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors">
                  Quitar portada
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setCoverModal(false)} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancelar</button>
                <button
                  disabled={savingCover || !coverInput.trim()}
                  onClick={async () => {
                    setSavingCover(true)
                    try { const u = await setAlbumCover(id, coverInput.trim()); setAlbum(u); setCoverModal(false) }
                    finally { setSavingCover(false) }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  {savingCover ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
