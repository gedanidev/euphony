import api from './client'

export const getMoods    = () => api.get('/moods').then(r => r.data)
export const createMood  = (data) => api.post('/moods', data).then(r => r.data)
export const deleteMood  = (id)   => api.delete(`/moods/${id}`)
