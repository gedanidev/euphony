import api from './client'

export const walkmanSync = (file, clearUnlinked = false) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/songs/walkman-sync?clear_unlinked=${clearUnlinked}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const createWishlistItem = (data) =>
  api.post('/songs/wishlist', data).then(r => r.data)
