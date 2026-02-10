'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api, { getApiBaseUrl } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'

interface AuditLog {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  details: unknown
  createdAt: string
  userName: string | null
  userEmail: string | null
}

export default function AdminAuditPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const PAGE_SIZE = 10
  const [data, setData] = useState<{ logs: AuditLog[]; total: number }>({ logs: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ resourceType: '', action: '', startDate: '', endDate: '' })

  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.resourceType) params.set('resourceType', filters.resourceType)
      if (filters.action) params.set('action', filters.action)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String((page - 1) * PAGE_SIZE))
      const res = await api.get(`/audit?${params.toString()}`)
      setData({ logs: res.data.logs || [], total: res.data.total ?? res.data.logs?.length ?? 0 })
    } catch (e) {
      console.error('Failed to fetch audit logs:', e)
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
    fetchLogs()
  }, [mounted, user, router, page, filters.resourceType, filters.action, filters.startDate, filters.endDate])

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  const startRow = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endRow = Math.min(page * PAGE_SIZE, data.total)

  const handleExport = async (format: 'csv' | 'json') => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
    const params = new URLSearchParams()
    if (filters.resourceType) params.set('resourceType', filters.resourceType)
    if (filters.action) params.set('action', filters.action)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    params.set('format', format)
    const url = `${getApiBaseUrl()}/audit/export?${params.toString()}`
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `audit-report.${format}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      // ignore
    }
  }

  const fetchAllLogsForExport = async (): Promise<AuditLog[]> => {
    const allLogs: AuditLog[] = []
    const chunkSize = 1000
    let offset = 0
    let hasMore = true
    while (hasMore) {
      const params = new URLSearchParams()
      if (filters.resourceType) params.set('resourceType', filters.resourceType)
      if (filters.action) params.set('action', filters.action)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      params.set('limit', String(chunkSize))
      params.set('offset', String(offset))
      const res = await api.get(`/audit?${params.toString()}`)
      const logs: AuditLog[] = res.data.logs || []
      allLogs.push(...logs)
      hasMore = logs.length === chunkSize
      offset += chunkSize
    }
    return allLogs
  }

  const handleExportPdf = async () => {
    try {
      const allLogs = await fetchAllLogsForExport()
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ])
      const jsPDF = jsPDFModule.default
      const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/STARKSON-LG.png` : ''
      let startY = 14
      if (logoUrl) {
        try {
          const imgResp = await fetch(logoUrl)
          const imgBlob = await imgResp.blob()
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(imgBlob)
          })
          const imgW = 45
          const imgH = 14
          doc.addImage(base64, 'PNG', 14, 5, imgW, imgH)
          startY = 24
        } catch {
          startY = 14
        }
      }
      doc.setFontSize(16)
      doc.text('Audit Report (full report)', 14, startY)
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleString()} | Total entries: ${allLogs.length}`, 14, startY + 7)
      if (filters.startDate || filters.endDate) {
        doc.text(`Period: ${filters.startDate || '—'} to ${filters.endDate || '—'}`, 14, startY + 14)
      }
      const tableStartY = startY + 18
      const tableData = allLogs.map((log) => [
        log.createdAt ? new Date(log.createdAt).toLocaleString() : '—',
        log.action || '—',
        log.userName || log.userEmail || '—',
        (log.resourceType && log.resourceId) ? `${log.resourceType} / ${String(log.resourceId).slice(0, 8)}…` : '—',
        log.details != null ? (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)).slice(0, 40) : '—'
      ])
      autoTable(doc, {
        head: [['Time', 'Action', 'User', 'Resource', 'Details']],
        body: tableData,
        startY: tableStartY,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 66, 66] }
      })
      doc.save('audit-report.pdf')
    } catch (e) {
      console.error('PDF export failed:', e)
      alert('Failed to generate PDF. Ensure jspdf is installed.')
    }
  }

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <div className="panel-page flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="panel-page">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin" className="text-gray-500 hover:text-gray-900">← Admin Panel</Link>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        </div>
        <p className="text-gray-500 mb-6">
          Immutable activity logs — who, when, what. Record history and exportable audit reports (ISO 27001 / ISO 27035 alignment).
        </p>

        <div className="panel-card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resource type</label>
              <input
                type="text"
                value={filters.resourceType}
                onChange={(e) => { setFilters({ ...filters, resourceType: e.target.value }); setPage(1) }}
                placeholder="e.g. ticket, incident"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1) }}
                placeholder="e.g. CREATE_TICKET"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => { setFilters({ ...filters, startDate: e.target.value }); setPage(1) }}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => { setFilters({ ...filters, endDate: e.target.value }); setPage(1) }}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')} className="px-4 py-2 border rounded hover:bg-gray-50">
              Export CSV
            </button>
            <button onClick={() => handleExport('json')} className="px-4 py-2 border rounded hover:bg-gray-50">
              Export JSON
            </button>
            <button onClick={handleExportPdf} className="px-4 py-2 border rounded hover:bg-gray-50 bg-red-50 text-red-800 border-red-200">
              Export PDF
            </button>
          </div>
        </div>

        <div className="panel-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : (
              <table className="min-w-[800px] w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{log.action}</td>
                      <td className="px-4 py-3 text-sm">
                        {log.userName || log.userEmail || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.resourceType && log.resourceId
                          ? `${log.resourceType} / ${String(log.resourceId).slice(0, 8)}…`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {log.details != null ? (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="px-4 py-3 border-t flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-500">
              Showing {startRow}–{endRow} of {data.total} log entries
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
