import api from './client'

export const importM3U8 = (file, onProgress) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/import/m3u8', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  }).then(r => r.data)
}
