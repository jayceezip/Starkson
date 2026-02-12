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
  sourceTicketId?: string | null
  affectedAsset?: string | null
  affectedUser?: string | null
}

const PAGE_SIZE = 10

export default function IncidentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
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

  // Keyword search: match incident number, title, category, severity, status, affected asset/user, source ticket
  const keywords = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredIncidents = keywords.length === 0
    ? incidents
    : incidents.filter((inc) => {
        const searchText = [
          inc.incidentNumber,
          inc.title,
          inc.category,
          inc.severity,
          inc.status,
          inc.affectedAsset,
          inc.affectedUser,
          inc.sourceTicketNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return keywords.every((kw) => searchText.includes(kw))
      })

  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const paginatedIncidents = filteredIncidents.slice(start, start + PAGE_SIZE)

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages)
  }, [filteredIncidents.length, totalPages, page])

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['security_officer', 'admin']}>
        <div className="panel-page flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-500">Loading...</p>
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
      <div className="panel-page">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Cybersecurity Incidents</h1>
          {user?.role === 'user' && (
            <Link
              href="/incidents/create"
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Create Incident
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="panel-card mb-6">
          <label htmlFor="incident-search" className="block text-sm font-medium text-gray-700 mb-2">Search incidents</label>
          <input
            id="incident-search"
            type="search"
            placeholder="Search by incident #, title, category, severity, status, affected asset/user, source ticket..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            className="w-full max-w-xl px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4"
          />
          {searchQuery.trim() && (
            <p className="text-sm text-gray-500 mb-4">
              {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''} match your search
            </p>
          )}
        </div>

        <div className="panel-card mb-6">
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
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : incidents.length === 0 ? (
          <div className="panel-card text-center py-8 text-gray-500">No incidents found</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="panel-card text-center py-8 text-gray-500">No incidents match your search. Try different keywords.</div>
        ) : (
          <>
            <div className="panel-card overflow-hidden p-0 border border-gray-200 rounded-xl">
              <div className="overflow-auto max-h-[calc(100vh-14rem)] min-h-[200px]">
                <table className="min-w-[1000px] w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Incident #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Affected Asset</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Affected User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Source Ticket</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Created</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Link href={`/incidents/${incident.id}`} className="text-red-600 hover:underline font-mono">
                          {incident.incidentNumber || incident.incidentNumber || `#${incident.id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {incident.category ? incident.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-4 min-w-[140px]">
                        <Link href={`/incidents/${incident.id}`} className="text-red-600 hover:underline">
                          {incident.title || 'Untitled'}
                        </Link>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded ${getSeverityColor(incident.severity || 'medium')}`}>
                          {incident.severity || 'medium'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(incident.status || 'new')}`}>
                          {incident.status || 'new'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {incident.affectedAsset || '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {incident.affectedUser || '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {incident.sourceTicketNumber ? (
                          <Link href={incident.sourceTicketId ? `/tickets/${incident.sourceTicketId}` : '#'} className="text-blue-600 hover:underline">
                            {incident.sourceTicketNumber}
                          </Link>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
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
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-600">
                  Showing {filteredIncidents.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, filteredIncidents.length)} of {filteredIncidents.length} incidents
                  {searchQuery.trim() ? ` (filtered from ${incidents.length})` : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
