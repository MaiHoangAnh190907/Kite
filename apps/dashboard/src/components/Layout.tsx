import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Users,
  UserCog,
  Tablet,
  Upload,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

export function Layout(): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const isAdmin = user?.role === 'admin'

  function handleLogout(): void {
    logout()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-white/10 text-white font-medium'
        : 'text-text-sidebar hover:bg-white/5 hover:text-white'
    }`

  return (
    <div className="flex h-screen no-print">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-bg-sidebar transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 items-center px-4">
          <span className="text-lg font-bold text-white">
            {collapsed ? 'K' : 'Kite'}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          <NavLink to="/patients" className={navLinkClass}>
            <Users size={20} />
            {!collapsed && <span>Patients</span>}
          </NavLink>

          {isAdmin && (
            <>
              <div className="my-4 border-t border-white/10" />
              {!collapsed && (
                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-text-sidebar/60">
                  Admin
                </p>
              )}
              <NavLink to="/admin/staff" className={navLinkClass}>
                <UserCog size={20} />
                {!collapsed && <span>Staff</span>}
              </NavLink>
              <NavLink to="/admin/tablets" className={navLinkClass}>
                <Tablet size={20} />
                {!collapsed && <span>Tablets</span>}
              </NavLink>
              <NavLink to="/admin/import" className={navLinkClass}>
                <Upload size={20} />
                {!collapsed && <span>Import</span>}
              </NavLink>
              <NavLink to="/admin/analytics" className={navLinkClass}>
                <BarChart3 size={20} />
                {!collapsed && <span>Analytics</span>}
              </NavLink>
            </>
          )}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center border-t border-white/10 py-3 text-text-sidebar hover:text-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {/* User + logout */}
        <div className="border-t border-white/10 p-3">
          {!collapsed && (
            <p className="mb-1 truncate text-sm text-text-sidebar">
              {user?.name}
            </p>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-sidebar/70 hover:text-white"
          >
            <LogOut size={16} />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-bg-primary p-6">
        <Outlet />
      </main>
    </div>
  )
}
