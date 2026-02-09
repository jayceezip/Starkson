'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'

export default function AdminPanelPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTickets: 0,
    totalIncidents: 0,
    systemHealth: 'operational',
  })

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
        const response = await api.get('/admin/stats')
        setStats(response.data)
      } catch (error) {
        console.error('Failed to fetch admin stats:', error)
      }
    }
    fetchStats()
    
    // Auto-refresh stats every 15 seconds for real-time updates
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [user, router, mounted])

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
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
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-600 mb-2">Total Users</h3>
            <p className="text-3xl font-bold">{stats.totalUsers}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-600 mb-2">Total Tickets</h3>
            <p className="text-3xl font-bold">{stats.totalTickets}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-600 mb-2">Total Incidents</h3>
            <p className="text-3xl font-bold">{stats.totalIncidents}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-600 mb-2">System Health</h3>
            <p className="text-3xl font-bold text-green-600">{stats.systemHealth}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Administration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="/admin/users" className="p-4 border rounded-lg hover:bg-gray-50">
              <h3 className="font-semibold">User Management</h3>
              <p className="text-sm text-gray-600">Manage users and roles</p>
            </a>
            <a href="/admin/sla" className="p-4 border rounded-lg hover:bg-gray-50">
              <h3 className="font-semibold">SLA Configuration</h3>
              <p className="text-sm text-gray-600">Configure SLA settings</p>
            </a>
            <a href="/admin/audit" className="p-4 border rounded-lg hover:bg-gray-50">
              <h3 className="font-semibold">Audit Logs</h3>
              <p className="text-sm text-gray-600">View system audit trail</p>
            </a>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
