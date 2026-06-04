/**
 * LoadingSpinner component - Consistent loading state across the app
 * 
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {string} text - Optional loading text
 * @param {boolean} fullScreen - Whether to center in full screen
 * @param {string} className - Additional classes
 */
export default function LoadingSpinner({ 
  size = 'md', 
  text,
  fullScreen = false,
  className = ''
}) {
  const sizes = { 
    sm: 'w-4 h-4 border-1', 
    md: 'w-6 h-6 sm:w-8 sm:h-8 border-2',
    lg: 'w-8 h-8 sm:w-10 sm:h-10 border-[3px]',
    xl: 'w-10 h-10 sm:w-12 sm:h-12 border-[3px]'
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  }

  const spinnerSizes = sizes[size] || sizes.md
  const textSizeClass = textSizes[size] || textSizes.md

  const content = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        class={`${spinnerSizes} border-purple-500 border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label="Cargando"
      />
      {text && (
        <span class={`mt-3 text-[#94a3b8] ${textSizeClass}`}>
          {text}
        </span>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 sm:py-20">
        {content}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-8 sm:py-12">
      {content}
    </div>
  )
}
