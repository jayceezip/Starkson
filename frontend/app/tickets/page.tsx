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

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const paginatedTickets = tickets.slice(start, start + PAGE_SIZE)

  // Clamp page when list shrinks (e.g. after filter)
  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages)
  }, [tickets.length, totalPages, page])

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
      assigned: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-purple-100 text-purple-800',
      waiting_for_user: 'bg-orange-100 text-orange-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      converted_to_incident: 'bg-indigo-100 text-indigo-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    if (status === 'converted_to_incident') return 'Converted to Incident'
    return status ? status.replace(/_/g, ' ') : 'new'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  const isSLABreached = (slaDue: string | undefined) => {
    if (!slaDue) return false
    return new Date(slaDue) < new Date()
  }

  return (
    <ProtectedRoute allowedRoles={['user', 'it_support', 'admin']}>
      <div className="panel-page">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">IT Support Tickets</h1>
          {user?.role === 'user' && (
            <Link
              href="/tickets/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Create Ticket
            </Link>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="panel-card text-center py-8 text-gray-500">No tickets found</div>
        ) : (
          <>
            <div className="panel-card overflow-hidden p-0 border border-gray-200 rounded-xl">
              <div className="overflow-auto max-h-[calc(100vh-14rem)] min-h-[200px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      {hasRole(user, 'it_support', 'admin') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SLA</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/tickets/${ticket.id}`} className="text-blue-600 hover:underline font-mono">
                        {ticket.ticketNumber || ticket.ticketNumber || `#${ticket.id}`}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {ticket.requestType || ticket.requestType 
                          ? (ticket.requestType || ticket.requestType).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/tickets/${ticket.id}`} className="text-blue-600 hover:underline">
                        {ticket.title || 'Untitled'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(ticket.status || 'new')}`}>
                        {getStatusLabel(ticket.status || 'new')}
                      </span>
                      {ticket.status === 'converted_to_incident' && ticket.convertedIncidentId && (
                        <span className="ml-1 text-xs">
                          <Link href={`/incidents/${ticket.convertedIncidentId}`} className="text-indigo-600 hover:underline">
                            → {ticket.convertedIncidentNumber || 'View incident'}
                          </Link>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(ticket.priority || 'medium')}`}>
                        {ticket.priority || 'medium'}
                      </span>
                    </td>
                    {hasRole(user, 'it_support', 'admin') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {ticket.assignedToName || 'Unassigned'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {ticket.createdAt || ticket.createdAt 
                        ? new Date(ticket.createdAt || ticket.createdAt).toLocaleString('en-US', {
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
                      {ticket.slaDue || ticket.slaDue ? (
                        <span className={`text-xs ${isSLABreached(ticket.slaDue || ticket.slaDue) ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                          {isSLABreached(ticket.slaDue || ticket.slaDue) 
                            ? '⚠ Breached' 
                            : new Date(ticket.slaDue || ticket.slaDue).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-600">
                  Showing {tickets.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, tickets.length)} of {tickets.length} tickets
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
