const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')

// Generate incident number - use max existing number to avoid duplicates
const generateIncidentNumber = async () => {
  const year = new Date().getFullYear()
  const { data: existingIncidents, error: countError } = await supabase
    .from('incidents')
    .select('incident_number')
    .gte('created_at', `${year}-01-01T00:00:00Z`)
    .order('incident_number', { ascending: false })
    .limit(1)
  
  let nextNumber = 1
  if (existingIncidents && existingIncidents.length > 0) {
    const lastNumber = existingIncidents[0].incident_number
    const match = lastNumber.match(/INC-\d{4}-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }
  
  return `INC-${year}-${String(nextNumber).padStart(6, '0')}`
}

// Get all incidents (Security Officer and Admin only)
router.get('/', authenticate, authorize('security_officer', 'admin'), async (req, res) => {
  try {
    const { status, severity, category } = req.query
    let filters = []

    if (status) filters.push({ column: 'status', value: status })
    if (severity) filters.push({ column: 'severity', value: severity })
    if (category) filters.push({ column: 'category', value: category })

    const incidents = await query('incidents', 'select', {
      select: `
        *,
        created_by_user:users!incidents_created_by_fkey(id, name),
        assigned_to_user:users!incidents_assigned_to_fkey(id, name),
        source_ticket:tickets!incidents_source_ticket_id_fkey(ticket_number)
      `,
      filters: filters.length > 0 ? filters : undefined,
      orderBy: { column: 'created_at', ascending: false }
    })

    // Get timeline and attachment counts
    const incidentsWithCounts = await Promise.all(incidents.map(async (incident) => {
      const [timelineCount, attachmentCount] = await Promise.all([
        query('incident_timeline', 'count', {
          filters: [{ column: 'incident_id', value: incident.id }]
        }),
        query('attachments', 'count', {
          filters: [
            { column: 'record_type', value: 'incident' },
            { column: 'record_id', value: incident.id }
          ]
        })
      ])
      return {
        ...incident,
        // Snake case (from DB)
        incident_number: incident.incident_number,
        created_at: incident.created_at,
        // Camel case (for frontend compatibility)
        incidentNumber: incident.incident_number,
        createdAt: incident.created_at,
        // Counts and names
        timelineCount: timelineCount.count || 0,
        attachmentCount: attachmentCount.count || 0,
        createdByName: incident.created_by_user?.name,
        assignedToName: incident.assigned_to_user?.name,
        sourceTicketNumber: incident.source_ticket?.ticket_number
      }
    }))

    res.json(incidentsWithCounts)
  } catch (error) {
    console.error('Get incidents error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get single incident with details
// Security Officer and Admin can view all incidents
// IT Support can view incidents converted from tickets they have access to
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Use Supabase directly to ensure proper foreign key relationships
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select(`
        *,
        created_by_user:users!incidents_created_by_fkey(id, name, email),
        assigned_to_user:users!incidents_assigned_to_fkey(id, name, email),
        source_ticket:tickets!incidents_source_ticket_id_fkey(ticket_number, created_by, assigned_to)
      `)
      .eq('id', req.params.id)
      .single()

    if (incidentError || !incident) {
      console.error('Error fetching incident:', incidentError)
      return res.status(404).json({ message: 'Incident not found' })
    }

    // RBAC: IT Support can view incidents converted from tickets (all IT Support can view converted incidents)
    if (req.user.role === 'it_support') {
      if (!incident.source_ticket_id) {
        // If incident has no source ticket, IT Support cannot view it
        return res.status(403).json({ message: 'Forbidden' })
      }
      // All IT Support users can view incidents converted from tickets
      // No need to check ticket assignment - any IT Support can view converted incidents
    } else if (req.user.role === 'user') {
      // Regular users cannot view incidents
      return res.status(403).json({ message: 'Forbidden' })
    } else if (!['security_officer', 'admin'].includes(req.user.role)) {
      // Only security_officer, admin, and it_support (with conditions) can view incidents
      return res.status(403).json({ message: 'Forbidden' })
    }

    // Get timeline - filter based on user role
    // Users see non-internal entries (investigation updates), Security Officers see all
    let timelineQuery = supabase
      .from('incident_timeline')
      .select(`
        *,
        user:users!incident_timeline_user_id_fkey(id, name, email)
      `)
      .eq('incident_id', req.params.id)
      .order('created_at', { ascending: true })
    
    // If user is a regular user, only show non-internal timeline entries
    if (req.user.role === 'user') {
      timelineQuery = timelineQuery.eq('is_internal', false)
    }
    // Security Officers, IT Support, and Admin see all timeline entries
    
    const { data: timelineData, error: timelineError } = await timelineQuery
    
    if (timelineError) {
      console.error('Error fetching incident timeline:', timelineError)
    }
    
    const timeline = timelineData || []

    // Get attachments
    const attachments = await query('attachments', 'select', {
      filters: [
        { column: 'record_type', value: 'incident' },
        { column: 'record_id', value: req.params.id }
      ]
    })

    res.json({
      ...incident,
      // Snake case (from DB)
      incident_number: incident.incident_number,
      created_at: incident.created_at,
      // Camel case (for frontend compatibility)
      incidentNumber: incident.incident_number,
      createdAt: incident.created_at,
      // User names
      createdByName: incident.created_by_user?.name,
      createdByEmail: incident.created_by_user?.email,
      assignedToName: incident.assigned_to_user?.name,
      assignedToEmail: incident.assigned_to_user?.email,
      sourceTicketNumber: incident.source_ticket?.ticket_number,
      // Timeline with formatted dates
      timeline: timeline.map(t => ({
        ...t,
        userName: t.user?.name || 'Unknown User',
        userEmail: t.user?.email,
        createdAt: t.created_at,
        isInternal: t.is_internal
      })),
      // Attachments with formatted dates
      attachments: attachments.map(a => ({
        ...a,
        createdAt: a.created_at,
        originalName: a.original_name
      }))
    })
  } catch (error) {
    console.error('Get incident error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Create incident (Security Officer and Admin only)
router.post('/', authenticate, authorize('security_officer', 'admin'), async (req, res) => {
  try {
    const {
      detectionMethod,
      category,
      title,
      description,
      severity,
      impactConfidentiality,
      impactIntegrity,
      impactAvailability,
      affectedAsset,
      affectedUser,
      sourceTicketId
    } = req.body

    if (!category || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const incidentNumber = await generateIncidentNumber()

    const result = await query('incidents', 'insert', {
      data: {
        incident_number: incidentNumber,
        source_ticket_id: sourceTicketId || null,
        detection_method: detectionMethod || 'user_reported',
        category,
        title,
        description,
        severity: severity || 'medium',
        impact_confidentiality: impactConfidentiality || 'none',
        impact_integrity: impactIntegrity || 'none',
        impact_availability: impactAvailability || 'none',
        affected_asset: affectedAsset || null,
        affected_user: affectedUser || null,
        created_by: req.user.id,
        status: 'new'
      }
    })

    // Add timeline entry
    await query('incident_timeline', 'insert', {
      data: {
        incident_id: result.id,
        user_id: req.user.id,
        action: 'INCIDENT_CREATED',
        description: 'Incident created'
      }
    })

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'CREATE_INCIDENT',
        user_id: req.user.id,
        resource_type: 'incident',
        resource_id: result.id,
        details: { incident_number: incidentNumber, category, severity }
      }
    })

    res.status(201).json({ message: 'Incident created', incidentId: result.id, incidentNumber })
  } catch (error) {
    console.error('Create incident error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update incident
router.put('/:id', authenticate, authorize('security_officer', 'admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      severity,
      status,
      assignedTo,
      impactConfidentiality,
      impactIntegrity,
      impactAvailability,
      affectedAsset,
      affectedUser,
      rootCause,
      resolutionSummary
    } = req.body

    const incident = await query('incidents', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    const updateData = {}
    if (title) updateData.title = title
    if (description) updateData.description = description
    if (severity) updateData.severity = severity
    if (status) {
      updateData.status = status
      // Set timestamps based on status
      if (status === 'triaged' && !incident.triaged_at) updateData.triaged_at = new Date().toISOString()
      if (status === 'contained' && !incident.contained_at) updateData.contained_at = new Date().toISOString()
      if (status === 'recovered' && !incident.recovered_at) updateData.recovered_at = new Date().toISOString()
      if (status === 'closed' && !incident.closed_at) updateData.closed_at = new Date().toISOString()
    }
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null
    if (impactConfidentiality) updateData.impact_confidentiality = impactConfidentiality
    if (impactIntegrity) updateData.impact_integrity = impactIntegrity
    if (impactAvailability) updateData.impact_availability = impactAvailability
    if (affectedAsset !== undefined) updateData.affected_asset = affectedAsset || null
    if (affectedUser !== undefined) updateData.affected_user = affectedUser || null
    if (rootCause !== undefined) updateData.root_cause = rootCause || null
    if (resolutionSummary !== undefined) updateData.resolution_summary = resolutionSummary || null
    updateData.updated_at = new Date().toISOString()

    await query('incidents', 'update', {
      filters: [{ column: 'id', value: req.params.id }],
      data: updateData
    })

    // Add timeline entry for status changes
    if (status && status !== incident.status) {
      // Make status changes visible to users (non-internal) so they can see investigation progress
      const isInvestigationStatus = ['triaged', 'investigating', 'contained', 'recovered', 'closed'].includes(status)
      await query('incident_timeline', 'insert', {
        data: {
          incident_id: req.params.id,
          user_id: req.user.id,
          action: 'STATUS_CHANGED',
          description: `Status changed from ${incident.status} to ${status}`,
          is_internal: !isInvestigationStatus // Show investigation status to users
        }
      })
    }
    
    // Add timeline entry for assignment changes
    if (assignedTo !== undefined && assignedTo !== incident.assigned_to) {
      const { data: assignedUser } = await supabase
        .from('users')
        .select('name, role')
        .eq('id', assignedTo)
        .single()
      
      await query('incident_timeline', 'insert', {
        data: {
          incident_id: req.params.id,
          user_id: req.user.id,
          action: 'INCIDENT_ASSIGNED',
          description: `Incident assigned to ${assignedUser?.name || 'Security Officer'} (${assignedUser?.role || 'security_officer'})`,
          is_internal: false // Visible to users
        }
      })
    }

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'UPDATE_INCIDENT',
        user_id: req.user.id,
        resource_type: 'incident',
        resource_id: req.params.id,
        details: req.body
      }
    })

    res.json({ message: 'Incident updated' })
  } catch (error) {
    console.error('Update incident error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Add timeline entry
router.post('/:id/timeline', authenticate, authorize('security_officer', 'admin'), async (req, res) => {
  try {
    const { action, description, isInternal = true } = req.body

    const incident = await query('incidents', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    const result = await query('incident_timeline', 'insert', {
      data: {
        incident_id: req.params.id,
        user_id: req.user.id,
        action,
        description,
        is_internal: isInternal
      }
    })

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'ADD_TIMELINE_ENTRY',
        user_id: req.user.id,
        resource_type: 'incident',
        resource_id: req.params.id
      }
    })

    res.status(201).json({ message: 'Timeline entry added', entryId: result.id })
  } catch (error) {
    console.error('Add timeline entry error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
