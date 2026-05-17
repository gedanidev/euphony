import api from './client'

const _upload = (endpoint, file, onProgress) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(endpoint, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  }).then(r => r.data)
}

export const importM3U8 = (file, onProgress) => _upload('/import/m3u8', file, onProgress)

export const importItunesXml = (file, onProgress) => _upload('/import/itunes-xml', file, onProgress)
