const express = require('express')
const router = express.Router()
const { query } = require('../config/database')
const { authenticate } = require('../middleware/auth')

// Get user notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const { unreadOnly } = req.query
    let sql = 'SELECT * FROM notifications WHERE userId = ?'
    const params = [req.user.id]

    if (unreadOnly === 'true') {
      sql += ' AND isRead = FALSE'
    }

    sql += ' ORDER BY createdAt DESC LIMIT 50'
    const notifications = await query(sql, params)
    res.json(notifications)
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Mark notification as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const [notification] = await query('SELECT * FROM notifications WHERE id = ? AND userId = ?', [req.params.id, req.user.id])

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    await query('UPDATE notifications SET isRead = TRUE WHERE id = ?', [req.params.id])
    res.json({ message: 'Notification marked as read' })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await query('UPDATE notifications SET isRead = TRUE WHERE userId = ?', [req.user.id])
    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    console.error('Mark all read error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get unread count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const [result] = await query('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = FALSE', [req.user.id])
    res.json({ count: result.count })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
