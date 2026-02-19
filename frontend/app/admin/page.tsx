'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'
import MaintenanceModal from '@/components/MaintenanceModal'

export default function AdminPanelPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTickets: 0,
    totalIncidents: 0,
    systemHealth: 'operational',
  })
  const [metrics, setMetrics] = useState<{
    ticketsThisWeek: { label: string; count: number }[]
    incidentStatus: { status: string; count: number }[]
    resolvedVsOpen: { resolved: number; open: number }
    sla: { within: number; breached: number }
  }>({
    ticketsThisWeek: [],
    incidentStatus: [],
    resolvedVsOpen: { resolved: 0, open: 0 },
    sla: { within: 0, breached: 0 },
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
    const fetchMetrics = async () => {
      try {
        const response = await api.get('/admin/metrics')
        setMetrics(response.data)
      } catch (error) {
        console.error('Failed to fetch admin metrics:', error)
      }
    }

    fetchStats()
    fetchMetrics()

    const interval = setInterval(fetchStats, 15000)
    const metricsInterval = setInterval(fetchMetrics, 15000)
    return () => {
      clearInterval(interval)
      clearInterval(metricsInterval)
    }
  }, [user, router, mounted])

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
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
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="panel-page">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin Panel</h1>

        {/* Dashboard stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="panel-card">
            <h3 className="panel-card-title">Total Users</h3>
            <p className="panel-card-value">{stats.totalUsers}</p>
          </div>
          <div className="panel-card">
            <h3 className="panel-card-title">Total Tickets</h3>
            <p className="panel-card-value">{stats.totalTickets}</p>
          </div>
          <div className="panel-card">
            <h3 className="panel-card-title">Total Incidents</h3>
            <p className="panel-card-value">{stats.totalIncidents}</p>
          </div>
          <div className="panel-card">
            <h3 className="panel-card-title">System Health</h3>
            <p className="text-2xl font-bold text-green-600">{stats.systemHealth}</p>
          </div>
        </div>

        {/* Administration */}
        <h2 className="panel-section-title">Administration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/admin/users" className="panel-card block hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <h3 className="font-semibold text-gray-900">User Management</h3>
            </div>
            <p className="text-sm text-gray-500">Manage users and roles</p>
          </Link>
          <Link href="/admin/sla" className="panel-card block hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <h3 className="font-semibold text-gray-900">SLA Configuration</h3>
            </div>
            <p className="text-sm text-gray-500">Configure SLA settings</p>
          </Link>
          <Link href="/admin/audit" className="panel-card block hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <h3 className="font-semibold text-gray-900">Audit Logs</h3>
            </div>
            <p className="text-sm text-gray-500">View system audit trail</p>
          </Link>
          <button
            type="button"
            onClick={() => setMaintenanceModalOpen(true)}
            className="panel-card block hover:shadow-md transition-shadow text-left w-full"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 text-sky-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <h3 className="font-semibold text-gray-900">Maintenance</h3>
            </div>
            <p className="text-sm text-gray-500">Manage branches, categories, affected systems, and incident categories</p>
          </button>
        </div>

        <MaintenanceModal isOpen={maintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} />

        {/* System Metrics - chart style cards (no Uptime per user request) */}
        <h2 className="panel-section-title">System Metrics</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Tickets this week - bar resets each week; list below = last week's tickets */}
          <div className="panel-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Tickets by weekday
                </h3>
                <span className="text-xs text-gray-500">This week only (resets each week)</span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {metrics.ticketsThisWeek.reduce((sum, d) => sum + d.count, 0)}
                </p>
                <p className="text-[11px] text-gray-500">tickets</p>
              </div>
            </div>
            <div className="h-40 flex items-end gap-2 mb-4">
              {metrics.ticketsThisWeek.length === 0 ? (
                <p className="text-sm text-gray-500">No ticket data for this week.</p>
              ) : (
                (() => {
                  const max = Math.max(...metrics.ticketsThisWeek.map((d) => d.count), 1)
                  return metrics.ticketsThisWeek.map((d) => {
                    const height = max ? (d.count / max) * 100 : 0
                    return (
                      <div
                        key={d.label}
                        className="relative flex-1 flex flex-col items-center justify-end h-full group"
                      >
                        <div
                          className="w-6 rounded-t-lg bg-sky-500/80 shadow-sm"
                          style={{
                            height: d.count === 0 ? '0%' : `${Math.max(8, height)}%`,
                          }}
                        />
                        {d.count > 0 && (
                          <div className="pointer-events-none absolute -top-6 px-2 py-0.5 rounded-md bg-gray-900 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            {d.count} {d.count === 1 ? 'ticket' : 'tickets'}
                          </div>
                        )}
                        <span className="mt-1 text-[11px] text-gray-500">
                          {d.label}
                        </span>
                      </div>
                    )
                  })
                })()
              )}
            </div>
            <p className="text-xs text-gray-500">
              Bar shows current week only (resets each week).
            </p>
          </div>

          {/* Incidents by status - pie chart + legend */}
          <div className="panel-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Incidents by status
              </h3>
              <span className="text-xs text-gray-500">Distribution</span>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-6">
              {metrics.incidentStatus.length === 0 ? (
                <p className="text-sm text-gray-500 py-8">No incidents recorded.</p>
              ) : (
                (() => {
                  const total = metrics.incidentStatus.reduce((sum, s) => sum + s.count, 0)
                  const colors = ['#3b82f6', '#eab308', '#f97316', '#10b981', '#a855f7', '#ec4899']
                  const cx = 50
                  const cy = 50
                  const r = 40
                  let acc = 0
                  const slices = metrics.incidentStatus.map((s, idx) => {
                    const pct = total > 0 ? s.count / total : 0
                    const startAngle = (acc * 360 - 90) * (Math.PI / 180)
                    acc += pct
                    const endAngle = (acc * 360 - 90) * (Math.PI / 180)
                    const x1 = cx + r * Math.cos(startAngle)
                    const y1 = cy + r * Math.sin(startAngle)
                    const x2 = cx + r * Math.cos(endAngle)
                    const y2 = cy + r * Math.sin(endAngle)
                    const large = pct > 0.5 ? 1 : 0
                    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
                    return { d, fill: colors[idx % colors.length], status: s.status, count: s.count, pct: total > 0 ? Math.round(pct * 100) : 0 }
                  })
                  return (
                    <>
                      <div className="flex-shrink-0 w-48 h-48">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          {slices.map((sl, i) => (
                            <path key={i} d={sl.d} fill={sl.fill} stroke="#fff" strokeWidth={1.5} />
                          ))}
                        </svg>
                      </div>
                      <div className="flex-1 w-full max-w-xs space-y-2">
                        {slices.map((sl, i) => (
                          <div key={sl.status} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sl.fill }} />
                              <span className="text-gray-700">{sl.status.replace(/_/g, ' ')}</span>
                            </div>
                            <span className="text-gray-500 font-medium">{sl.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()
              )}
            </div>
          </div>

          {/* Resolved vs open - stacked bar */}
          <div className="panel-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Resolved vs open
              </h3>
              <span className="text-xs text-gray-500">Ticket status</span>
            </div>
            <div className="mb-3">
              {(() => {
                const total =
                  metrics.resolvedVsOpen.resolved + metrics.resolvedVsOpen.open
                const resolvedPct =
                  total > 0
                    ? Math.round(
                        (metrics.resolvedVsOpen.resolved / total) * 100
                      )
                    : 0
                const openPct = total > 0 ? 100 - resolvedPct : 0
                return (
                  <div className="w-full h-6 rounded-full bg-gray-100 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${resolvedPct}%` }}
                    />
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${openPct}%` }}
                    />
                  </div>
                )
              })()}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
              {(() => {
                const total =
                  metrics.resolvedVsOpen.resolved + metrics.resolvedVsOpen.open
                const resolvedPct =
                  total > 0
                    ? Math.round(
                        (metrics.resolvedVsOpen.resolved / total) * 100
                      )
                    : 0
                const openPct = total > 0 ? 100 - resolvedPct : 0
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>
                        Resolved:{' '}
                        <span className="font-semibold">{resolvedPct}%</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span>
                        Open:{' '}
                        <span className="font-semibold">{openPct}%</span>
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
            <p className="text-xs text-gray-500">
              Quick view of current resolution performance.
            </p>
          </div>

          {/* SLA performance - radial style & legend */}
          <div className="panel-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                SLA performance
              </h3>
              <span className="text-xs text-gray-500">Last 30 days</span>
            </div>
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-sky-500"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${
                      (() => {
                        const total = metrics.sla.within + metrics.sla.breached
                        return total > 0
                          ? Math.round((metrics.sla.within / total) * 100)
                          : 0
                      })()
                    }, 100`}
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">
                    {(() => {
                      const total = metrics.sla.within + metrics.sla.breached
                      return total > 0
                        ? Math.round((metrics.sla.within / total) * 100)
                        : 0
                    })()}
                    %
                  </span>
                  <span className="text-[11px] text-gray-500">Within SLA</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 w-full">
                {(() => {
                  const total = metrics.sla.within + metrics.sla.breached
                  const withinPct =
                    total > 0
                      ? Math.round((metrics.sla.within / total) * 100)
                      : 0
                  const breachedPct = total > 0 ? 100 - withinPct : 0
                  return (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-sky-500" />
                          <span className="text-gray-700">Within SLA</span>
                        </div>
                        <span className="text-gray-500 font-medium">
                          {withinPct}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-gray-700">Breached</span>
                        </div>
                        <span className="text-gray-500 font-medium">
                          {breachedPct}%
                        </span>
                      </div>
                    </>
                  )
                })()}
                <p className="text-xs text-gray-500">
                  Percentage of tickets resolved within agreed response and resolution targets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
