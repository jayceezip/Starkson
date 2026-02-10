'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'
import { formatActionLabel, getActionIcon, timeAgo } from '@/lib/activity'
import type { ActivityItem } from '@/lib/activity'

export default function NotificationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  useEffect(() => {
    if (!mounted || !user) return
    if (!user) {
      router.push('/login')
      return
    }
    const fetchActivity = async () => {
      setLoading(true)
      try {
        const res = await api.get('/dashboard/activity?limit=50')
        setActivity(res.data?.activity ?? [])
      } catch {
        setActivity([])
      } finally {
        setLoading(false)
      }
    }
    fetchActivity()
    const interval = setInterval(fetchActivity, 30000)
    return () => clearInterval(interval)
  }, [mounted, user, router])

  if (!mounted || !user) {
    return (
      <ProtectedRoute>
        <div className="panel-page flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="panel-page">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h1>
        <p className="text-sm text-gray-500 mb-8">
          Your recent actions. Updates automatically.
        </p>

        <div className="panel-card">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-600 border-t-transparent" />
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No activity yet</p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {activity.map((item) => {
                const { label, href } = formatActionLabel(item)
                return (
                  <li key={item.id} className="py-4 first:pt-0 flex items-start gap-3">
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex-shrink-0 mt-0.5">
                      {getActionIcon(item.action)}
                    </span>
                    <div className="min-w-0 flex-1">
                      {href ? (
                        <Link href={href} className="text-sm font-medium text-gray-900 hover:text-sky-600 transition-colors">
                          {label}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{label}</span>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">{timeAgo(item.createdAt)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
