import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { previewSmartPlaylist, createSmartPlaylist, updateSmartPlaylist } from '../api/smart_playlists'

const FIELDS = [
  { value: 'artist',          labelKey: 'smartPlaylist.fields.artist',        type: 'string' },
  { value: 'album',           labelKey: 'smartPlaylist.fields.album',         type: 'string' },
  { value: 'genre',           labelKey: 'smartPlaylist.fields.genre',         type: 'string' },
  { value: 'mood',            labelKey: 'smartPlaylist.fields.mood',          type: 'string' },
  { value: 'year',            labelKey: 'smartPlaylist.fields.year',          type: 'int' },
  { value: 'availability',    labelKey: 'smartPlaylist.fields.availability',  type: 'availability' },
  { value: 'rating',          labelKey: 'smartPlaylist.fields.rating',        type: 'rating' },
  { value: 'is_favorite',     labelKey: 'smartPlaylist.fields.isFavorite',    type: 'bool' },
  { value: 'artist_preferred',labelKey: 'smartPlaylist.fields.artistPreferred', type: 'bool' },
]

const STRING_OPS = [
  { value: 'contains',     labelKey: 'smartPlaylist.ops.contains' },
  { value: 'not_contains', labelKey: 'smartPlaylist.ops.notContains' },
  { value: 'is',           labelKey: 'smartPlaylist.ops.is' },
  { value: 'is_not',       labelKey: 'smartPlaylist.ops.isNot' },
  { value: 'starts_with',  labelKey: 'smartPlaylist.ops.startsWith' },
  { value: 'ends_with',    labelKey: 'smartPlaylist.ops.endsWith' },
]

const INT_OPS = [
  { value: 'is',      labelKey: 'smartPlaylist.ops.is' },
  { value: 'is_not',  labelKey: 'smartPlaylist.ops.isNot' },
  { value: 'gt',      labelKey: 'smartPlaylist.ops.gt' },
  { value: 'lt',      labelKey: 'smartPlaylist.ops.lt' },
  { value: 'between', labelKey: 'smartPlaylist.ops.between' },
]

function getOpsForType(type) {
  if (type === 'string') return STRING_OPS
  if (type === 'int' || type === 'rating') return INT_OPS
  return []
}

function defaultCondition() {
  return { id: crypto.randomUUID(), field: 'artist', op: 'contains', value: '' }
}

