import api from './client'

export const enrichAllAlbums = () =>
  api.post('/albums/enrich-all').then(r => r.data)

export const enrichAllAlbumsStatus = (jobId) =>
  api.get(`/albums/enrich-all/status/${jobId}`).then(r => r.data)

export const enrichAllArtists = () =>
  api.post('/artists/enrich-all').then(r => r.data)

export const enrichAllArtistsStatus = (jobId) =>
  api.get(`/artists/enrich-all/status/${jobId}`).then(r => r.data)

export const cancelEnrichAlbums = (jobId) =>
  api.post(`/albums/enrich-all/cancel/${jobId}`).then(r => r.data)

export const cancelEnrichArtists = (jobId) =>
  api.post(`/artists/enrich-all/cancel/${jobId}`).then(r => r.data)
