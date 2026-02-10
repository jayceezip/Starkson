const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const { supabase } = require('./config/database')

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/tickets', require('./routes/tickets'))
app.use('/api/incidents', require('./routes/incidents'))
app.use('/api/users', require('./routes/users'))
app.use('/api/audit', require('./routes/audit'))
app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/staff', require('./routes/staff'))
app.use('/api/admin', require('./routes/admin'))
// Attachments route - register before other routes that might conflict
app.use('/api/attachments', require('./routes/attachments'))
app.use('/api/sla', require('./routes/sla'))
app.use('/api/notifications', require('./routes/notifications'))

// Log all API requests for debugging
app.use('/api/*', (req, res, next) => {
  console.log(`🌐 API Request: ${req.method} ${req.originalUrl}`)
  next()
})

// Health check
app.get('/api/health', async (req, res) => {
  res.status(200).json({ status: "ok" });
})

// Debug route to test attachments router (must be before 404 handler)
app.get('/api/attachments/test', (req, res) => {
  res.json({ message: 'Attachments route is accessible', timestamp: new Date().toISOString() })
})

// Log all API requests for debugging (before 404 handler)
app.use('/api/*', (req, res, next) => {
  console.log(`🌐 API Request: ${req.method} ${req.originalUrl}`)
  next()
})

// 404 handler for unmatched routes (MUST be last)
app.use('*', (req, res) => {
  console.log('⚠️  Unmatched route (404):', req.method, req.originalUrl)
  res.status(404).json({ 
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log('Supabase client initialized')
})

module.exports = app
