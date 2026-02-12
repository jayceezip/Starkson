'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, hasRole } from '@/lib/auth'

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

  useEffect(() => {
    if (!mounted) return

    if (!user) {
      router.push('/login')
      return
    }

    const fetchTickets = async () => {
      try {
        const response = await api.get('/tickets')
        setTickets(response.data)
      } catch (error) {
        console.error('Failed to fetch tickets:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTickets()
  }, [user, router, mounted])

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      assigned: 'bg-amber-100 text-amber-800',
      in_progress: 'bg-violet-100 text-violet-800',
      waiting_for_user: 'bg-orange-100 text-orange-800',
      resolved: 'bg-emerald-100 text-emerald-800',
      closed: 'bg-slate-100 text-slate-700',
      converted_to_incident: 'bg-indigo-100 text-indigo-800',
    }
    return colors[status] || 'bg-slate-100 text-slate-700'
  }

  const getStatusLabel = (status: string) => {
    if (status === 'converted_to_incident') return 'Converted to Incident'
    return status ? status.replace(/_/g, ' ') : 'new'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-slate-100 text-slate-700',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    }
    return colors[priority] || 'bg-slate-100 text-slate-700'
  }

  const isSLABreached = (slaDue: string | undefined) => {
    if (!slaDue) return false
    return new Date(slaDue) < new Date()
  }

  return (
    <ProtectedRoute allowedRoles={['user', 'it_support', 'admin']}>
      <div className="panel-page">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">IT Support Tickets</h1>
            {user?.role === 'user' && (
              <Link href="/tickets/create" className="btn-primary-tickets shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Ticket
              </Link>
            )}
          </div>

          {/* Search */}
          <div className="panel-card border border-gray-200">
            <label htmlFor="ticket-search" className="block text-sm font-medium text-gray-700 mb-2">Search tickets</label>
            <div className="relative max-w-xl">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                id="ticket-search"
                type="search"
                placeholder="Search by ticket #, title, type, status, priority, assignee..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                className="w-full max-w-xl pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              />
            </div>
            {searchQuery.trim() && (
              <p className="mt-2 text-sm text-gray-500">
                {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} match your search
              </p>
            )}
          </div>

          {loading ? (
            <div className="panel-card border border-gray-200 flex flex-col items-center justify-center py-16 text-gray-500">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mb-4" />
              <p>Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="panel-card border border-gray-200 text-center py-12 text-gray-500">No tickets found</div>
          ) : filteredTickets.length === 0 ? (
            <div className="panel-card border border-gray-200 text-center py-12 text-gray-500">No tickets match your search. Try different keywords.</div>
          ) : (
            <>
              <div className="panel-card overflow-hidden p-0 border border-gray-200 rounded-xl shadow-sm">
                <div className="overflow-auto max-h-[calc(100vh-16rem)] min-h-[220px]">
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
                    {paginatedTickets.map((ticket) => (
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
                          <span className={`pill ${getStatusColor(ticket.status || 'new')}`}>
                            {getStatusLabel(ticket.status || 'new')}
                          </span>
                          {ticket.status === 'converted_to_incident' && ticket.convertedIncidentId && (
                            <span className="ml-1.5 text-xs">
                              <Link href={`/incidents/${ticket.convertedIncidentId}`} className="text-indigo-600 hover:underline">
                                → {ticket.convertedIncidentNumber || 'View incident'}
                              </Link>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`pill ${getPriorityColor(ticket.priority || 'medium')}`}>
                            {ticket.priority || 'medium'}
                          </span>
                        </td>
                        {hasRole(user, 'it_support', 'admin') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {ticket.assignedToName || <span className="text-gray-400">Unassigned</span>}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {ticket.createdAt
                            ? new Date(ticket.createdAt).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {ticket.slaDue ? (
                            <span className={`text-xs font-medium ${isSLABreached(ticket.slaDue) ? 'text-red-600' : 'text-gray-600'}`}>
                              {isSLABreached(ticket.slaDue)
                                ? '⚠ Breached'
                                : new Date(ticket.slaDue).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-gray-600">
                  Showing {filteredTickets.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, filteredTickets.length)} of {filteredTickets.length} tickets
                  {searchQuery.trim() ? ` (filtered from ${tickets.length})` : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-pagination">
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-pagination">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
