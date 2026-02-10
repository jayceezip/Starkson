'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getStoredUser, clearStoredAuth, hasRole } from '@/lib/auth'
import api from '@/lib/api'
import { formatActionLabel, getActionIcon, timeAgo } from '@/lib/activity'
import type { ActivityItem } from '@/lib/activity'

const ACTIVITY_POLL_MS = 15000

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [lastSeenCount, setLastSeenCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  const newCount = Math.max(0, activity.length - lastSeenCount)

  // Only access localStorage on client side after mount
  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  // Update user state when pathname changes (after login/logout)
  useEffect(() => {
    if (mounted) {
      setUser(getStoredUser())
    }
  }, [pathname, mounted])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Fetch recent activity for notification bell (all roles see their own actions)
  const fetchActivity = async () => {
    try {
      const res = await api.get('/dashboard/activity?limit=15')
      setActivity(res.data?.activity ?? [])
    } catch {
      setActivity([])
    }
  }

  useEffect(() => {
    if (!mounted || !user) return
    fetchActivity()
    const interval = setInterval(fetchActivity, ACTIVITY_POLL_MS)
    return () => clearInterval(interval)
  }, [mounted, user])

  // Refetch activity when user navigates (e.g. after creating/updating a ticket) so badge updates
  useEffect(() => {
    if (!mounted || !user) return
    fetchActivity()
  }, [pathname, mounted, user])

  // Refetch when user returns to the tab
  useEffect(() => {
    if (!mounted || !user) return
    const onFocus = () => fetchActivity()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [mounted, user])

  // Mark as seen when user is on the notifications page
  useEffect(() => {
    if (pathname === '/notifications' && activity.length > 0) {
      setLastSeenCount(activity.length)
    }
  }, [pathname, activity.length])

  // Close notification dropdown when clicking outside
  useEffect(() => {
    if (!notifOpen) return
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [notifOpen])

  const handleLogout = () => {
    // Clear authentication
    clearStoredAuth()
    // Clear user state
    setUser(null)
    // Redirect to login
    router.push('/login')
    // Force page reload to clear any cached data
    router.refresh()
  }

  // Format role name for display
  const formatRole = (role: string) => {
    return role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  // Check if current path is active
  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/')
  }

  // Don't show sidebar on login/register pages - check this FIRST
  const hideSidebarPages = ['/login', '/register']
  if (hideSidebarPages.includes(pathname || '')) {
    return null
  }

  // Show loading state during SSR/hydration - but only if not on login/register
  if (!mounted) {
    return null // Don't show anything during SSR to avoid blocking login page
  }

  if (!user) {
    return null
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-md shadow-lg"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isMobileMenuOpen ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen w-64 bg-gray-800 text-white shadow-lg z-40
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Brand + Notification bell */}
          <div className="px-4 py-4 border-b border-gray-700 relative flex items-center justify-between gap-2" ref={notifRef}>
            <Link href="/dashboard" className="text-xl font-bold text-white tracking-tight hover:opacity-90 transition-opacity flex-1 min-w-0 truncate text-center">
              STARKSON
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (!notifOpen) setLastSeenCount(activity.length)
                setNotifOpen((o) => !o)
              }}
              className="relative flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {newCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium">
                  {newCount > 9 ? '9+' : newCount}
                </span>
              )}
            </button>
            {/* Dropdown: recent actions (scrollable) */}
            {notifOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 mx-2 bg-gray-700 border border-gray-600 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[min(320px,60vh)]">
                <div className="px-3 py-2 border-b border-gray-600 flex items-center justify-between flex-shrink-0">
                  <span className="text-sm font-semibold text-white">Recent activity</span>
                  <Link
                    href="/notifications"
                    onClick={() => {
                      setLastSeenCount(activity.length)
                      setNotifOpen(false)
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300"
                  >
                    Show all
                  </Link>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {activity.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-gray-400">No recent activity</p>
                  ) : (
                    <ul className="py-1">
                      {activity.map((item) => {
                        const { label, href } = formatActionLabel(item)
                        return (
                          <li key={item.id} className="px-3 py-2 hover:bg-gray-600/50">
                            {href ? (
                              <Link
                                href={href}
                                onClick={() => setNotifOpen(false)}
                                className="flex items-start gap-2"
                              >
                                <span className="text-gray-400 mt-0.5 flex-shrink-0">
                                  {getActionIcon(item.action, 'text-sky-400')}
                                </span>
                                <span className="text-sm text-gray-200 line-clamp-2 flex-1">{label}</span>
                                <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5">{timeAgo(item.createdAt)}</span>
                              </Link>
                            ) : (
                              <div className="flex items-start gap-2">
                                <span className="text-gray-400 mt-0.5 flex-shrink-0">
                                  {getActionIcon(item.action, 'text-sky-400')}
                                </span>
                                <span className="text-sm text-gray-200 line-clamp-2 flex-1">{label}</span>
                                <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5">{timeAgo(item.createdAt)}</span>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-4">
            <div className="space-y-1 px-3">
              {/* Dashboard */}
              <Link
                href="/dashboard"
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${isActive('/dashboard')
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="font-medium">Dashboard</span>
              </Link>

              {/* Notifications - all roles (own activity) */}
              <Link
                href="/notifications"
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${isActive('/notifications')
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="font-medium">Notifications</span>
              </Link>

              {/* Tickets - User, IT Support, Admin */}
              {hasRole(user, 'user', 'it_support', 'admin') && (
                <Link
                  href="/tickets"
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive('/tickets')
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">Tickets</span>
                </Link>
              )}

              {/* IT Console - IT Support, Admin */}
              {hasRole(user, 'it_support', 'admin') && (
                <Link
                  href="/staff"
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive('/staff')
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">IT Console</span>
                </Link>
              )}

              {/* Incidents - Security Officer, Admin */}
              {hasRole(user, 'security_officer', 'admin') && (
                <Link
                  href="/incidents"
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive('/incidents')
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-medium">Incidents</span>
                </Link>
              )}

              {/* Admin Panel - Admin only */}
              {hasRole(user, 'admin') && (
                <Link
                  href="/admin"
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive('/admin')
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="font-medium">Admin</span>
                </Link>
              )}
            </div>
          </nav>

          {/* User Info and Actions */}
          <div className="border-t border-gray-700 p-4 space-y-3">
            {/* User Info */}
            <div className="px-4 py-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{formatRole(user.role)}</p>
                </div>
              </div>
            </div>

            {/* Profile Button */}
            <Link
              href="/profile"
              className={`
                flex items-center gap-3 px-4 py-2 rounded-lg transition-colors w-full
                ${isActive('/profile')
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }
              `}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">Profile</span>
            </Link>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors w-full font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
