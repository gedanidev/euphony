import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

function NavItem({ to, icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-purple-700/30 text-purple-300 font-medium'
            : 'text-[#94a3b8] hover:bg-[#22223a] hover:text-[#e2e8f0]'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function closeSidebar() {
    setSidebarOpen(false)
  }

  const navItems = (
    <>
      <NavItem to="/playlists" label={t('nav.playlists')} onClick={closeSidebar} icon={
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      } />
      <NavItem to="/library" label={t('nav.library')} onClick={closeSidebar} icon={
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      } />
      <NavItem to="/artists" label={t('nav.artists')} onClick={closeSidebar} icon={
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      } />
      <NavItem to="/albums" label={t('nav.albums')} onClick={closeSidebar} icon={
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      } />
      <NavItem to="/genres" label={t('nav.genres')} onClick={closeSidebar} icon={
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
      } />
      <NavItem to="/moods" label={t('nav.moods')} onClick={closeSidebar} icon={
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      } />

      <div className="pt-3 pb-1">
        <p className="px-3 text-xs text-[#2e2e4a] uppercase tracking-wider font-medium">{t('nav.tools')}</p>
      </div>
      <NavItem to="/import" label={t('nav.import')} onClick={closeSidebar} icon={
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      } />
      <NavItem to="/settings" label={t('nav.settings')} onClick={closeSidebar} icon={
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      } />
    </>
  )

  return (
    <div className="flex flex-col h-dvh bg-[#0f0f13] text-[#e2e8f0] overflow-hidden lg:flex-row">

      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#1a1a24] border-b border-[#2e2e4a] flex-shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#22223a] hover:text-[#e2e8f0] transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
          Euphony
        </span>

        <button
          onClick={handleLogout}
          className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#22223a] hover:text-red-400 transition-colors"
          aria-label={t('auth.logout')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#1a1a24] border-r border-[#2e2e4a] flex flex-col transform transition-transform duration-200
        lg:relative lg:w-56 lg:flex-shrink-0 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Desktop logo + mobile close button */}
        <div className="p-5 border-b border-[#2e2e4a] flex items-center justify-between">
          <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            Euphony
          </span>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 rounded text-[#94a3b8] hover:text-[#e2e8f0]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems}
        </nav>

        <div className="p-4 border-t border-[#2e2e4a] space-y-2">
          <p className="text-xs text-[#94a3b8]">Euphony {t('common.version')}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-[#94a3b8] hover:text-red-400 transition-colors"
          >
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {children}
      </main>
    </div>
  )
}
