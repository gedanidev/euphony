import api from './client'

export const getGenres = () => api.get('/genres').then(r => r.data)
export const createGenre = (data) => api.post('/genres', data).then(r => r.data)
export const getGenreArtists = (genre) => api.get(`/genres/${encodeURIComponent(genre)}/artists`).then(r => r.data)
export const reassignGenre = (data) => api.patch('/genres/reassign', data)
