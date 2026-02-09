const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query } = require('../config/database')
const { authenticate } = require('../middleware/auth')

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role = 'user' } = req.body

    // Validate role
    if (!['user', 'it_support', 'security_officer', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    // Check if user exists
    const existing = await query('users', 'select', {
      filters: [{ column: 'email', value: email }],
      single: true
    })

    if (existing) {
      return res.status(400).json({ message: 'User already exists' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const result = await query('users', 'insert', {
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        status: 'active'
      }
    })

    res.status(201).json({ message: 'User created successfully', userId: result.id })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user
    const user = await query('users', 'select', {
      filters: [{ column: 'email', value: email }],
      single: true
    })

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await query('users', 'select', {
      select: 'id, email, name, role',
      filters: [{ column: 'id', value: req.user.id }],
      single: true
    })
    res.json(user)
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Reset password
router.post('/reset-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' })
    }

    // Get user with password
    const user = await query('users', 'select', {
      filters: [{ column: 'id', value: req.user.id }],
      single: true
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await query('users', 'update', {
      filters: [{ column: 'id', value: req.user.id }],
      data: {
        password: hashedPassword,
        updated_at: new Date().toISOString()
      }
    })

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'RESET_PASSWORD',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: req.user.id,
        details: { message: 'User reset their password' }
      }
    })

    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

module.exports = router
