import api from './client'

export const getAlbums    = (params) => api.get('/albums', { params }).then(r => r.data)
export const createAlbum  = (data)   => api.post('/albums', data).then(r => r.data)
export const getAlbum     = (id)     => api.get(`/albums/${id}`).then(r => r.data)
export const updateAlbum  = (id, data) => api.put(`/albums/${id}`, data).then(r => r.data)
export const deleteAlbum  = (id)     => api.delete(`/albums/${id}`)
export const enrichAlbum  = (id)     => api.post(`/albums/${id}/enrich`).then(r => r.data)
