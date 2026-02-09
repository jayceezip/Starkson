const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const cloudinary = require('cloudinary').v2
const { query, supabase } = require('../config/database')
const { authenticate } = require('../middleware/auth')

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
}

// Validate Cloudinary configuration
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  console.error('⚠️  Cloudinary configuration missing! Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file')
} else {
  cloudinary.config(cloudinaryConfig)
  console.log('✅ Cloudinary configured successfully')
}

// Configure multer for in-memory storage (for Cloudinary)
const storage = multer.memoryStorage()

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|log|csv/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' })
    }
    return res.status(400).json({ message: 'File upload error', error: err.message })
  }
  if (err) {
    return res.status(400).json({ message: err.message || 'File upload error' })
  }
  next()
}

// Test route to verify attachments router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Attachments router is working', timestamp: new Date().toISOString() })
})

// Upload attachment - MUST be before GET /:recordType/:recordId to avoid route conflicts
router.post('/:recordType/:recordId', authenticate, (req, res, next) => {
  console.log('🔐 Authentication passed, proceeding to file upload...')
  console.log('📋 Route params:', req.params)
  next()
}, upload.single('file'), (err, req, res, next) => {
  // Multer error handler - must be 4 parameters
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer error:', err)
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' })
    }
    return res.status(400).json({ message: 'File upload error', error: err.message })
  }
  if (err) {
    console.error('❌ Upload error:', err)
    return res.status(400).json({ message: err.message || 'File upload error' })
  }
  next()
}, async (req, res) => {
  try {
    console.log('📥 Upload request received:', {
      recordType: req.params.recordType,
      recordId: req.params.recordId,
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      user: req.user?.id
    })
    
    const { recordType, recordId } = req.params
    const file = req.file

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    if (!['ticket', 'incident'].includes(recordType)) {
      return res.status(400).json({ message: 'Invalid record type' })
    }

    // Verify record exists and user has access
    if (recordType === 'ticket') {
      console.log(`🔍 Checking ticket existence: ${recordId} (type: ${typeof recordId})`)
      const ticket = await query('tickets', 'select', {
        filters: [{ column: 'id', value: recordId }],
        single: true
      })
      console.log(`🔍 Ticket lookup result:`, ticket ? `Found (ID: ${ticket.id})` : 'Not found')
      if (!ticket) {
        console.error(`❌ Ticket not found: ${recordId}`)
        return res.status(404).json({ 
          message: 'Ticket not found',
          ticketId: recordId,
          error: 'The ticket may not exist or you may not have access to it'
        })
      }
      // RBAC: Users can only attach to their own tickets
      if (req.user.role === 'user' && ticket.created_by !== req.user.id) {
        console.error(`❌ Access denied: User ${req.user.id} trying to attach to ticket ${recordId} created by ${ticket.created_by}`)
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (recordType === 'incident') {
      // Only Security Officer and Admin can attach to incidents
      if (!['security_officer', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
      const incident = await query('incidents', 'select', {
        filters: [{ column: 'id', value: recordId }],
        single: true
      })
      if (!incident) {
        return res.status(404).json({ message: 'Incident not found' })
      }
    }

    // Check Cloudinary configuration
    if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
      console.error('Cloudinary not configured')
      return res.status(500).json({ 
        message: 'File upload service not configured. Please contact administrator.',
        error: 'Cloudinary credentials missing'
      })
    }

    // Upload to Cloudinary
    let cloudinaryResult
    try {
      console.log(`Uploading file to Cloudinary: ${file.originalname} (${file.size} bytes)`)
      // Convert buffer to data URI for Cloudinary
      const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
      
      // Upload to Cloudinary - make files publicly accessible
      cloudinaryResult = await cloudinary.uploader.upload(dataUri, {
        folder: `starkson/${recordType}s/${recordId}`,
        resource_type: 'auto', // Auto-detect image, video, or raw
        public_id: `${Date.now()}-${Math.round(Math.random() * 1E9)}`,
        overwrite: false,
        access_mode: 'public' // Make files publicly accessible
      })
      console.log(`✅ File uploaded to Cloudinary: ${cloudinaryResult.secure_url}`)
    } catch (cloudinaryError) {
      console.error('❌ Cloudinary upload error:', {
        message: cloudinaryError.message,
        http_code: cloudinaryError.http_code,
        error: cloudinaryError
      })
      return res.status(500).json({ 
        message: 'Failed to upload file to cloud storage', 
        error: cloudinaryError.message || 'Unknown Cloudinary error',
        details: cloudinaryError.http_code ? `HTTP ${cloudinaryError.http_code}` : undefined
      })
    }

    // Store Cloudinary URL and public_id instead of local file path
    // Note: file_path might be longer than 500 chars, but PostgreSQL TEXT can handle it
    // If your schema uses VARCHAR(500), you may need to alter it to TEXT
    let result
    try {
      result = await query('attachments', 'insert', {
        data: {
          record_type: recordType,
          record_id: recordId,
          filename: cloudinaryResult.public_id,
          original_name: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
          file_path: cloudinaryResult.secure_url, // Store Cloudinary URL
          uploaded_by: req.user.id
        }
      })
      console.log(`✅ Attachment saved to database: ${result.id}`)
    } catch (dbError) {
      console.error('❌ Database insert error:', dbError)
      // Try to delete from Cloudinary if database insert fails
      try {
        await cloudinary.uploader.destroy(cloudinaryResult.public_id)
        console.log('🗑️  Cleaned up Cloudinary file after DB error')
      } catch (cleanupError) {
        console.error('Failed to cleanup Cloudinary file:', cleanupError)
      }
      return res.status(500).json({ 
        message: 'Failed to save attachment to database', 
        error: dbError.message || 'Database error'
      })
    }

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'UPLOAD_ATTACHMENT',
        user_id: req.user.id,
        resource_type: recordType,
        resource_id: recordId,
        details: { filename: file.originalname, size: file.size }
      }
    })

    res.status(201).json({ message: 'File uploaded', attachmentId: result.id })
  } catch (error) {
    console.error('❌ Upload attachment error:', error)
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// Get attachments for a record
router.get('/:recordType/:recordId', authenticate, async (req, res) => {
  try {
    const { recordType, recordId } = req.params

    // Verify access
    if (recordType === 'ticket') {
      const ticket = await query('tickets', 'select', {
        filters: [{ column: 'id', value: recordId }],
        single: true
      })
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' })
      }
      if (req.user.role === 'user' && ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (recordType === 'incident') {
      if (!['security_officer', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    const { data: attachments, error } = await supabase
      .from('attachments')
      .select(`
        *,
        uploaded_by_user:users!attachments_uploaded_by_fkey(id, name)
      `)
      .eq('record_type', recordType)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Get attachments error:', error)
      return res.status(500).json({ message: 'Server error' })
    }

    // Format response
    const formattedAttachments = attachments.map(att => ({
      id: att.id,
      recordType: att.record_type,
      recordId: att.record_id,
      filename: att.filename,
      originalName: att.original_name,
      mimeType: att.mime_type,
      size: att.size,
      filePath: att.file_path,
      uploadedBy: att.uploaded_by,
      uploadedByName: att.uploaded_by_user?.name || 'Unknown',
      createdAt: att.created_at,
      // Also include snake_case for compatibility
      record_type: att.record_type,
      record_id: att.record_id,
      original_name: att.original_name,
      mime_type: att.mime_type,
      file_path: att.file_path,
      uploaded_by: att.uploaded_by,
      created_at: att.created_at
    }))

    res.json(formattedAttachments)
  } catch (error) {
    console.error('Get attachments error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// View/Serve attachment (for images in img tags)
// Note: This endpoint allows token in query string for img src tags
// For Cloudinary URLs, we redirect to the Cloudinary URL
router.get('/view/:id', async (req, res) => {
  try {
    // Get token from query string or header
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const attachment = await query('attachments', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' })
    }

    // Get ticket or incident to check access
    if (attachment.record_type === 'ticket') {
      const ticket = await query('tickets', 'select', {
        filters: [{ column: 'id', value: attachment.record_id }],
        single: true
      })
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' })
      }
      // RBAC check
      if (decoded.role === 'user' && ticket.created_by !== decoded.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (attachment.record_type === 'incident') {
      if (!['security_officer', 'admin'].includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    // If file_path is a Cloudinary URL (starts with http), redirect to it
    if (attachment.file_path && attachment.file_path.startsWith('http')) {
      return res.redirect(attachment.file_path)
    }

    // Fallback to local file system (for backward compatibility)
    const filePath = path.join(__dirname, '../', attachment.file_path)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' })
    }

    // Set appropriate content type and cache headers
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.sendFile(path.resolve(filePath))
  } catch (error) {
    console.error('View attachment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Download attachment
router.get('/download/:id', authenticate, async (req, res) => {
  try {
    const attachment = await query('attachments', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' })
    }

    // Get ticket or incident to check access
    if (attachment.record_type === 'ticket') {
      const ticket = await query('tickets', 'select', {
        filters: [{ column: 'id', value: attachment.record_id }],
        single: true
      })
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' })
      }
      // RBAC check
      if (req.user.role === 'user' && ticket.created_by !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    } else if (attachment.record_type === 'incident') {
      if (!['security_officer', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
    }

    // If file_path is a Cloudinary URL, fetch and proxy it through our server
    if (attachment.file_path && attachment.file_path.startsWith('http')) {
      try {
        console.log(`📥 Fetching file from Cloudinary: ${attachment.file_path}`)
        // Fetch the file from Cloudinary
        const cloudinaryResponse = await fetch(attachment.file_path)
        if (!cloudinaryResponse.ok) {
          console.error(`❌ Failed to fetch from Cloudinary: ${cloudinaryResponse.status} ${cloudinaryResponse.statusText}`)
          return res.status(cloudinaryResponse.status).json({ 
            message: 'Failed to fetch file from cloud storage',
            error: `Cloudinary returned ${cloudinaryResponse.status}`
          })
        }
        
        // Get the file buffer
        const fileBuffer = await cloudinaryResponse.arrayBuffer()
        const buffer = Buffer.from(fileBuffer)
        
        console.log(`✅ File fetched from Cloudinary: ${buffer.length} bytes`)
        
        // Set appropriate headers
        res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_name}"`)
        res.setHeader('Content-Length', buffer.length)
        
        // Send the file
        res.send(buffer)
        return
      } catch (fetchError) {
        console.error('❌ Error fetching from Cloudinary:', fetchError)
        return res.status(500).json({ 
          message: 'Failed to download file from cloud storage',
          error: fetchError.message
        })
      }
    }

    // Fallback to local file system (for backward compatibility)
    const filePath = path.join(__dirname, '../', attachment.file_path)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' })
    }

    res.download(filePath, attachment.original_name)
  } catch (error) {
    console.error('❌ Download attachment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Delete attachment
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const attachment = await query('attachments', 'select', {
      filters: [{ column: 'id', value: req.params.id }],
      single: true
    })

    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' })
    }

    // Only admin or uploader can delete
    if (req.user.role !== 'admin' && attachment.uploaded_by !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // Delete file from Cloudinary or local storage
    if (attachment.file_path && attachment.file_path.startsWith('http')) {
      // Delete from Cloudinary
      try {
        const publicId = attachment.filename // Cloudinary public_id is stored in filename
        await cloudinary.uploader.destroy(publicId)
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError)
        // Continue with database deletion even if Cloudinary delete fails
      }
    } else {
      // Delete from local file system (for backward compatibility)
      const filePath = path.join(__dirname, '../', attachment.file_path)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await query('attachments', 'delete', {
      filters: [{ column: 'id', value: req.params.id }]
    })

    // Log audit
    await query('audit_logs', 'insert', {
      data: {
        action: 'DELETE_ATTACHMENT',
        user_id: req.user.id,
        resource_type: attachment.record_type,
        resource_id: attachment.record_id
      }
    })

    res.json({ message: 'Attachment deleted' })
  } catch (error) {
    console.error('Delete attachment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Note: Removed catch-all route - let Express handle 404s naturally
// The logging middleware at the top will show all requests to this router

module.exports = router
