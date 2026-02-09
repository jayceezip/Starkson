const express = require('express')
const router = express.Router()
const { query } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Get SLA configuration (Admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const sla = await query('SELECT * FROM sla_config WHERE isActive = 1 ORDER BY FIELD(priority, "urgent", "high", "medium", "low")')
    res.json(sla)
  } catch (error) {
    console.error('Get SLA config error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update SLA configuration (Admin only)
router.put('/:priority', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { priority } = req.params
    const { responseTimeMinutes, resolutionTimeHours } = req.body

    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ message: 'Invalid priority' })
    }

    await query(
      'UPDATE sla_config SET responseTimeMinutes = ?, resolutionTimeHours = ?, updatedAt = NOW() WHERE priority = ?',
      [responseTimeMinutes, resolutionTimeHours, priority]
    )

    // Log audit
    await query(
      'INSERT INTO audit_logs (action, userId, resourceType, resourceId, details) VALUES (?, ?, ?, ?, ?)',
      ['UPDATE_SLA', req.user.id, 'sla_config', priority, JSON.stringify({ responseTimeMinutes, resolutionTimeHours })]
    )

    res.json({ message: 'SLA configuration updated' })
  } catch (error) {
    console.error('Update SLA config error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get SLA compliance stats
router.get('/compliance', authenticate, authorize('it_support', 'admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    let sql = `
      SELECT 
        t.priority,
        COUNT(*) as total,
        SUM(CASE WHEN t.slaDue < NOW() AND t.status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) as breached,
        AVG(TIMESTAMPDIFF(HOUR, t.createdAt, COALESCE(t.resolvedAt, NOW()))) as avgResolutionHours
      FROM tickets t
      WHERE 1=1
    `
    const params = []

    if (startDate) {
      sql += ' AND DATE(t.createdAt) >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND DATE(t.createdAt) <= ?'
      params.push(endDate)
    }

    sql += ' GROUP BY t.priority'

    const stats = await query(sql, params)
    res.json(stats)
  } catch (error) {
    console.error('Get SLA compliance error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
