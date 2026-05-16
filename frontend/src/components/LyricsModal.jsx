import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getLyrics, saveLyrics, fetchLyrics, uploadLyrics, downloadLyrics } from '../api/songs'

export default function LyricsModal({ song, onClose }) {
  const { t } = useTranslation()
  const [data, setData] = useState({ lyrics: '', lyrics_lrc: '', has_plain: false, has_synced: false })
  const [tab, setTab] = useState('lrc') // 'lrc' | 'txt'
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'ok'|'error', msg }
  const fileRef = useRef()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const d = await getLyrics(song.id)
      setData(d)
      // Default to whichever tab has content
      if (d.has_synced) setTab('lrc')
      else if (d.has_plain) setTab('txt')
    } catch {
      setStatus({ type: 'error', msg: t('common.error') })
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    setEditValue(tab === 'lrc' ? (data.lyrics_lrc || '') : (data.lyrics || ''))
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = tab === 'lrc'
        ? { lyrics_lrc: editValue }
        : { lyrics: editValue }
      await saveLyrics(song.id, body)
      const d = await getLyrics(song.id)
      setData(d)
      setEditing(false)
      setStatus({ type: 'ok', msg: t('lyrics.saved') })
    } catch {
      setStatus({ type: 'error', msg: t('common.error') })
    } finally {
      setSaving(false)
    }
  }

  async function handleFetch() {
    setFetching(true)
    setStatus(null)
    try {
      const d = await fetchLyrics(song.id)
      setData(d)
      if (d.has_synced) setTab('lrc')
      else if (d.has_plain) setTab('txt')
      setStatus({ type: 'ok', msg: t('lyrics.fetchedOk') })
    } catch (e) {
      const msg = e.response?.data?.detail || t('lyrics.fetchFailed')
      setStatus({ type: 'error', msg })
    } finally {
      setFetching(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus(null)
    try {
      await uploadLyrics(song.id, file)
      const d = await getLyrics(song.id)
      setData(d)
      const isLrc = file.name.toLowerCase().endsWith('.lrc')
      setTab(isLrc ? 'lrc' : 'txt')
      setStatus({ type: 'ok', msg: t('lyrics.uploadedOk') })
    } catch (e) {
      setStatus({ type: 'error', msg: e.response?.data?.detail || t('common.error') })
    }
    fileRef.current.value = ''
  }

  async function handleDownload(format) {
    try {
      const blob = await downloadLyrics(song.id, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${song.title}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setStatus({ type: 'error', msg: e.response?.data?.detail || t('lyrics.noContent') })
    }
  }

  const currentContent = tab === 'lrc' ? data.lyrics_lrc : data.lyrics

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#2e2e4a] flex-shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{song.title}</h2>
            <p className="text-xs text-[#94a3b8] truncate">{song.artist_display}</p>
          </div>
          <button onClick={onClose} className="ml-4 text-[#94a3b8] hover:text-white flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2e2e4a] flex-shrink-0 flex-wrap">
          {/* Tabs */}
          <div className="flex rounded-lg bg-[#0f0f13] p-0.5 mr-2">
            <button
              onClick={() => { setTab('lrc'); setEditing(false) }}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === 'lrc' ? 'bg-purple-700 text-white' : 'text-[#94a3b8] hover:text-white'}`}
            >
              LRC {data.has_synced && <span className="ml-1 text-green-400">●</span>}
            </button>
            <button
              onClick={() => { setTab('txt'); setEditing(false) }}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tab === 'txt' ? 'bg-purple-700 text-white' : 'text-[#94a3b8] hover:text-white'}`}
            >
              TXT {data.has_plain && <span className="ml-1 text-green-400">●</span>}
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {fetching ? t('lyrics.fetching') : t('lyrics.fetchLrclib')}
          </button>

          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22223a] hover:bg-[#2e2e4a] text-[#e2e8f0] text-xs rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {t('common.edit')}
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22223a] hover:bg-[#2e2e4a] text-[#e2e8f0] text-xs rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {t('lyrics.upload')}
          </button>
          <input ref={fileRef} type="file" accept=".lrc,.txt" className="hidden" onChange={handleUpload} />

          <div className="ml-auto flex gap-1.5">
            {(data.has_synced || data.has_plain) && (
              <>
                {data.has_synced && (
                  <button
                    onClick={() => handleDownload('lrc')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#22223a] hover:bg-[#2e2e4a] text-[#94a3b8] text-xs rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    .lrc
                  </button>
                )}
                {data.has_plain && (
                  <button
                    onClick={() => handleDownload('txt')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#22223a] hover:bg-[#2e2e4a] text-[#94a3b8] text-xs rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    .txt
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className={`mx-5 mt-3 px-3 py-2 rounded-lg text-xs flex-shrink-0 ${status.type === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {status.msg}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-5">
          {loading ? (
            <div className="flex-1 bg-[#22223a] rounded-lg animate-pulse" />
          ) : editing ? (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <textarea
                className="flex-1 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg p-3 text-sm text-[#e2e8f0] font-mono resize-none focus:outline-none focus:border-purple-500"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                placeholder={tab === 'lrc' ? '[00:00.00] ...' : t('lyrics.plainPlaceholder')}
              />
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-[#22223a] hover:bg-[#2e2e4a] text-[#e2e8f0] text-sm rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : currentContent ? (
            <pre className="flex-1 overflow-y-auto text-sm text-[#e2e8f0] font-mono whitespace-pre-wrap leading-relaxed">
              {currentContent}
            </pre>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8] gap-3">
              <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">{t('lyrics.noContent')}</p>
              <p className="text-xs">{t('lyrics.noContentHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
