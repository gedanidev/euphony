import api from './client'

export const getGenres    = () => api.get('/genres').then(r => r.data)
export const createGenre  = (data) => api.post('/genres', data).then(r => r.data)
export const deleteGenre  = (id)   => api.delete(`/genres/${id}`)
