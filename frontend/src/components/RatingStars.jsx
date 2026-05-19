import { useState } from 'react'

/**
 * RatingStars — 5 stars visual + optional number input.
 * rating: 1–10 or null
 * onChange(newRating): called with 1–10 or null (cleared)
 * compact: if true, hide the number input
 */
export default function RatingStars({ rating, onChange, compact = false }) {
  const [hovered, setHovered] = useState(null)

  // 5 stars, each star = 2 points (1★=2, 2★=4 ... 5★=10)
  const filledStars = rating ? Math.round(rating / 2) : 0
  const displayStars = hovered !== null ? hovered : filledStars

  const handleStarClick = (starIndex) => {
    // starIndex is 1–5. clicking the same filled star clears rating
    const newRating = starIndex * 2
    if (newRating === rating) {
      onChange(null)
    } else {
      onChange(newRating)
    }
  }

  const handleNumberChange = (e) => {
    const val = parseInt(e.target.value, 10)
    if (!e.target.value) { onChange(null); return }
    if (val >= 1 && val <= 10) onChange(val)
  }

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => handleStarClick(star)}
          className="text-lg leading-none transition-colors focus:outline-none"
          style={{ color: star <= displayStars ? '#f59e0b' : '#3d3d5c' }}
          aria-label={`${star * 2} / 10`}
        >
          {star <= displayStars ? '★' : '☆'}
        </button>
      ))}
      {!compact && (
        <input
          type="number"
          min="1"
          max="10"
          value={rating ?? ''}
          onChange={handleNumberChange}
          onClick={e => e.stopPropagation()}
          placeholder="—"
          className="w-10 text-center text-xs bg-transparent border border-[#2e2e4a] rounded px-1 py-0.5 text-[#94a3b8] focus:outline-none focus:border-purple-500"
        />
      )}
    </div>
  )
}
