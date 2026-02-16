'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, hasRole } from '@/lib/auth'
import { formatPinoyDateTime } from '@/lib/date'

interface Ticket {
  id: number
  ticketNumber: string
  requestType: string
  title: string
  status: string
  priority: string
  createdAt: string
  createdByName?: string
  assignedToName?: string
  slaDue?: string
  convertedIncidentId?: string | null
  convertedIncidentNumber?: string | null
}

const PAGE_SIZE = 10

export default function TicketsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
  }, [])

  const fetchTickets = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const response = await api.get('/tickets')
      const list = Array.isArray(response.data) ? response.data : []
      setTickets(list.sort((a, b) => new Date((b as Ticket).createdAt || 0).getTime() - new Date((a as Ticket).createdAt || 0).getTime()))
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!mounted) return
    if (!user) {
      router.push('/login')
      return
    }
    fetchTickets()
  }, [user, router, mounted, fetchTickets])

  useEffect(() => {
    if (!mounted || !user) return
    const onFocus = () => fetchTickets()
    window.addEventListener('visibilitychange', onFocus)
    return () => window.removeEventListener('visibilitychange', onFocus)
  }, [mounted, user, fetchTickets])

  // Keyword search: split query into words, match any ticket field (case-insensitive)
  const keywords = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredTickets = keywords.length === 0
    ? tickets
    : tickets.filter((t) => {
        const searchText = [
          t.ticketNumber,
          t.title,
          t.requestType,
          t.status,
          t.priority,
          t.createdByName,
          t.assignedToName,
          t.convertedIncidentNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return keywords.every((kw) => searchText.includes(kw))
      })

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const paginatedTickets = filteredTickets.slice(start, start + PAGE_SIZE)

  // Clamp page when list shrinks (e.g. after filter/search)
  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages)
  }, [filteredTickets.length, totalPages, page])

  // Status colors aligned with the ModernStatusSelect component
  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; dot: string }> = {
      'new': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
      'assigned': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
      'in_progress': { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
      'waiting for user': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      'waiting_for_user': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      'resolved': { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
      'closed': { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
      'converted_to_incident': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    };
    
    // Handle both underscore and space formats
    const normalizedStatus = status.replace(/ /g, '_');
    const colorKey = colors[status] ? status : 
                    colors[normalizedStatus] ? normalizedStatus : 
                    'closed';
    
    return colors[colorKey] || colors.closed;
  }

  const getStatusLabel = (status: string) => {
    if (status === 'converted_to_incident') return 'Converted to Incident'
    return status ? status.replace(/_/g, ' ') : 'new'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, { bg: string; text: string; dot: string }> = {
      low: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
      medium: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
      high: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      urgent: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    }
    return colors[priority] || colors.medium
  }

  const getPriorityLabel = (priority: string) => {
    return priority ? priority : 'medium'
  }

  const isSLABreached = (slaDue: string | undefined) => {
    if (!slaDue) return false
    return new Date(slaDue) < new Date()
  }

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['user', 'it_support', 'admin']}>
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
    <ProtectedRoute allowedRoles={['user', 'it_support', 'admin']}>
      <div className="panel-page">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">IT Support Tickets</h1>
              <button
                type="button"
                onClick={() => fetchTickets()}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                title="Refresh list"
              >
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
            {user?.role === 'user' && (
              <Link href="/tickets/create" className="btn-primary-tickets shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Ticket
              </Link>
            )}
          </div>

          {loading ? (
            <div className="panel-card border border-gray-200 flex flex-col items-center justify-center py-16 text-gray-500">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mb-4" />
              <p>Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="panel-card border border-gray-200 text-center py-12 text-gray-500">No tickets found</div>
          ) : (
            <>
              {/* Table Card with Integrated Search */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Search Bar - Integrated into table card header */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="search"
                        placeholder="Search tickets by #, title, type, status, priority, assignee..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                      />
                    </div>
                    {searchQuery.trim() && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                          {filteredTickets.length} result{filteredTickets.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setPage(1);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-auto max-h-[calc(100vh-20rem)] min-h-[220px]">
                  {filteredTickets.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No tickets match your search. Try different keywords.
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ticket #</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Title</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                          {hasRole(user, 'it_support', 'admin') && (
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned To</th>
                          )}
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SLA</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {paginatedTickets.map((ticket) => {
                          const statusColors = getStatusColor(ticket.status || 'new');
                          const priorityColors = getPriorityColor(ticket.priority || 'medium');
                          
                          return (
                            <tr key={ticket.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Link href={`/tickets/${ticket.id}`} className="font-mono text-blue-600 hover:text-blue-700 font-medium transition-colors">
                                  {ticket.ticketNumber || `#${ticket.id}`}
                                </Link>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {ticket.requestType
                                  ? (ticket.requestType).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                                  : 'N/A'}
                              </td>
                              <td className="px-6 py-4">
                                <Link href={`/tickets/${ticket.id}`} className="text-gray-900 hover:text-blue-600 transition-colors line-clamp-2">
                                  {ticket.title || 'Untitled'}
                                </Link>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
                                    {getStatusLabel(ticket.status || 'new')}
                                  </span>
                                  {ticket.status === 'converted_to_incident' && ticket.convertedIncidentId && (
                                    <Link 
                                      href={`/incidents/${ticket.convertedIncidentId}`} 
                                      className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline inline-flex items-center gap-0.5"
                                    >
                                      → {ticket.convertedIncidentNumber || 'View'}
                                    </Link>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${priorityColors.bg} ${priorityColors.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${priorityColors.dot}`} />
                                  {getPriorityLabel(ticket.priority || 'medium')}
                                </span>
                              </td>
                              {hasRole(user, 'it_support', 'admin') && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {ticket.assignedToName || <span className="text-gray-400">Unassigned</span>}
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatPinoyDateTime(ticket.createdAt) || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {ticket.slaDue ? (
                                  <span className={`text-xs font-medium ${isSLABreached(ticket.slaDue) ? 'text-red-600' : 'text-gray-600'}`}>
                                    {isSLABreached(ticket.slaDue)
                                      ? '⚠ Breached'
                                      : formatPinoyDateTime(ticket.slaDue)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination */}
                {filteredTickets.length > 0 && (
                  <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-wrap gap-3">
                    <p className="text-sm text-gray-600">
                      Showing {start + 1}–{Math.min(start + PAGE_SIZE, filteredTickets.length)} of {filteredTickets.length} tickets
                      {searchQuery.trim() ? ` (filtered from ${tickets.length})` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setPage((p) => Math.max(1, p - 1))} 
                        disabled={page <= 1} 
                        className="btn-pagination"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
                      <button 
                        type="button" 
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                        disabled={page >= totalPages} 
                        className="btn-pagination"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}