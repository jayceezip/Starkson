const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate } = require('../middleware/auth')

// Get dashboard stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    console.log('Dashboard stats requested by user:', req.user.id, 'role:', req.user.role)

    // Total tickets count
    // Note: Converted tickets are deleted from database, so no need to exclude them
    let totalTicketsQuery = supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
    
    if (req.user.role === 'user') {
      console.log('Filtering tickets for user:', req.user.id, 'Type:', typeof req.user.id)
      totalTicketsQuery = totalTicketsQuery.eq('created_by', req.user.id)
    } else if (req.user.role === 'it_support') {
      // IT Support can see assigned tickets and unassigned tickets
      totalTicketsQuery = totalTicketsQuery.or(`assigned_to.eq.${req.user.id},assigned_to.is.null`)
      console.log('IT Support filter applied for user:', req.user.id)
    } else {
      console.log('Admin/Staff user - fetching all tickets')
    }
    
    const { count: ticketsCount, error: ticketsError } = await totalTicketsQuery
    if (ticketsError) {
      console.error('Total tickets count error:', ticketsError)
      throw ticketsError
    }
    console.log('Total tickets count:', ticketsCount, 'for user:', req.user.id, 'role:', req.user.role)

    // Total incidents count: only for security_officer and admin (role-based)
    let incidentsCount = 0
    if (req.user.role === 'security_officer' || req.user.role === 'admin') {
      const { count: incCount, error: incidentsError } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
      if (!incidentsError) incidentsCount = incCount || 0
      console.log('Total incidents count:', incidentsCount)
    }

    // Open tickets count (status: new, assigned, in_progress, waiting_for_user)
    const openStatuses = ['new', 'assigned', 'in_progress', 'waiting_for_user']
    let openTicketsQuery = supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', openStatuses)
    
    if (req.user.role === 'user') {
      openTicketsQuery = openTicketsQuery.eq('created_by', req.user.id)
    } else if (req.user.role === 'it_support') {
      openTicketsQuery = openTicketsQuery.or(`assigned_to.eq.${req.user.id},assigned_to.is.null`)
    }
    
    const { count: openTicketsCount, error: openError } = await openTicketsQuery
    if (openError) {
      console.error('Open tickets count error:', openError)
      throw openError
    }
    console.log('Open tickets count:', openTicketsCount)

    // Resolved tickets count (status: closed or resolved)
    let resolvedTicketsQuery = supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['closed', 'resolved'])
    
    if (req.user.role === 'user') {
      resolvedTicketsQuery = resolvedTicketsQuery.eq('created_by', req.user.id)
    } else if (req.user.role === 'it_support') {
      resolvedTicketsQuery = resolvedTicketsQuery.or(`assigned_to.eq.${req.user.id},assigned_to.is.null`)
    }
    
    const { count: resolvedTicketsCount, error: resolvedError } = await resolvedTicketsQuery
    if (resolvedError) {
      console.error('Resolved tickets count error:', resolvedError)
      throw resolvedError
    }
    console.log('Resolved tickets count:', resolvedTicketsCount)

    // Debug: Also fetch actual tickets to verify they exist
    let debugQuery = supabase.from('tickets').select('id, ticket_number, status, created_by, assigned_to, created_at')
    if (req.user.role === 'user') {
      debugQuery = debugQuery.eq('created_by', req.user.id)
    } else if (req.user.role === 'it_support') {
      debugQuery = debugQuery.or(`assigned_to.eq.${req.user.id},assigned_to.is.null`)
    }
    const { data: debugTickets, error: debugError } = await debugQuery.limit(5)
    if (!debugError) {
      console.log('Sample tickets found:', debugTickets?.length || 0)
      if (debugTickets && debugTickets.length > 0) {
        console.log('First ticket sample:', {
          id: debugTickets[0].id,
          ticket_number: debugTickets[0].ticket_number,
          status: debugTickets[0].status,
          created_by: debugTickets[0].created_by,
          assigned_to: debugTickets[0].assigned_to,
          user_id: req.user.id,
          role: req.user.role
        })
      } else {
        console.log('⚠️ No tickets found matching the filter criteria')
      }
    } else {
      console.error('Debug query error:', debugError)
    }

    const response = {
      tickets: ticketsCount || 0,
      incidents: incidentsCount || 0,
      openTickets: openTicketsCount || 0,
      resolvedTickets: resolvedTicketsCount || 0,
    }
    console.log('Dashboard stats response:', response)
    res.json(response)
  } catch (error) {
    console.error('Get dashboard stats error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Get recent activity from notifications table (ticket/incident actions relevant to this user) — for dashboard
router.get('/activity', authenticate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 50)
    const { data: rows, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, resource_type, resource_id, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const list = (rows || []).map((n) => ({
      id: n.id,
      action: n.type,
      resourceType: n.resource_type,
      resourceId: n.resource_id,
      details: { title: n.title, message: n.message },
      createdAt: n.created_at,
    }))

    res.json({ activity: list })
  } catch (error) {
    console.error('Get dashboard activity error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

module.exports = router
