import api from './client'

export const getSongs    = (params) => api.get('/songs', { params }).then(r => r.data)
export const createSong  = (data)   => api.post('/songs', data).then(r => r.data)
export const getSong     = (id)     => api.get(`/songs/${id}`).then(r => r.data)
export const updateSong  = (id, data) => api.put(`/songs/${id}`, data).then(r => r.data)
export const deleteSong  = (id)     => api.delete(`/songs/${id}`)
