import { useState } from 'react'
import { Star } from 'lucide-react'

/**
 * RatingStars - Improved touch targets and accessibility
 * rating: 1–10 or null
 * onChange(newRating): called with 1–10 or null (cleared)
 * compact: if true, hide the number input
 * size: 'sm' | 'md' | 'lg' - default 'md'
 * readOnly: if true, disable interactions
 */
export default function RatingStars({ 
  rating, 
  onChange, 
  compact = false,
  size = 'md',
  readOnly = false,
  className = ''
}) {
  const [hovered, setHovered] = useState(null)

  // Size configurations
  const sizes = {
    sm: { star: 'w-4 h-4', button: 'p-0.5', gap: 'gap-0.5' },
    md: { star: 'w-5 h-5', button: 'p-1', gap: 'gap-1' },
    lg: { star: 'w-6 h-6', button: 'p-1.5', gap: 'gap-1.5' }
  }

  const sizeConfig = sizes[size] || sizes.md

  // 5 stars, each star = 2 points (1★=2, 2★=4 ... 5★=10)
  const filledStars = rating ? Math.round(rating / 2) : 0
  const displayStars = hovered !== null ? hovered : filledStars

  const handleStarClick = (starIndex) => {
    if (readOnly) return
    // starIndex is 1–5. clicking the same filled star clears rating
    const newRating = starIndex * 2
    if (newRating === rating) {
      onChange?.(null)
    } else {
      onChange?.(newRating)
    }
  }

  const handleNumberChange = (e) => {
    if (readOnly) return
    const val = parseInt(e.target.value, 10)
    if (!e.target.value) { onChange?.(null); return }
    if (val >= 1 && val <= 10) onChange?.(val)
  }

  return (
    <div 
      className={`flex items-center ${sizeConfig.gap} ${className}`} 
      onClick={e => e.stopPropagation()}
      role="group"
      aria-label={`Rating: ${rating || 'Not rated'} out of 10`}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const isFilled = star <= displayStars
        const isHovered = hovered === star
        
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onMouseLeave={() => !readOnly && setHovered(null)}
            onClick={() => handleStarClick(star)}
            onTouchStart={() => !readOnly && setHovered(star)}
            onTouchEnd={() => !readOnly && setHovered(null)}
            className={`
              ${sizeConfig.button} 
              rounded 
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-1 focus:ring-offset-[#1a1a24]
              ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'}
              ${size !== 'sm' ? 'touch-target' : ''}
            `}
            aria-label={`${star * 2} out of 10 stars`}
            aria-pressed={isFilled}
          >
            <Star
              className={`${sizeConfig.star} transition-colors duration-150 ${
                isFilled 
                  ? 'fill-amber-400 text-amber-400' 
                  : 'fill-transparent text-[#3d3d5c]'
              } ${isHovered && !isFilled ? 'text-amber-300' : ''}`}
            />
          </button>
        )
      })}
      {!compact && !readOnly && (
        <input
          type="number"
          min="1"
          max="10"
          value={rating ?? ''}
          onChange={handleNumberChange}
          onClick={e => e.stopPropagation()}
          placeholder="—"
          className="w-12 text-center text-sm bg-[#0f0f13] border border-[#2e2e4a] rounded-lg px-2 py-1.5 text-[#e2e8f0] focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 ml-2"
          aria-label="Rating value (1-10)"
        />
      )}
      {compact && rating !== null && rating !== undefined && (
        <span className="text-xs text-[#94a3b8] ml-1 min-w-[1.5rem]">{rating}</span>
      )}
    </div>
  )
}
