import api from './client'

export const getArtists       = (params) => api.get('/artists', { params }).then(r => r.data)
export const createArtist     = (data)   => api.post('/artists', data).then(r => r.data)
export const getArtist        = (id)     => api.get(`/artists/${id}`).then(r => r.data)
export const updateArtist     = (id, data) => api.put(`/artists/${id}`, data).then(r => r.data)
export const deleteArtist     = (id)     => api.delete(`/artists/${id}`)
export const enrichArtist     = (id)     => api.post(`/artists/${id}/enrich`).then(r => r.data)
export const getArtistSongs   = (id, params) => api.get(`/artists/${id}/songs`, { params }).then(r => r.data)
export const getArtistRelations    = (id)  => api.get(`/artists/${id}/relations`).then(r => r.data)
export const addArtistRelation     = (id, data) => api.post(`/artists/${id}/relations`, data).then(r => r.data)
export const deleteArtistRelation  = (artistId, relId) => api.delete(`/artists/${artistId}/relations/${relId}`)

export const toggleArtistPreferred      = (id) => api.patch(`/artists/${id}/preferred`).then(r => r.data)
export const setArtistImage             = (id, image_url) => api.patch(`/artists/${id}/image`, { image_url }).then(r => r.data)
export const getArtistImageCandidates   = (id, search) => api.get(`/artists/${id}/image-candidates`, { params: search ? { search } : {} }).then(r => r.data.candidates)
