import api from './client'

export const getAlbums    = (params) => api.get('/albums', { params }).then(r => r.data)
export const createAlbum  = (data)   => api.post('/albums', data).then(r => r.data)
export const getAlbum     = (id)     => api.get(`/albums/${id}`).then(r => r.data)
export const updateAlbum  = (id, data) => api.put(`/albums/${id}`, data).then(r => r.data)
export const deleteAlbum  = (id)     => api.delete(`/albums/${id}`)
export const enrichAlbum  = (id)     => api.post(`/albums/${id}/enrich`).then(r => r.data)

export const setAlbumRating       = (id, rating)    => api.patch(`/albums/${id}/rating`, { rating }).then(r => r.data)
export const setAlbumCover        = (id, cover_url) => api.patch(`/albums/${id}/cover`, { cover_url }).then(r => r.data)
export const getAlbumCoverCandidates = (id)         => api.get(`/albums/${id}/cover-candidates`).then(r => r.data.candidates)
