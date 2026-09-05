import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * ResponsiveTable - Converts table to cards on mobile
 * 
 * @param {Array} columns - Column definitions: [{ key, label, render?, className?, hideOnMobile? }]
 * @param {Array} data - Array of data items
 * @param {string} keyExtractor - Function to extract unique key from item
 * @param {ReactNode} rowActions - Actions to show per row (receives item)
 * @param {boolean} selectable - Enable row selection
 * @param {Set} selected - Set of selected IDs
 * @param {function} onSelect - Callback when row selection changes
 * @param {boolean} loading - Show loading state
 */
export default function ResponsiveTable({
  columns,
  data,
  keyExtractor,
  rowActions,
  selectable = false,
  selected = new Set(),
  onSelect,
  loading = false,
  emptyState,
  sortConfig,
  onSort,
  stickyHeader = true,
  maxHeight = 'calc(100dvh - 280px)',
  mobileCardRender,
}) {
  const [expandedRows, setExpandedRows] = useState(new Set())

  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelect?.(new Set(data.map(item => keyExtractor(item))))
    } else {
      onSelect?.(new Set())
    }
  }

  const handleSelectRow = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    onSelect?.(next)
  }

  // Mobile Card View
  const MobileCard = ({ item, index }) => {
    const id = keyExtractor(item)
    const isExpanded = expandedRows.has(id)
    const isSelected = selected.has(id)

    if (mobileCardRender) {
      return mobileCardRender({ item, isSelected, onSelect: () => handleSelectRow(id) })
    }

    // Default mobile card
    const mainCol = columns.find(c => !c.hideOnMobile) || columns[0]
    const secondaryCols = columns.filter(c => c.key !== mainCol.key && !c.hideOnMobile).slice(0, 3)

    return (
      <div className={`bg-[#13131a] border border-[#2e2e4a] rounded-xl overflow-hidden mb-3 shadow-sm ${isSelected ? 'ring-2 ring-purple-500/50 bg-purple-900/10' : ''}`}>
        {/* Main content area with better visual hierarchy */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {selectable && (
              <div className="pt-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleSelectRow(id)}
                  className="w-5 h-5 rounded border-[#2e2e4a] bg-[#0f0f13] accent-purple-600 cursor-pointer touch-target"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {/* Primary value - MUCH more prominent */}
              <div className="font-semibold text-white text-lg leading-tight truncate">
                {mainCol.render ? mainCol.render(item, index) : item[mainCol.key]}
              </div>
              {/* Secondary values - inline with better spacing */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm">
                {secondaryCols.map((col, idx) => (
                  <span key={col.key} className={`truncate ${idx === 0 ? 'text-[#e2e8f0] font-medium' : 'text-[#64748b]'}`}>
                    {idx > 0 && <span className="text-[#475569]">· </span>}
                    {col.render ? col.render(item, index) : item[col.key] || '—'}
                  </span>
                ))}
              </div>
            </div>
            {rowActions && (
              <div className="flex flex-col gap-2 -mr-1">
                {rowActions(item)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Desktop Table View
  const DesktopTable = () => (
    <div className="overflow-x-auto rounded-xl border border-[#2e2e4a]" style={{ maxHeight, overflowY: 'auto' }}>
      <table className="w-full min-w-[700px] text-left bg-[#13131a]">
        <thead className={stickyHeader ? 'sticky top-0 z-10 bg-[#1a1a24]' : 'bg-[#1a1a24]'}>
          <tr className="border-b border-[#2e2e4a] text-[#e2e8f0] text-xs uppercase tracking-wider">
            {selectable && (
              <th className="px-3 py-3.5 w-8">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-[#2e2e4a] bg-[#0f0f13] accent-purple-600 cursor-pointer touch-target"
                  checked={data.length > 0 && data.every(item => selected.has(keyExtractor(item)))}
                  onChange={handleSelectAll}
                />
              </th>
            )}
            {columns.map((col, idx) => (
              <th
                key={col.key}
                className={`px-4 py-3.5 font-semibold ${onSort && col.sortable ? 'cursor-pointer select-none hover:text-white transition-colors' : ''} ${idx === 0 ? 'text-white' : 'text-[#94a3b8]'} ${col.className || ''}`}
                onClick={() => onSort && col.sortable && onSort(col.key)}
              >
                <span className="flex items-center gap-1.5">
                  {col.label}
                  {col.sortable && sortConfig && (
                    <span className={`text-xs ${sortConfig.key === col.key ? 'text-purple-400' : 'opacity-40'}`}>
                      {sortConfig.key === col.key
                        ? (sortConfig.direction === 'asc' ? '↑' : '↓')
                        : '↕'}
                    </span>
                  )}
                </span>
              </th>
            ))}
            {rowActions && <th className="px-4 py-3.5 w-40" />}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const id = keyExtractor(item)
            const isSelected = selected.has(id)
            return (
              <tr
                key={id}
                className={`border-b border-[#2e2e4a] hover:bg-[#22223a] text-sm transition-colors ${isSelected ? 'bg-purple-900/10' : 'bg-[#13131a]'}`}
              >
                {selectable && (
                  <td className="px-3 py-3.5">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-[#2e2e4a] bg-[#0f0f13] accent-purple-600 cursor-pointer touch-target"
                      checked={isSelected}
                      onChange={() => handleSelectRow(id)}
                    />
                  </td>
                )}
                {columns.map((col, colIdx) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 ${colIdx === 0 ? 'font-semibold text-[#e2e8f0]' : 'text-[#a1afc0]'} ${col.className || ''}`}
                    data-label={col.label}
                  >
                    {col.render ? col.render(item, index) : item[col.key] || '—'}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3.5">
                    <div className="flex gap-2 justify-end">
                      {rowActions(item)}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (data.length === 0 && emptyState) {
    return emptyState
  }

  return (
    <>
      {/* Mobile View - Hidden on lg+ */}
      <div className="lg:hidden">
        <div className="space-y-3">
          {data.map((item, index) => (
            <MobileCard key={keyExtractor(item)} item={item} index={index} />
          ))}
        </div>
      </div>

      {/* Desktop View - Hidden on smaller screens */}
      <div className="hidden lg:block">
        <DesktopTable />
      </div>
    </>
  )
}
