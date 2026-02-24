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
    let assignedIncidents = 0
    let openIncidents = 0
    let resolvedIncidents = 0 // Renamed from recoveredIncidents to include both recovered AND closed
    
    if (req.user.role === 'security_officer' || req.user.role === 'admin') {
      // Total incidents
      const { count: incCount, error: incidentsError } = await supabase
        .from('incidents')
        .select('*', { count: 'exact', head: true })
      if (!incidentsError) incidentsCount = incCount || 0
      console.log('Total incidents count:', incidentsCount)
      
      // For Security Officer - get incidents assigned to them
      if (req.user.role === 'security_officer') {
        // ALL incidents assigned to current user (including resolved/closed)
        const { count: assignedCount, error: assignedError } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', req.user.id)
        
        if (!assignedError) assignedIncidents = assignedCount || 0
        console.log('Assigned incidents count (all):', assignedIncidents)
        
        // Open incidents assigned to current user (not closed or recovered)
        const { count: openCount, error: openError } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', req.user.id)
          .not('status', 'in', '("closed","recovered")')
        
        if (!openError) openIncidents = openCount || 0
        console.log('Open incidents assigned to user:', openIncidents)
        
        // RESOLVED incidents assigned to current user (both recovered AND closed)
        const { count: resolvedCount, error: resolvedError } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', req.user.id)
          .in('status', ['recovered', 'closed'])
        
        if (!resolvedError) resolvedIncidents = resolvedCount || 0
        console.log('Resolved incidents assigned to user (recovered + closed):', resolvedIncidents)
      }
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

    const response = {
      tickets: ticketsCount || 0,
      incidents: incidentsCount || 0,
      openTickets: openTicketsCount || 0,
      resolvedTickets: resolvedTicketsCount || 0,
      // Security Officer specific stats
      assignedIncidents: assignedIncidents || 0,
      openIncidents: openIncidents || 0,
      resolvedIncidents: resolvedIncidents || 0, // Changed from recoveredIncidents
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