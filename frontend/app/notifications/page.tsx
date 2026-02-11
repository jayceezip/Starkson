'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'

interface Notification {
  id: string
  type: 'ticket' | 'incident' | 'system' | 'other'
  title: string
  message: string | null
  resourceType: string | null
  resourceId: string | null
  link: string | null
  isRead: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  const fetchNotifications = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await api.get('/notifications?limit=100')
      setNotifications(res.data ?? [])
    } catch (error) {
      console.error('Error fetching notifications:', error)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mounted || !user) return
    if (!user) {
      router.push('/login')
      return
    }
    
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [mounted, user, router])

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`)
      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    if (notifications.length === 0) return
    
    setMarkingAll(true)
    try {
      await api.put('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    } finally {
      setMarkingAll(false)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      // If you have a delete endpoint, use it:
      // await api.delete(`/notifications/${id}`)
      // Otherwise, just filter it out locally
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ticket':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case 'incident':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'system':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        )
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'ticket':
        return 'bg-blue-50 text-blue-600'
      case 'incident':
        return 'bg-red-50 text-red-600'
      case 'system':
        return 'bg-purple-50 text-purple-600'
      default:
        return 'bg-gray-50 text-gray-600'
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  // Helper function to format time ago
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 
                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up!'
              }
            </p>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll}
              className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {markingAll ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Marking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mark all as read
                </>
              )}
            </button>
          )}
        </div>

        <div className="panel-card">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-600 border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
              <p className="text-sm text-gray-500">You are all caught up! Check back later for updates.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                const isUnread = !notification.isRead
                return (
                  <div 
                    key={notification.id} 
                    className={`py-4 px-1 hover:bg-gray-50 transition-colors ${isUnread ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-900 mb-1">
                              {notification.title}
                            </h3>
                            {notification.message && (
                              <p className="text-sm text-gray-600 mb-1">
                                {notification.message}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              {timeAgo(notification.createdAt)}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isUnread && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-xs text-sky-600 hover:text-sky-700 font-medium px-2 py-1 rounded hover:bg-sky-50 transition-colors"
                                title="Mark as read"
                              >
                                Mark read
                              </button>
                            )}
                            
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="Delete notification"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {notification.link && (
                          <div className="mt-3">
                            <Link
                              href={notification.link}
                              onClick={() => isUnread && markAsRead(notification.id)}
                              className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium"
                            >
                              View details
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {notifications.length > 0 && !loading && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}