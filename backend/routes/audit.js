const express = require('express')
const router = express.Router()
const { query } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Get audit logs (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const logs = await query(
      `SELECT al.*, u.name as userName, u.email as userEmail 
       FROM audit_logs al 
       LEFT JOIN users u ON al.userId = u.id 
       ORDER BY al.createdAt DESC 
       LIMIT 100`
    )
    res.json(logs)
  } catch (error) {
    console.error('Get audit logs error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get audit logs for specific resource
router.get('/:resourceType/:resourceId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params
    const logs = await query(
      `SELECT al.*, u.name as userName 
       FROM audit_logs al 
       LEFT JOIN users u ON al.userId = u.id 
       WHERE al.resourceType = ? AND al.resourceId = ? 
       ORDER BY al.createdAt DESC`,
      [resourceType, resourceId]
    )
    res.json(logs)
  } catch (error) {
    console.error('Get resource audit logs error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
