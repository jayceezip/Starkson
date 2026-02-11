'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, hasRole } from '@/lib/auth'
import { formatActionLabel, getActionIcon, timeAgo } from '@/lib/activity'
import type { ActivityItem } from '@/lib/activity'

type ActivityCategory = 'attachments' | 'ticket_actions' | 'comments'

function getActivityCategory(action: string): ActivityCategory {
  if (action === 'UPLOAD_ATTACHMENT' || action === 'DELETE_ATTACHMENT') return 'attachments'
  if (action === 'ADD_COMMENT' || action === 'USER_COMMENT' || action === 'STAFF_COMMENT') return 'comments'
  // Ticket actions: create/update/convert/delete ticket, and "ticket converted to incident" for the user
  if (action === 'CREATE_TICKET' || action === 'UPDATE_TICKET' || action === 'NEW_TICKET_CREATED' || action === 'DELETE_TICKET' || action === 'CONVERT_TICKET' || action === 'TICKET_CONVERTED_TO_INCIDENT') return 'ticket_actions'
  return 'ticket_actions'
}

function ActivityColumn({
  title,
  icon,
  items,
  formatLabel,
  getIcon,
}: {
  title: string
  icon: React.ReactNode
  items: ActivityItem[]
  formatLabel: (item: ActivityItem) => { label: string; href: string | null }
  getIcon: (action: string) => React.ReactNode
}) {
  return (
    <div className="panel-card flex flex-col h-full min-h-[200px]">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-100 text-sky-600">{icon}</span>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 flex-1">No activity</p>
      ) : (
        <ul
          className={`space-y-2 flex-1 min-h-0 ${items.length >= 6 ? 'max-h-[320px] overflow-y-auto' : ''}`}
        >
          {items.map((item) => {
            const { label, href } = formatLabel(item)
            return (
              <li key={item.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex-shrink-0 mt-0.5">
                  {getIcon(item.action)}
                </span>
                <div className="min-w-0 flex-1">
                  {href ? (
                    <Link href={href} className="text-sm font-medium text-gray-900 hover:text-sky-600 transition-colors line-clamp-2">
                      {label}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-gray-900 line-clamp-2">{label}</span>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">{timeAgo(item.createdAt)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState({
    tickets: 0,
    incidents: 0,
    openTickets: 0,
    resolvedTickets: 0,
  })
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (!user) {
      router.push('/login')
      return
    }

    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/stats')
        setStats(response.data)
      } catch (error: any) {
        console.error('Failed to fetch stats:', error)
      }
    }
    fetchStats()

    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [user, router, mounted])

  useEffect(() => {
    if (!mounted || !user) return
    const fetchActivity = async () => {
      setActivityLoading(true)
      try {
        const res = await api.get('/dashboard/activity?limit=25')
        setActivity(res.data?.activity ?? [])
      } catch (e) {
        console.error('Failed to fetch activity:', e)
        setActivity([])
      } finally {
        setActivityLoading(false)
      }
    }
    fetchActivity()
  }, [user, mounted])

  if (!mounted || !user) {
    return (
      <ProtectedRoute>
        <div className="panel-page flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-500">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="panel-page">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <span className="text-sm text-gray-500">Today</span>
        </div>

        {/* Stat cards with icons and subtitles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="panel-card relative">
            <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="panel-card-title uppercase tracking-wide">Total Tickets</h3>
            <p className="panel-card-value">{stats.tickets}</p>
            <p className="text-sm text-gray-500 mt-1">All time tickets</p>
          </div>
          {hasRole(user, 'security_officer', 'admin') && (
            <div className="panel-card relative">
              <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="panel-card-title uppercase tracking-wide">Incidents</h3>
              <p className="panel-card-value">{stats.incidents}</p>
              <p className="text-sm text-gray-500 mt-1">Security incidents</p>
            </div>
          )}
          <div className="panel-card relative">
            <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="panel-card-title uppercase tracking-wide">Open Tickets</h3>
            <p className="panel-card-value">{stats.openTickets}</p>
            <p className="text-sm text-gray-500 mt-1">Awaiting resolution</p>
          </div>
          <div className="panel-card relative">
            <div className="absolute top-6 right-6 flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="panel-card-title uppercase tracking-wide">Resolved</h3>
            <p className="panel-card-value">{stats.resolvedTickets}</p>
            <p className="text-sm text-gray-500 mt-1">Successfully closed</p>
          </div>
        </div>

        {/* Recent Activity - 3 columns */}
        <div>
          <h2 className="panel-section-title mb-4">Recent Activity</h2>
          {activityLoading ? (
            <div className="panel-card flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-600 border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ActivityColumn
                title="Attachments"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                }
                items={activity.filter((a) => getActivityCategory(a.action) === 'attachments')}
                formatLabel={formatActionLabel}
                getIcon={getActionIcon}
              />
              <ActivityColumn
                title="Ticket actions"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                items={activity.filter((a) => getActivityCategory(a.action) === 'ticket_actions')}
                formatLabel={formatActionLabel}
                getIcon={getActionIcon}
              />
              <ActivityColumn
                title="Comments"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                }
                items={activity.filter((a) => getActivityCategory(a.action) === 'comments')}
                formatLabel={formatActionLabel}
                getIcon={getActionIcon}
              />
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}