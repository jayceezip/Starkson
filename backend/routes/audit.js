const express = require('express')
const router = express.Router()
const { supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// audit_logs.created_at: set ONLY by the database (DEFAULT NOW() + trigger). Never send created_at on insert. Real-time.

// Philippine time (UTC+8): treat date-only YYYY-MM-DD as that day in Manila for filtering
function startOfDayPHT(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  return new Date(ymd + 'T00:00:00+08:00').toISOString()
}
function endOfDayPHT(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  return new Date(ymd + 'T23:59:59.999+08:00').toISOString()
}

// Export audit reports (must be before /:param routes)
const EXPORT_PAGE_SIZE = 1000

router.get('/export', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv', resourceType, action } = req.query

    const logs = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      let q = supabase
        .from('audit_logs')
        .select(`
          id, action, resource_type, resource_id, details, ip_address, created_at, user_id,
          user:users!audit_logs_user_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + EXPORT_PAGE_SIZE - 1)

      if (resourceType) q = q.eq('resource_type', resourceType)
      if (action) q = q.eq('action', action)
      const startISO = startOfDayPHT(startDate)
      const endISO = endOfDayPHT(endDate)
      if (startISO) q = q.gte('created_at', startISO)
      if (endISO) q = q.lte('created_at', endISO)

      const { data: page, error } = await q

      if (error) throw error
      if (!page || page.length === 0) break
      logs.push(...page)
      hasMore = page.length === EXPORT_PAGE_SIZE
      offset += EXPORT_PAGE_SIZE
    }

    if (format === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename=audit-report.json')
      res.setHeader('Content-Type', 'application/json')
      return res.json(logs || [])
    }

    const rows = (logs || []).map(l => ({
      id: l.id,
      createdAt: l.created_at,
      action: l.action,
      resourceType: l.resource_type || '',
      resourceId: l.resource_id || '',
      userName: l.user?.name || '',
      userEmail: l.user?.email || '',
      details: typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || ''),
      ipAddress: l.ip_address || ''
    }))

    const headers = ['id', 'createdAt', 'action', 'resourceType', 'resourceId', 'userName', 'userEmail', 'details', 'ipAddress']
    const csv = [headers.join(',')].concat(
      rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))
    ).join('\n')

    res.setHeader('Content-Disposition', 'attachment; filename=audit-report.csv')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.send('\uFEFF' + csv)
  } catch (error) {
    console.error('Export audit error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get audit logs (admin only) - immutable activity logs, who/when/what
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { limit = 200, offset = 0, resourceType, resourceId, action, startDate, endDate } = req.query

    const startISO = startOfDayPHT(startDate)
    const endISO = endOfDayPHT(endDate)
    let q = supabase
      .from('audit_logs')
      .select(`
        *,
        user:users!audit_logs_user_id_fkey(id, name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (resourceType) q = q.eq('resource_type', resourceType)
    if (resourceId) q = q.eq('resource_id', resourceId)
    if (action) q = q.eq('action', action)
    if (startISO) q = q.gte('created_at', startISO)
    if (endISO) q = q.lte('created_at', endISO)
    q = q.range(parseInt(offset, 10) || 0, (parseInt(offset, 10) || 0) + (parseInt(limit, 10) || 200) - 1)

    const { data: logs, error, count } = await q

    if (error) throw error

    const list = (logs || []).map(l => ({
      id: l.id,
      action: l.action,
      resourceType: l.resource_type,
      resourceId: l.resource_id,
      details: l.details,
      ipAddress: l.ip_address,
      userAgent: l.user_agent,
      createdAt: l.created_at,
      userName: l.user?.name,
      userEmail: l.user?.email,
      userId: l.user_id
    }))

    res.json({ logs: list, total: count ?? list.length })
  } catch (error) {
    console.error('Get audit logs error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get audit logs for a specific resource (record history - who/when/what)
router.get('/resource/:resourceType/:resourceId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select(`
        *,
        user:users!audit_logs_user_id_fkey(id, name, email)
      `)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    res.json((logs || []).map(l => ({
      id: l.id,
      action: l.action,
      details: l.details,
      createdAt: l.created_at,
      userName: l.user?.name,
      userEmail: l.user?.email
    })))
  } catch (error) {
    console.error('Get resource audit error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
