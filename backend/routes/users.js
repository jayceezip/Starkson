const express = require('express')
const router = express.Router()
const { query } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Get all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await query('SELECT id, email, name, role, createdAt FROM users ORDER BY createdAt DESC')
    res.json(users)
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get single user
router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [user] = await query('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [req.params.id])

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json(user)
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update user role
router.put('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body

    if (!['user', 'it_support', 'security_officer', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    await query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id])

    // Log audit
    await query(
      'INSERT INTO audit_logs (action, userId, resourceType, resourceId) VALUES (?, ?, ?, ?)',
      ['UPDATE_USER_ROLE', req.user.id, 'user', req.params.id]
    )

    res.json({ message: 'User role updated' })
  } catch (error) {
    console.error('Update user role error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
