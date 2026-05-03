import { NavLink } from 'react-router-dom'

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
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
  return (
    <div className="flex h-screen bg-[#0f0f13] text-[#e2e8f0] overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-[#1a1a24] border-r border-[#2e2e4a] flex flex-col">
        <div className="p-5 border-b border-[#2e2e4a]">
          <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            Euphony
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavItem
            to="/playlists"
            label="Playlists"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            }
          />
          <NavItem
            to="/library"
            label="Library"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
          />
        </nav>
        <div className="p-4 border-t border-[#2e2e4a]">
          <p className="text-xs text-[#94a3b8]">Euphony MVP v0.1</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
