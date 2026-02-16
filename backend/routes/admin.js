const express = require('express')
const router = express.Router()
const { supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Get admin panel stats (high-level counts)
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Count all users (all records, no limit)
    const { count: totalUsersCount, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (usersError) {
      console.error('Total users count error:', usersError)
      throw usersError
    }

    // Count all tickets (all records, no limit)
    const { count: totalTicketsCount, error: ticketsError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })

    if (ticketsError) {
      console.error('Total tickets count error:', ticketsError)
      throw ticketsError
    }

    // Count all incidents (all records, no limit)
    const { count: totalIncidentsCount, error: incidentsError } = await supabase
      .from('incidents')
      .select('*', { count: 'exact', head: true })

    if (incidentsError) {
      console.error('Total incidents count error:', incidentsError)
      throw incidentsError
    }

    res.json({
      totalUsers: totalUsersCount || 0,
      totalTickets: totalTicketsCount || 0,
      totalIncidents: totalIncidentsCount || 0,
      systemHealth: 'operational',
    })
  } catch (error) {
    console.error('Get admin stats error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Week bounds: Monday 00:00 UTC to next Monday 00:00 UTC (bar resets each week)
function getWeekStartEnd(weeksAgo = 0) {
  const now = new Date()
  const day = now.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + mondayOffset - 7 * weeksAgo,
    0, 0, 0, 0
  ))
  const nextMonday = new Date(thisMonday.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { start: thisMonday.toISOString(), end: nextMonday.toISOString() }
}

// Get admin system metrics for charts
router.get('/metrics', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { start: weekStartISO, end: weekEndISO } = getWeekStartEnd(0)

    // Tickets this week only (bar resets when week changes)
    const { data: ticketsThisWeekData, error: ticketsWeekError } = await supabase
      .from('tickets')
      .select('id, created_at')
      .gte('created_at', weekStartISO)
      .lt('created_at', weekEndISO)

    if (ticketsWeekError) {
      console.error('Tickets by weekday error:', ticketsWeekError)
      throw ticketsWeekError
    }

    const countsByWeekday = [0, 0, 0, 0, 0, 0, 0]
    ;(ticketsThisWeekData || []).forEach((t) => {
      if (!t.created_at) return
      const d = new Date(t.created_at)
      const idx = d.getUTCDay()
      if (!Number.isNaN(idx) && idx >= 0 && idx <= 6) countsByWeekday[idx] += 1
    })

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const ticketsThisWeek = weekdayLabels.map((label, idx) => ({
      label,
      count: countsByWeekday[idx] || 0,
    }))

    // Incidents by status
    const { data: incidentsData, error: incidentsError } = await supabase
      .from('incidents')
      .select('status')

    if (incidentsError) {
      console.error('Incidents by status error:', incidentsError)
      throw incidentsError
    }

    const incidentStatusMap = {}
    ;(incidentsData || []).forEach((row) => {
      const status = row.status || 'unknown'
      incidentStatusMap[status] = (incidentStatusMap[status] || 0) + 1
    })

    const incidentStatus = Object.entries(incidentStatusMap).map(
      ([status, count]) => ({ status, count })
    )

    // Resolved vs open (tickets)
    const openStatuses = ['new', 'assigned', 'in_progress', 'waiting_for_user']

    const { count: resolvedCount, error: resolvedError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['resolved', 'closed'])

    if (resolvedError) {
      console.error('Resolved tickets count error:', resolvedError)
      throw resolvedError
    }

    const { count: openCount, error: openError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', openStatuses)

    if (openError) {
      console.error('Open tickets count error:', openError)
      throw openError
    }

    // SLA performance (within vs breached)
    const { data: slaTickets, error: slaError } = await supabase
      .from('tickets')
      .select('id, sla_due, resolved_at')
      .not('sla_due', 'is', null)
      .not('resolved_at', 'is', null)

    if (slaError) {
      console.error('SLA performance error:', slaError)
      throw slaError
    }

    let withinSla = 0
    let breachedSla = 0
    ;(slaTickets || []).forEach((t) => {
      const due = t.sla_due ? new Date(t.sla_due) : null
      const resolved = t.resolved_at ? new Date(t.resolved_at) : null
      if (!due || !resolved) return
      if (resolved <= due) withinSla += 1
      else breachedSla += 1
    })

    res.json({
      ticketsThisWeek,
      incidentStatus,
      resolvedVsOpen: {
        resolved: resolvedCount || 0,
        open: openCount || 0,
      },
      sla: {
        within: withinSla,
        breached: breachedSla,
      },
    })
  } catch (error) {
    console.error('Get admin metrics error:', error)
    res
      .status(500)
      .json({ message: 'Server error', error: error.message || String(error) })
  }
})

module.exports = router
