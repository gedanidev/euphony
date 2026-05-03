import api from './client'

export const getPlaylists         = (params)          => api.get('/playlists', { params }).then(r => r.data)
export const createPlaylist       = (data)             => api.post('/playlists', data).then(r => r.data)
export const getPlaylist          = (id)               => api.get(`/playlists/${id}`).then(r => r.data)
export const updatePlaylist       = (id, data)         => api.put(`/playlists/${id}`, data).then(r => r.data)
export const deletePlaylist       = (id)               => api.delete(`/playlists/${id}`)
export const addSongsToPlaylist   = (id, song_ids)     => api.post(`/playlists/${id}/songs`, { song_ids }).then(r => r.data)
export const removeSongFromPlaylist = (id, song_id)    => api.delete(`/playlists/${id}/songs/${song_id}`).then(r => r.data)
export const reorderPlaylist      = (id, order)        => api.patch(`/playlists/${id}/reorder`, { order }).then(r => r.data)
export const exportPlaylist       = (id, format)       => api.get(`/playlists/${id}/export`, { params: { format }, responseType: 'blob' }).then(r => r.data)
