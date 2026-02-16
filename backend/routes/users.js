const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')
const { BRANCHES } = require('../constants/branches')

const VALID_ACRONYMS = new Set(BRANCHES.map(b => b.acronym))

// Get security officers only (for convert-to-incident assignment; it_support and admin)
router.get('/security-officers', authenticate, authorize('it_support', 'security_officer', 'admin'), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'security_officer')
      .eq('status', 'active')
      .order('name', { ascending: true })
    if (error) throw error
    res.json(users || [])
  } catch (error) {
    console.error('Get security officers error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, status, branch_acronyms, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json((users || []).map(u => ({
      ...u,
      branchAcronyms: Array.isArray(u.branch_acronyms) ? u.branch_acronyms : [],
      createdAt: u.created_at,
      updatedAt: u.updated_at
    })))
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get single user (admin only)
router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, status, branch_acronyms, created_at, updated_at')
      .eq('id', req.params.id)
      .single()

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({
      ...user,
      branchAcronyms: Array.isArray(user.branch_acronyms) ? user.branch_acronyms : [],
      createdAt: user.created_at,
      updatedAt: user.updated_at
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update user role (admin only)
router.put('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body

    if (!['user', 'it_support', 'security_officer', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' })
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ message: 'User not found' })
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    await query('audit_logs', 'insert', {
      data: {
        action: 'UPDATE_USER_ROLE',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: req.params.id,
        details: { previousRole: existing.role, newRole: role }
      }
    })

    res.json({ message: 'User role updated' })
  } catch (error) {
    console.error('Update user role error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update user branches (admin only)
router.put('/:id/branches', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { branchAcronyms } = req.body
    const normalized = Array.isArray(branchAcronyms)
      ? branchAcronyms.filter(a => typeof a === 'string' && VALID_ACRONYMS.has(a.trim()))
      : []

    const { data: existing } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (existing.role === 'admin') {
      return res.status(400).json({ message: 'Admin users do not have branch assignments' })
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ branch_acronyms: normalized, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    res.json({ message: 'User branches updated' })
  } catch (error) {
    console.error('Update user branches error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update user status (admin only)
router.put('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    await query('audit_logs', 'insert', {
      data: {
        action: 'UPDATE_USER_STATUS',
        user_id: req.user.id,
        resource_type: 'user',
        resource_id: req.params.id,
        details: { status }
      }
    })

    res.json({ message: 'User status updated' })
  } catch (error) {
    console.error('Update user status error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
