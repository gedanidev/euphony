import api from './client'

export const getSpotifyLoginUrl  = () => api.get('/auth/spotify/login').then(r => r.data)
export const getSpotifyStatus    = () => api.get('/auth/spotify/status').then(r => r.data)
export const syncSpotify         = () => api.post('/auth/spotify/sync').then(r => r.data)
export const getSpotifyHistory   = () => api.get('/auth/spotify/history').then(r => r.data)
export const addToLibrary        = (spotifyTrackId, availability) =>
  api.post('/auth/spotify/history/add-to-library', null, {
    params: { spotify_track_id: spotifyTrackId, availability }
  }).then(r => r.data)
