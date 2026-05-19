import api from './client'

export const getSmartPlaylists = () =>
  api.get('/smart-playlists').then(r => r.data)

export const createSmartPlaylist = (data) =>
  api.post('/smart-playlists', data).then(r => r.data)

export const getSmartPlaylist = (id) =>
  api.get(`/smart-playlists/${id}`).then(r => r.data)

export const updateSmartPlaylist = (id, data) =>
  api.put(`/smart-playlists/${id}`, data).then(r => r.data)

export const deleteSmartPlaylist = (id) =>
  api.delete(`/smart-playlists/${id}`)

export const previewSmartPlaylist = (data) =>
  api.post('/smart-playlists/preview', data).then(r => r.data)

export const exportSmartPlaylistM3U = async (id, name) => {
  const res = await api.get(`/smart-playlists/${id}/export/m3u`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.m3u`
  a.click()
  URL.revokeObjectURL(url)
}
