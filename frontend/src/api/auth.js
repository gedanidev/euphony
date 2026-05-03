import api from './client'

export const getSpotifyLoginUrl  = () => api.get('/auth/spotify/login').then(r => r.data)
export const getSpotifyStatus    = () => api.get('/auth/spotify/status').then(r => r.data)
export const syncSpotify         = () => api.post('/auth/spotify/sync').then(r => r.data)
