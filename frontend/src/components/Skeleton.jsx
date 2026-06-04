/**
 * Skeleton loading component for consistent loading states
 * Provides visual placeholders while content is loading
 */

export function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i}
          className="h-4 bg-[#2e2e4a] rounded animate-pulse"
          style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ count = 1, className = '' }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[#1a1a24] border border-[#2e2e4a] rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#2e2e4a] rounded-full animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-4 bg-[#2e2e4a] rounded w-3/4 mb-2 animate-pulse" />
              <div className="h-3 bg-[#2e2e4a] rounded w-1/2 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, columns = 4, className = '' }) {
  return (
    <div className={`w-full overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex gap-4 p-3 border-b border-[#2e2e4a]">
        {Array.from({ length: columns }).map((_, i) => (
          <div 
            key={i} 
            className="h-4 bg-[#2e2e4a] rounded animate-pulse"
            style={{ flex: i === 0 ? 2 : 1 }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b border-[#2e2e4a]/50">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div 
              key={colIndex}
              className="h-4 bg-[#2e2e4a] rounded animate-pulse"
              style={{ 
                flex: colIndex === 0 ? 2 : 1,
                animationDelay: `${rowIndex * 100}ms`
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 6, className = '' }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square bg-[#2e2e4a] rounded-lg mb-3" />
          <div className="h-4 bg-[#2e2e4a] rounded w-3/4 mb-2" />
          <div className="h-3 bg-[#2e2e4a] rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonPlaylist({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a24] border border-[#2e2e4a]">
          <div className="w-10 h-10 bg-[#2e2e4a] rounded-lg animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-4 bg-[#2e2e4a] rounded w-2/3 mb-2 animate-pulse" />
            <div className="h-3 bg-[#2e2e4a] rounded w-1/3 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Full page skeleton for detail pages
export function SkeletonDetail({ hasHeader = true, hasImage = true }) {
  return (
    <div className="animate-pulse space-y-6">
      {hasHeader && (
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#2e2e4a] rounded-lg" />
          <div className="h-6 bg-[#2e2e4a] rounded w-48" />
        </div>
      )}
      
      <div className="flex gap-6 flex-col sm:flex-row">
        {hasImage && (
          <div className="w-32 h-32 bg-[#2e2e4a] rounded-xl flex-shrink-0" />
        )}
        <div className="flex-1 space-y-4">
          <div className="h-8 bg-[#2e2e4a] rounded w-3/4" />
          <div className="h-4 bg-[#2e2e4a] rounded w-1/2" />
          <div className="flex gap-3 pt-4">
            <div className="h-10 bg-[#2e2e4a] rounded-lg w-24" />
            <div className="h-10 bg-[#2e2e4a] rounded-lg w-24" />
          </div>
        </div>
      </div>
      
      <div className="space-y-3 pt-4">
        <SkeletonTable rows={4} />
      </div>
    </div>
  )
}

export default {
  Text: SkeletonText,
  Card: SkeletonCard,
  Table: SkeletonTable,
  Grid: SkeletonGrid,
  Playlist: SkeletonPlaylist,
  Detail: SkeletonDetail,
}
