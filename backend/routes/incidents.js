const express = require('express')
const router = express.Router()
const { query, supabase } = require('../config/database')
const { authenticate, authorize } = require('../middleware/auth')
const { getValidAcronyms } = require('../lib/branches')

// Generate incident number by branch: INC-D01-000001
const generateIncidentNumber = async (branchAcronym) => {
  const { data: lastIncidents, error } = await supabase
    .from('incidents')
    .select('incident_number')
    .eq('branch_acronym', branchAcronym)
    .order('created_at', { ascending: false })
    .limit(1)
  let nextSeq = 1
  if (!error && lastIncidents && lastIncidents.length > 0) {
    const match = (lastIncidents[0].incident_number || '').match(/^INC-[A-Z0-9]+-(\d+)$/i)
    if (match) nextSeq = parseInt(match[1], 10) + 1
  }
  return `INC-${branchAcronym}-${String(nextSeq).padStart(6, '0')}`
}

// Get all incidents (Security Officer and Admin only)
router.get('/', authenticate, authorize('security_officer', 'admin'), async (req, res) => {
  try {
    const { status, severity, category, branch_acronym } = req.query
    let filters = []

    if (req.user.role === 'security_officer') {
      filters.push({ column: 'assigned_to', value: req.user.id })
    }
    if (status) filters.push({ column: 'status', value: status })
    if (severity) filters.push({ column: 'severity', value: severity })
    if (category) filters.push({ column: 'category', value: category })
    if (branch_acronym) filters.push({ column: 'branch_acronym', value: branch_acronym })

    const selectWithAffectedUser = `
      *,
      created_by_user:users!incidents_created_by_fkey(id, name),
      assigned_to_user:users!incidents_assigned_to_fkey(id, name),
      source_ticket:tickets!incidents_source_ticket_id_fkey(ticket_number, affected_system, created_by),
      affected_user_link:users!incidents_affected_user_id_fkey(id, name)
    `
    const selectWithoutAffectedUser = `
      *,
      created_by_user:users!incidents_created_by_fkey(id, name),
      assigned_to_user:users!incidents_assigned_to_fkey(id, name),
      source_ticket:tickets!incidents_source_ticket_id_fkey(ticket_number, affected_system, created_by)
    `
    let incidents
    try {
      incidents = await query('incidents', 'select', {
        select: selectWithAffectedUser,
        filters: filters.length > 0 ? filters : undefined,
        orderBy: { column: 'created_at', ascending: false }
      })
    } catch (selectErr) {
      incidents = await query('incidents', 'select', {
        select: selectWithoutAffectedUser,
        filters: filters.length > 0 ? filters : undefined,
        orderBy: { column: 'created_at', ascending: false }
      })
    }

    // Resolve ticket creator name for incidents where ticket still exists (for list display)
    const incidentsWithAffected = await Promise.all(incidents.map(async (incident) => {
      let affectedUser = incident.affected_user_link?.name ?? incident.affected_user ?? null
      if (!affectedUser && incident.source_ticket?.created_by) {
        const { data: creator } = await supabase.from('users').select('name').eq('id', incident.source_ticket.created_by).single()
        affectedUser = creator?.name ?? null
      }
      const affectedAsset = incident.affected_asset ?? incident.source_ticket?.affected_system ?? null

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
        incident_number: incident.incident_number,
        created_at: incident.created_at,
        incidentNumber: incident.incident_number,
        createdAt: incident.created_at,
        timelineCount: timelineCount.count || 0,
        attachmentCount: attachmentCount.count || 0,
        createdByName: incident.created_by_user?.name,
        assignedToName: incident.assigned_to_user?.name,
        sourceTicketNumber: incident.source_ticket?.ticket_number,
        sourceTicketId: incident.source_ticket_id ?? null,
        affectedAsset: affectedAsset ?? null,
        affectedUser: affectedUser ?? null
      }
    }))

    res.json(incidentsWithAffected)
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
        source_ticket:tickets!incidents_source_ticket_id_fkey(ticket_number, created_by, assigned_to, affected_system)
      `)
      .eq('id', req.params.id)
      .single()

    if (incidentError || !incident) {
      console.error('Error fetching incident:', incidentError)
      return res.status(404).json({ message: 'Incident not found' })
    }

    // RBAC: Security Officer only sees incidents assigned to them; Admin sees all
    if (req.user.role === 'security_officer') {
      if (incident.assigned_to !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (req.user.role === 'it_support') {
      if (!incident.source_ticket_id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (req.user.role === 'user') {
      return res.status(403).json({ message: 'Forbidden' })
    } else if (req.user.role !== 'admin') {
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

    // Affected asset: from incident row (set at convert from ticket.affected_system in DB only)
    const affectedAsset = incident.affected_asset != null && incident.affected_asset !== ''
      ? incident.affected_asset
      : (incident.source_ticket?.affected_system ?? null)
    // Affected user: get from database by affected_user_id (ticket creator id); fallback to legacy affected_user
    let affectedUser = null
    let affectedUserId = incident.affected_user_id ?? null
    if (affectedUserId) {
      const { data: affectedUserRow } = await supabase.from('users').select('id, name, email').eq('id', affectedUserId).single()
      if (affectedUserRow) {
        affectedUser = affectedUserRow.name ?? null
        affectedUserId = affectedUserRow.id
      }
    }
    if (!affectedUser && incident.affected_user != null && String(incident.affected_user).trim() !== '') {
      affectedUser = incident.affected_user
    }
    if (!affectedUser && incident.source_ticket?.created_by) {
      const { data: ticketCreator } = await supabase.from('users').select('id, name').eq('id', incident.source_ticket.created_by).single()
      if (ticketCreator) {
        affectedUser = ticketCreator.name ?? null
        affectedUserId = ticketCreator.id
      }
    }
    // Impact (CIA): ensure we always send a string, default 'none'
    const impactConfidentiality = incident.impact_confidentiality ?? 'none'
    const impactIntegrity = incident.impact_integrity ?? 'none'
    const impactAvailability = incident.impact_availability ?? 'none'

    res.json({
      ...incident,
      incident_number: incident.incident_number,
      created_at: incident.created_at,
      incidentNumber: incident.incident_number,
      createdAt: incident.created_at,
      createdByName: incident.created_by_user?.name,
      createdByEmail: incident.created_by_user?.email,
      assignedToName: incident.assigned_to_user?.name,
      assignedToEmail: incident.assigned_to_user?.email,
      sourceTicketNumber: incident.source_ticket?.ticket_number,
      sourceTicketId: incident.source_ticket_id ?? null,
      // Explicit camelCase so frontend always receives these
      affectedAsset: affectedAsset ?? null,
      affectedUser: affectedUser ?? null,
      affectedUserId: affectedUserId ?? null,
      rootCause: incident.root_cause ?? null,
      resolutionSummary: incident.resolution_summary ?? null,
      impactConfidentiality,
      impactIntegrity,
      impactAvailability,
      timeline: timeline.map(t => ({
        ...t,
        userName: t.user?.name || 'Unknown User',
        userEmail: t.user?.email,
        createdAt: t.created_at,
        isInternal: t.is_internal
      })),
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
      sourceTicketId,
      branchAcronym
    } = req.body

    if (!category || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const validAcronyms = await getValidAcronyms()
    const branch = branchAcronym && validAcronyms.has(branchAcronym) ? branchAcronym : 'SPI'
    const incidentNumber = await generateIncidentNumber(branch)

    const result = await query('incidents', 'insert', {
      data: {
        incident_number: incidentNumber,
        branch_acronym: branch,
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

    // Notify Security Officers and Admin (notifications only — audit has one entry: CREATE_INCIDENT above)
    const { data: secAndAdminUsers, error: roleError } = await supabase
      .from('users')
      .select('id')
      .in('role', ['security_officer', 'admin'])
      .eq('status', 'active')
    if (!roleError && secAndAdminUsers && secAndAdminUsers.length > 0) {
      const creatorId = req.user.id
      for (const u of secAndAdminUsers) {
        if (u.id === creatorId) continue
        await query('notifications', 'insert', {
          data: {
            user_id: u.id,
            type: 'NEW_INCIDENT_CREATED',
            title: 'New incident created',
            message: `New incident ${incidentNumber}: ${title}`,
            resource_type: 'incident',
            resource_id: result.id
          }
        })
      }
    }

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
      affectedUserId,
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

    if (incident.status === 'closed') {
      return res.status(400).json({ message: 'Closed incidents cannot be edited.' })
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
    if (affectedUserId !== undefined) updateData.affected_user_id = affectedUserId || null
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

    // Notify ticket creator when their converted incident is updated (so it appears in notifications/recent activity)
    if (incident.source_ticket_id) {
      const { data: sourceTicket } = await supabase
        .from('tickets')
        .select('created_by')
        .eq('id', incident.source_ticket_id)
        .single()
      if (sourceTicket?.created_by && sourceTicket.created_by !== req.user.id) {
        await query('notifications', 'insert', {
          data: {
            user_id: sourceTicket.created_by,
            type: 'INCIDENT_UPDATED',
            title: 'Incident updated',
            message: `Incident linked to your ticket was updated`,
            resource_type: 'incident',
            resource_id: req.params.id
          }
        })
        await query('audit_logs', 'insert', {
          data: {
            action: 'INCIDENT_UPDATED',
            user_id: sourceTicket.created_by,
            resource_type: 'incident',
            resource_id: req.params.id,
            details: { incident_id: req.params.id }
          }
        })
      }
    }

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

    // When Security Officer (or admin) adds a timeline update visible to the user, notify the ticket creator
    const isStaff = ['security_officer', 'admin'].includes(req.user.role)
    if (isStaff && !isInternal && incident.source_ticket_id) {
      const { data: sourceTicket } = await supabase
        .from('tickets')
        .select('created_by')
        .eq('id', incident.source_ticket_id)
        .single()
      if (sourceTicket?.created_by && sourceTicket.created_by !== req.user.id) {
        await query('notifications', 'insert', {
          data: {
            user_id: sourceTicket.created_by,
            type: 'INCIDENT_TIMELINE_UPDATE',
            title: 'Update on your incident',
            message: `Security Officer added an update to incident ${incident.incident_number || ''}`,
            resource_type: 'incident',
            resource_id: req.params.id
          }
        })
      }
    }

    res.status(201).json({ message: 'Timeline entry added', entryId: result.id })
  } catch (error) {
    console.error('Add timeline entry error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