function ConditionRow({ cond, onChange, onRemove, t }) {
  const fieldDef = FIELDS.find(f => f.value === cond.field) || FIELDS[0]
  const ops = getOpsForType(fieldDef.type)

  const handleFieldChange = (newField) => {
    const newDef = FIELDS.find(f => f.value === newField)
    const newOp = getOpsForType(newDef.type)[0]?.value || 'is'
    const newValue = newDef.type === 'bool' ? true
      : newDef.type === 'availability' ? 'available'
      : newDef.type === 'int' || newDef.type === 'rating' ? 0
      : ''
    onChange({ field: newField, op: newOp, value: newValue })
  }

  const handleOpChange = (newOp) => {
    const newValue = newOp === 'between' ? [cond.value || 0, cond.value || 0] : (Array.isArray(cond.value) ? cond.value[0] : cond.value)
    onChange({ ...cond, op: newOp, value: newValue })
  }

  const renderValue = () => {
    if (fieldDef.type === 'string') {
      return (
        <input
          type="text"
          value={cond.value}
          onChange={e => onChange({ ...cond, value: e.target.value })}
          className="flex-1 px-3 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
        />
      )
    }
    if ((fieldDef.type === 'int' || fieldDef.type === 'rating') && cond.op === 'between') {
      const vals = Array.isArray(cond.value) ? cond.value : [0, 0]
      return (
        <div className="flex items-center gap-2 flex-1">
          <input type="number" value={vals[0]} onChange={e => onChange({ ...cond, value: [parseInt(e.target.value) || 0, vals[1]] })}
            className="w-20 px-2 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
          <span className="text-[#94a3b8] text-sm">—</span>
          <input type="number" value={vals[1]} onChange={e => onChange({ ...cond, value: [vals[0], parseInt(e.target.value) || 0] })}
            className="w-20 px-2 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
        </div>
      )
    }
    if (fieldDef.type === 'int' || fieldDef.type === 'rating') {
      return (
        <input type="number" value={cond.value} onChange={e => onChange({ ...cond, value: parseInt(e.target.value) || 0 })}
          className="w-24 px-3 py-1.5 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500" />
      )
    }
    if (fieldDef.type === 'availability') {
      return (
        <select value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })}
          className="flex-1 px-3 py-1.5 bg-[#1e1e30] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
          <option value="available">{t('smartPlaylist.availability.available')}</option>
          <option value="wishlist">{t('smartPlaylist.availability.wishlist')}</option>
          <option value="not_available">{t('smartPlaylist.availability.notAvailable')}</option>
        </select>
      )
    }
    if (fieldDef.type === 'bool') {
      return (
        <div className="flex items-center gap-4 flex-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-sm text-[#e2e8f0]">
            <input
              type="radio"
              name={`bool-${cond.id || cond.field}`}
              value="true"
              checked={cond.value === true}
              onChange={() => onChange({ ...cond, value: true })}
              className="accent-purple-500"
            />
            {t('common.yes')}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-sm text-[#e2e8f0]">
            <input
              type="radio"
              name={`bool-${cond.id || cond.field}`}
              value="false"
              checked={cond.value === false}
              onChange={() => onChange({ ...cond, value: false })}
              className="accent-purple-500"
            />
            {t('common.no')}
          </label>
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <select value={cond.field} onChange={e => handleFieldChange(e.target.value)}
        className="w-36 px-2 py-1.5 bg-[#1e1e30] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
        {FIELDS.map(f => <option key={f.value} value={f.value}>{t(f.labelKey)}</option>)}
      </select>

      {ops.length > 0 && (
        <select value={cond.op} onChange={e => handleOpChange(e.target.value)}
          className="w-32 px-2 py-1.5 bg-[#1e1e30] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500">
          {ops.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
        </select>
      )}

      {renderValue()}

      <button onClick={onRemove} className="px-2 py-1 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors text-sm">×</button>
    </div>
  )
}

export default function SmartPlaylistBuilder({ existing, onClose, onSaved }) {
  const { t } = useTranslation()
  const [name, setName] = useState(existing?.name || '')
  const [matchAll, setMatchAll] = useState(existing?.match_all ?? true)
  const [conditions, setConditions] = useState(existing?.conditions?.length ? existing.conditions : [defaultCondition()])
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  const runPreview = useCallback(async () => {
    try {
      const res = await previewSmartPlaylist({ match_all: matchAll, conditions })
      setPreview(res.song_count)
    } catch { setPreview(null) }
  }, [matchAll, conditions])

  useEffect(() => {
    const timer = setTimeout(runPreview, 400)
    return () => clearTimeout(timer)
  }, [runPreview])

  const updateCondition = (i, updated) => {
    setConditions(prev => prev.map((c, idx) => idx === i ? { ...updated, id: c.id } : c))
  }

  const removeCondition = (i) => {
    setConditions(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const payload = { name, match_all: matchAll, conditions }
      const result = existing
        ? await updateSmartPlaylist(existing.id, payload)
        : await createSmartPlaylist(payload)
      onSaved(result)
    } catch { alert(t('smartPlaylist.saveError')) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">
          {existing ? t('smartPlaylist.edit') : t('smartPlaylist.new')}
        </h2>

        {/* Name */}
        <div className="mb-4">
          <label className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1 block">{t('common.name')}</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 bg-[#0f0f13] border border-[#2e2e4a] rounded-lg text-sm text-[#e2e8f0] focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Match toggle */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-[#94a3b8]">{t('smartPlaylist.match')}</span>
          <button
            onClick={() => setMatchAll(true)}
            className={`px-3 py-1 rounded-lg transition-colors ${matchAll ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'}`}
          >
            {t('smartPlaylist.matchAll')}
          </button>
          <button
            onClick={() => setMatchAll(false)}
            className={`px-3 py-1 rounded-lg transition-colors ${!matchAll ? 'bg-purple-600 text-white' : 'bg-[#1e1e30] text-[#94a3b8] hover:text-white'}`}
          >
            {t('smartPlaylist.matchAny')}
          </button>
        </div>

        {/* Conditions */}
        <div className="mb-2">
          <label className="text-xs text-[#94a3b8] uppercase tracking-wider mb-2 block">{t('smartPlaylist.conditions')}</label>
          {conditions.map((cond, i) => (
            <ConditionRow
              key={cond.id}
              cond={cond}
              onChange={updated => updateCondition(i, updated)}
              onRemove={() => removeCondition(i)}
              t={t}
            />
          ))}
          <button
            onClick={() => setConditions(prev => [...prev, defaultCondition()])}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors mt-1"
          >
            {t('smartPlaylist.addCondition')}
          </button>
        </div>

        {/* Preview */}
        {preview !== null && (
          <div className="my-4 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
            {t('smartPlaylist.preview', { n: preview })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
