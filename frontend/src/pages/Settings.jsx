import { useState, useEffect } from 'react'
import { getSpotifyLoginUrl, getSpotifyStatus, syncSpotify } from '../api/auth'

export default function Settings() {
  const [spotifyConn, setSpotifyConn] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [connecting, setConnecting] = useState(false)

  // Check URL params for connection result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('spotify') === 'connected') {
      // Clean URL
      window.history.replaceState({}, '', '/settings')
      loadStatus()
    } else {
      loadStatus()
    }
  }, [])

  const loadStatus = async () => {
    setLoadingStatus(true)
    try {
      const conn = await getSpotifyStatus()
      setSpotifyConn(conn)
    } catch {
      setSpotifyConn(null)
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { auth_url } = await getSpotifyLoginUrl()
      window.location.href = auth_url
    } catch (e) {
      alert(e.response?.data?.detail || 'Error conectando con Spotify. ¿Están configuradas las credenciales en el servidor?')
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const result = await syncSpotify()
      setSyncResult(result)
    } catch (e) {
      alert(e.response?.data?.detail || 'Error sincronizando')
    } finally { setSyncing(false) }
  }

  const formatExpiry = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Configuración</h1>

      {/* Spotify */}
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#1DB954]/10 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold">Spotify</h2>
            <p className="text-xs text-[#94a3b8]">Importa tu historial de escucha</p>
          </div>
          {!loadingStatus && (
            <div className="ml-auto">
              {spotifyConn ? (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg">Conectado</span>
              ) : (
                <span className="px-2 py-1 bg-[#22223a] text-[#94a3b8] text-xs rounded-lg">No conectado</span>
              )}
            </div>
          )}
        </div>

        {loadingStatus ? (
          <div className="h-8 bg-[#22223a] rounded animate-pulse" />
        ) : spotifyConn ? (
          <div className="space-y-3">
            {spotifyConn.expires_at && (
              <p className="text-xs text-[#94a3b8]">Token expira: {formatExpiry(spotifyConn.expires_at)}</p>
            )}
            <button onClick={handleSync} disabled={syncing}
              className="px-4 py-2 bg-[#1DB954] hover:bg-[#1aa34a] disabled:opacity-50 text-black font-medium rounded-lg text-sm transition-colors">
              {syncing ? 'Sincronizando…' : '↻ Sincronizar últimas escuchadas'}
            </button>
            {syncResult && (
              <div className="bg-[#0f0f13] rounded-lg p-3 text-sm">
                <p className="text-green-400">✓ Sincronización completada</p>
                <p className="text-[#94a3b8] text-xs mt-1">
                  {syncResult.songs_created} canciones creadas · {syncResult.songs_matched} ya existían · {syncResult.history_entries_added} historial
                </p>
              </div>
            )}
            <button onClick={handleConnect} className="text-xs text-[#94a3b8] hover:text-white transition-colors">
              Reconectar cuenta
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#94a3b8]">
              Conecta tu cuenta de Spotify para importar automáticamente las últimas 50 canciones escuchadas a tu historial.
            </p>
            <button onClick={handleConnect} disabled={connecting}
              className="px-4 py-2 bg-[#1DB954] hover:bg-[#1aa34a] disabled:opacity-50 text-black font-medium rounded-lg text-sm transition-colors">
              {connecting ? 'Redirigiendo…' : 'Conectar con Spotify'}
            </button>
            <p className="text-xs text-[#94a3b8]">
              Requiere <code className="bg-[#22223a] px-1 rounded">SPOTIFY_CLIENT_ID</code> y <code className="bg-[#22223a] px-1 rounded">SPOTIFY_CLIENT_SECRET</code> configurados en el servidor.
            </p>
          </div>
        )}
      </div>

      {/* MusicBrainz info */}
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
            <span className="text-purple-400 font-bold text-sm">MB</span>
          </div>
          <div>
            <h2 className="font-semibold">MusicBrainz / LRCLIB</h2>
            <p className="text-xs text-[#94a3b8]">Enriquecimiento de metadata</p>
          </div>
          <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg">Disponible</span>
        </div>
        <p className="text-sm text-[#94a3b8]">
          No requiere configuración. Usa el botón <span className="text-blue-400">✦</span> en cada canción o artista para obtener metadata automáticamente desde MusicBrainz y letras sincronizadas desde LRCLIB.
        </p>
      </div>
    </div>
  )
}
