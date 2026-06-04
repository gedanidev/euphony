/**
 * EmptyState component - Consistent empty state across the app
 * 
 * @param {string} title - Main title/message
 * @param {string} description - Secondary description
 * @param {ReactNode} action - Optional action button/link
 * @param {string} icon - Icon type: 'music', 'search', 'user', 'album', 'playlist', 'file'
 * @param {string} size - 'sm', 'md', 'lg'
 */
const ICONS = {
  music: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
  ),
  search: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  ),
  user: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  ),
  album: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  ),
  playlist: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
  ),
  file: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  ),
  heart: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  ),
  sparkles: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  ),
}

const SIZES = {
  sm: {
    container: 'py-8',
    iconWrapper: 'w-12 h-12',
    icon: 'w-6 h-6',
    title: 'text-sm',
    description: 'text-xs',
  },
  md: {
    container: 'py-12 sm:py-20',
    iconWrapper: 'w-14 h-14 sm:w-16 sm:h-16',
    icon: 'w-6 h-6 sm:w-8 sm:h-8',
    title: 'text-base sm:text-lg',
    description: 'text-sm',
  },
  lg: {
    container: 'py-16 sm:py-24',
    iconWrapper: 'w-16 h-16 sm:w-20 sm:h-20',
    icon: 'w-8 h-8 sm:w-10 sm:h-10',
    title: 'text-lg sm:text-xl',
    description: 'text-sm sm:text-base',
  },
}

export default function EmptyState({ 
  title, 
  description, 
  action, 
  icon = 'music',
  size = 'md',
  className = ''
}) {
  const sizeClasses = SIZES[size]
  const iconPath = ICONS[icon] || ICONS.music

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizeClasses.container} ${className}`}>
      <div className={`${sizeClasses.iconWrapper} rounded-full bg-[#22223a] flex items-center justify-center mb-3 sm:mb-4`}>
        <svg className={`${sizeClasses.icon} text-[#94a3b8]`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {iconPath}
        </svg>
      </div>
      <p className={`text-[#e2e8f0] font-medium ${sizeClasses.title}`}>{title}</p>
      {description && (
        <p className={`text-[#94a3b8] mt-1 max-w-xs mx-auto ${sizeClasses.description}`}>
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4 sm:mt-6">
          {action}
        </div>
      )}
    </div>
  )
}
