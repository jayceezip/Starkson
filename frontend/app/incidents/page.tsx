'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'

interface Incident {
  id: number
  incidentNumber: string
  category: string
  title: string
  severity: string
  status: string
  createdAt: string
  sourceTicketNumber?: string
}

export default function IncidentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', severity: '', category: '' })

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

    const fetchIncidents = async () => {
      try {
        const params = new URLSearchParams()
        if (filters.status) params.append('status', filters.status)
        if (filters.severity) params.append('severity', filters.severity)
        if (filters.category) params.append('category', filters.category)
        
        const response = await api.get(`/incidents?${params.toString()}`)
        setIncidents(response.data)
      } catch (error) {
        console.error('Failed to fetch incidents:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchIncidents()
  }, [user, router, filters, mounted])

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['security_officer', 'admin']}>
        <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    }
    return colors[severity] || 'bg-gray-100 text-gray-800'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      triaged: 'bg-yellow-100 text-yellow-800',
      investigating: 'bg-purple-100 text-purple-800',
      contained: 'bg-orange-100 text-orange-800',
      recovered: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <ProtectedRoute allowedRoles={['security_officer', 'admin']}>
      <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Cybersecurity Incidents</h1>
          <Link
            href="/incidents/create"
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Create Incident
          </Link>
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">All</option>
                <option value="new">New</option>
                <option value="triaged">Triaged</option>
                <option value="investigating">Investigating</option>
                <option value="contained">Contained</option>
                <option value="recovered">Recovered</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">All</option>
                <option value="phishing">Phishing</option>
                <option value="malware">Malware</option>
                <option value="unauthorized_access">Unauthorized Access</option>
                <option value="data_exposure">Data Exposure</option>
                <option value="policy_violation">Policy Violation</option>
                <option value="system_compromise">System Compromise</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No incidents found</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Incident #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source Ticket</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {incidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/incidents/${incident.id}`} className="text-red-600 hover:underline font-mono">
                        {incident.incidentNumber || incident.incidentNumber || `#${incident.id}`}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {incident.category ? incident.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/incidents/${incident.id}`} className="text-red-600 hover:underline">
                        {incident.title || 'Untitled'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${getSeverityColor(incident.severity || 'medium')}`}>
                        {incident.severity || 'medium'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(incident.status || 'new')}`}>
                        {incident.status || 'new'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {incident.sourceTicketNumber ? (
                        <Link href={`/tickets/${incident.sourceTicketNumber}`} className="text-blue-600 hover:underline">
                          {incident.sourceTicketNumber}
                        </Link>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {incident.createdAt || incident.createdAt 
                        ? new Date(incident.createdAt || incident.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
