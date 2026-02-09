'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, hasRole } from '@/lib/auth'

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

  // Only access localStorage on client side
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
        console.log('Dashboard stats received:', response.data)
        setStats(response.data)
      } catch (error: any) {
        console.error('Failed to fetch stats:', error)
        console.error('Error details:', error.response?.data)
      }
    }
    fetchStats()
    
    // Auto-refresh stats every 15 seconds for real-time updates
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [user, router, mounted])

  if (!mounted || !user) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-600 mb-2">Total Tickets</h3>
            <p className="text-3xl font-bold">{stats.tickets}</p>
          </div>
          {hasRole(user, 'security_officer', 'admin') && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-gray-600 mb-2">Incidents</h3>
              <p className="text-3xl font-bold">{stats.incidents}</p>
            </div>
          )}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-600 mb-2">Open Tickets</h3>
            <p className="text-3xl font-bold">{stats.openTickets}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-600 mb-2">Resolved</h3>
            <p className="text-3xl font-bold">{stats.resolvedTickets}</p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
