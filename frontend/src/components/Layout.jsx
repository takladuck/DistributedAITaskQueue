import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const NAV_LINKS = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/submit', icon: '➕', label: 'Submit Job' },
  { to: '/jobs', icon: '📋', label: 'Jobs' },
  { to: '/tasks', icon: '🗂️', label: 'Tasks' },
]

export default function Layout() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark')
    setDark(!dark)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 p-4 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-lg font-bold shadow">
            ⚙
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">AI Task Queue</p>
            <p className="text-xs text-gray-400">v1.0.0</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* User + controls */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-2">
          <button
            onClick={toggleDark}
            className="sidebar-link w-full"
          >
            <span>{dark ? '☀️' : '🌙'}</span>
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800">
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{user?.email}</p>
            <button
              onClick={handleLogout}
              className="text-xs text-red-500 hover:text-red-600 mt-0.5 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
