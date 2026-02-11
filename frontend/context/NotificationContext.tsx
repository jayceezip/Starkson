'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '@/lib/api'
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

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  markAllAsRead: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  forceRefresh: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const fetchNotifications = async () => {
    const user = getStoredUser()
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [notifRes, countRes] = await Promise.all([
        api.get('/notifications?limit=100'),
        api.get('/notifications/unread-count')
      ])
      setNotifications(notifRes.data ?? [])
      setUnreadCount(countRes.data?.count ?? 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`)
      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all')
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      const notificationToDelete = notifications.find(n => n.id === id)
      const wasUnread = notificationToDelete && !notificationToDelete.isRead
      
      await api.delete(`/notifications/${id}`)
      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  }

  const forceRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  useEffect(() => {
    fetchNotifications()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [refreshTrigger])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      markAllAsRead,
      markAsRead,
      deleteNotification,
      forceRefresh
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}