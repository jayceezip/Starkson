const express = require('express')
const router = express.Router()
const { supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Get admin panel stats
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

module.exports = router
