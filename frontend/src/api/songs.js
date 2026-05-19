import api from './client'

export const getSongs    = (params) => api.get('/songs', { params }).then(r => r.data)
export const createSong  = (data)   => api.post('/songs', data).then(r => r.data)
export const getSong     = (id)     => api.get(`/songs/${id}`).then(r => r.data)
export const updateSong  = (id, data) => api.put(`/songs/${id}`, data).then(r => r.data)
export const deleteSong  = (id)     => api.delete(`/songs/${id}`)
export const enrichSong  = (id)     => api.post(`/songs/${id}/enrich`).then(r => r.data)
export const getSongCovers = (id)   => api.get(`/songs/${id}/covers`).then(r => r.data)

// Batch
export const batchDelete       = (song_ids)              => api.post('/songs/batch/delete', { song_ids })
export const batchAvailability = (song_ids, availability) => api.post('/songs/batch/availability', { song_ids, availability })
export const batchDeleteAll    = ()                       => api.post('/songs/batch/delete-all', { confirm: 'DELETE_ALL' })

// Lyrics
export const getLyrics      = (id)         => api.get(`/songs/${id}/lyrics`).then(r => r.data)
export const saveLyrics     = (id, data)   => api.patch(`/songs/${id}/lyrics`, data)
export const fetchLyrics    = (id)         => api.post(`/songs/${id}/lyrics/fetch`).then(r => r.data)
export const uploadLyrics   = (id, file)   => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/songs/${id}/lyrics/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const downloadLyrics = (id, format) =>
  api.get(`/songs/${id}/lyrics/download`, { params: { format }, responseType: 'blob' }).then(r => r.data)

export const setSongRating  = (id, rating) => api.patch(`/songs/${id}/rating`, { rating }).then(r => r.data)
export const toggleSongFavorite = (id) => api.patch(`/songs/${id}/favorite`).then(r => r.data)
