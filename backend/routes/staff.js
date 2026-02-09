const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Get staff dashboard stats
router.get('/stats', authenticate, authorize('it_support', 'admin'), async (req, res) => {
  try {
    // Assigned tickets count (assigned to current user, not resolved/closed)
    // Use Supabase directly for complex filtering with NOT IN
    const { count: assignedTicketsCount, error: assignedError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', req.user.id)
      .not('status', 'eq', 'resolved')
      .not('status', 'eq', 'closed')
    
    if (assignedError) throw assignedError

    // Pending tickets count (status: new, unassigned) - all records
    const { count: pendingTicketsCount, error: pendingError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new')
      .is('assigned_to', null)
    
    if (pendingError) throw pendingError

    // Resolved today count (assigned to current user, closed today)
    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { count: resolvedTodayCount, error: resolvedTodayError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', req.user.id)
      .eq('status', 'closed')
      .gte('closed_at', today.toISOString())
      .lt('closed_at', tomorrow.toISOString())

    if (resolvedTodayError) throw resolvedTodayError

    res.json({
      assignedTickets: assignedTicketsCount || 0,
      pendingTickets: pendingTicketsCount || 0,
      resolvedToday: resolvedTodayCount || 0,
    })
  } catch (error) {
    console.error('Get staff stats error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

module.exports = router
