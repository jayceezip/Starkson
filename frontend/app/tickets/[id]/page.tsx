'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser, hasRole } from '@/lib/auth'

interface TimelineEntry {
  id: string
  action: string
  description?: string
  createdAt?: string
  created_at?: string
  userName?: string
  user?: { name?: string; email?: string }
  isInternal?: boolean
  is_internal?: boolean
}

interface Ticket {
  id: number
  ticket_number?: string
  ticketNumber?: string
  request_type?: string
  requestType?: string
  title: string
  description: string
  status: string
  priority: string
  category: string
  affected_system?: string
  affectedSystem?: string
  createdBy: number
  createdByName: string
  assignedTo: number | null
  assignedToName: string | null
  sla_due?: string
  slaDue?: string
  created_at?: string
  createdAt?: string
  updatedAt?: string
  comments: Comment[]
  attachments: Attachment[]
  timeline?: TimelineEntry[]
  incidentTimeline?: TimelineEntry[]
  isConverted?: boolean
  convertedIncidentId?: string | null
  convertedIncidentNumber?: string | null
}

interface Comment {
  id: number
  comment: string
  isInternal: boolean
  createdAt: string
  userId: number
}

interface Attachment {
  id: number
  originalName?: string
  original_name?: string
  mimeType?: string
  mime_type?: string
  size: number
  filePath?: string
  file_path?: string
  createdAt?: string
  created_at?: string
}

const STATUS_OPTIONS = ['new', 'assigned', 'in_progress', 'waiting_for_user', 'resolved', 'closed']

export default function TicketDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertData, setConvertData] = useState({ category: '', severity: 'medium', description: '' })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [fileUploadStatus, setFileUploadStatus] = useState<Record<number, { status: 'pending' | 'uploading' | 'success' | 'error', message?: string }>>({})
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({ title: '', description: '', affectedSystem: '', priority: 'medium' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (!user) {
      router.push('/login')
      return
    }
    fetchTicket()
  }, [params.id, user, router, mounted])

  // Initialize edit data when ticket loads
  useEffect(() => {
    if (ticket) {
      setEditData({
        title: ticket.title || '',
        description: ticket.description || '',
        affectedSystem: ticket.affectedSystem || ticket.affected_system || '',
        priority: ticket.priority || 'medium'
      })
    }
  }, [ticket])

  const fetchTicket = async () => {
    try {
      const response = await api.get(`/tickets/${params.id}`)
      console.log('Ticket data received:', {
        id: response.data.id,
        isConverted: response.data.isConverted,
        convertedIncidentId: response.data.convertedIncidentId,
        convertedIncidentNumber: response.data.convertedIncidentNumber
      })
      setTicket(response.data)
    } catch (error) {
      console.error('Failed to fetch ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      const validFiles = files.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name} is too large. Maximum size is 10MB.`)
          return false
        }
        return true
      })
      setSelectedFiles(prev => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim() && selectedFiles.length === 0) return

    try {
      // Add comment if there's text
      if (comment.trim()) {
        await api.post(`/tickets/${params.id}/comments`, { comment, isInternal })
        setComment('')
        setIsInternal(false)
      }

      // Upload files if any
      if (selectedFiles.length > 0) {
        setUploadingFiles(true)
        const uploadPromises = selectedFiles.map(async (file, index) => {
          setFileUploadStatus(prev => ({ ...prev, [index]: { status: 'uploading' } }))
          
          try {
            const uploadFormData = new FormData()
            uploadFormData.append('file', file)
            
            const token = localStorage.getItem('token')
            // Get base URL - if it already includes /api, don't add it again
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
            const apiUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`
            const response = await fetch(`${apiUrl}/attachments/ticket/${params.id}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: uploadFormData
            })
            
            if (response.ok) {
              setFileUploadStatus(prev => ({ ...prev, [index]: { status: 'success', message: 'Uploaded successfully' } }))
            } else {
              const errorData = await response.json().catch(() => ({}))
              setFileUploadStatus(prev => ({ ...prev, [index]: { status: 'error', message: errorData.message || 'Upload failed' } }))
              throw new Error(errorData.message || 'Upload failed')
            }
          } catch (err: any) {
            setFileUploadStatus(prev => ({ ...prev, [index]: { status: 'error', message: err.message || 'Upload failed' } }))
            throw err
          }
        })
        
        try {
          await Promise.all(uploadPromises)
        } catch (err) {
          console.error('Some file uploads failed:', err)
        }
        
        // Clear files and status after a short delay to show success messages
        setTimeout(() => {
          setSelectedFiles([])
          setFileUploadStatus({})
        }, 2000)
        setUploadingFiles(false)
      }

      fetchTicket()
    } catch (error) {
      console.error('Failed to add comment/upload files:', error)
      setUploadingFiles(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.put(`/tickets/${params.id}`, { status: newStatus })
      fetchTicket()
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handleConvertToIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    // Prevent conversion if already converted
    if (!ticket) {
      alert('Ticket not found')
      return
    }
    if (ticket.isConverted) {
      alert('This ticket has already been converted to an incident.')
      // If already converted, redirect to the incident
      if (ticket.convertedIncidentId) {
        router.push(`/incidents/${ticket.convertedIncidentId}`)
      }
      return
    }
    
    try {
      const response = await api.post(`/tickets/${params.id}/convert`, convertData)
      // Refresh ticket data to show conversion status
      await fetchTicket()
      // Redirect to the incident
      if (response.data.incidentId) {
        router.push(`/incidents/${response.data.incidentId}`)
      } else {
        router.push('/incidents')
      }
    } catch (error: any) {
      console.error('Failed to convert ticket:', error)
      const errorMessage = error.response?.data?.message || 'Failed to convert ticket. It may have already been converted.'
      alert(errorMessage)
      // Refresh ticket data in case it was converted
      await fetchTicket()
      // If the error indicates it was already converted, try to redirect to the incident
      if (error.response?.status === 400 && error.response?.data?.incidentId) {
        router.push(`/incidents/${error.response.data.incidentId}`)
      }
    }
  }

  const handleEditTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canModify) {
      alert('This ticket cannot be edited (resolved, closed, or converted)')
      return
    }

    try {
      await api.put(`/tickets/${params.id}`, editData)
      setShowEditModal(false)
      fetchTicket()
    } catch (error: any) {
      console.error('Failed to update ticket:', error)
      alert(error.response?.data?.message || 'Failed to update ticket')
    }
  }

  const handleDeleteTicket = async () => {
    if (!canDelete) {
      alert('This ticket cannot be deleted (resolved, closed, or converted)')
      return
    }

    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      await api.delete(`/tickets/${params.id}`)
      alert('Ticket deleted successfully')
      router.push('/tickets')
    } catch (error: any) {
      console.error('Failed to delete ticket:', error)
      alert(error.response?.data?.message || 'Failed to delete ticket')
      setDeleting(false)
    }
  }

  if (!mounted || !user || loading || !ticket) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const canEdit = hasRole(user, 'it_support', 'admin') || (user?.id === ticket.createdBy && ticket.status === 'new')
  const canDelete = !ticket.isConverted && !ticket.convertedIncidentId && 
                    !['resolved', 'closed'].includes(ticket.status) &&
                    (hasRole(user, 'it_support', 'admin') || (user?.id === ticket.createdBy))
  const canModify = canEdit && !ticket.isConverted && !ticket.convertedIncidentId && 
                    !['resolved', 'closed'].includes(ticket.status)

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">{ticket.title || 'Untitled Ticket'}</h1>
              <p className="text-gray-600 font-mono">{ticket.ticket_number || ticket.ticketNumber || `#${ticket.id}`}</p>
            </div>
            <div className="flex items-center gap-2">
              {canModify && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
              {hasRole(user, 'it_support', 'admin') && (
                <>
                  {(!ticket.isConverted && !ticket.convertedIncidentId) ? (
                    <button
                      onClick={() => setShowConvertModal(true)}
                      className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                    >
                      Convert to Incident
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-md border border-gray-300">
                      <span className="text-gray-600">Already converted to:</span>
                      {ticket.convertedIncidentId ? (
                        <Link 
                          href={`/incidents/${ticket.convertedIncidentId}`}
                          className="text-red-600 hover:underline font-mono font-semibold"
                        >
                          {ticket.convertedIncidentNumber || 'View Incident'}
                        </Link>
                      ) : (
                        <span className="text-red-600 font-mono font-semibold">
                          {ticket.convertedIncidentNumber || 'Incident'}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{ticket.description || 'No description provided'}</p>
              </div>

              {/* Timeline Section - Show if ticket is converted or has timeline entries */}
              {(ticket.isConverted || (ticket.incidentTimeline && ticket.incidentTimeline.length > 0)) ? (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-xl font-bold mb-4">
                    {ticket.isConverted ? 'Incident Timeline' : 'Timeline'}
                    {ticket.convertedIncidentNumber && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        (Incident: {ticket.convertedIncidentNumber})
                      </span>
                    )}
                  </h2>
                  <div className="space-y-4">
                    {/* Incident Timeline (for users when ticket is converted) */}
                    {ticket.incidentTimeline && ticket.incidentTimeline.length > 0 ? (
                      ticket.incidentTimeline.map((t: any) => {
                      const timelineDate = t.created_at || t.createdAt
                      let formattedDate = 'Invalid Date'
                      
                      if (timelineDate) {
                        try {
                          const date = new Date(timelineDate)
                          if (!isNaN(date.getTime())) {
                            formattedDate = date.toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })
                          }
                        } catch (e) {
                          console.error('Date formatting error:', e)
                        }
                      }
                      
                      const userName = t.userName || t.user?.name || 'System'
                      const action = t.action || 'UPDATE'
                      
                      return (
                        <div key={t.id} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-semibold text-gray-800">{userName}</span>
                              <span className="text-xs text-gray-500">{formattedDate}</span>
                            </div>
                            <p className="text-sm text-gray-600 font-medium">{action.replace(/_/g, ' ')}</p>
                            {t.description && (
                              <p className="text-sm text-gray-700 mt-1">{t.description}</p>
                            )}
                          </div>
                        </div>
                      )
                    })) : (
                      <p className="text-gray-500 text-sm italic">
                        {ticket.isConverted 
                          ? 'No timeline entries yet. Security Officer investigation updates will appear here.' 
                          : 'No timeline entries yet.'}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Comments</h2>
                {/* Scrollable comments thread */}
                <div className="max-h-96 overflow-y-auto space-y-4 mb-4 pr-2 border-b border-gray-200 pb-4">
                  {ticket.comments && ticket.comments.length > 0 ? (
                    ticket.comments.map((c: any) => {
                      // Handle both created_at (from DB) and createdAt (camelCase)
                      const commentDate = c.created_at || c.createdAt
                      let formattedDate = 'Invalid Date'
                      
                      if (commentDate) {
                        try {
                          const date = new Date(commentDate)
                          if (!isNaN(date.getTime())) {
                            formattedDate = date.toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })
                          }
                        } catch (e) {
                          console.error('Date formatting error:', e)
                        }
                      }
                      
                      const isInternal = c.is_internal || c.isInternal
                      const userName = c.userName || c.user?.name || 'Unknown User'
                      
                      return (
                        <div key={c.id} className={`p-4 rounded-lg ${isInternal ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-gray-50 border-l-4 border-blue-400'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-sm font-semibold text-gray-800">{userName}</span>
                              {isInternal && (
                                <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">🔒 Internal</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap ml-4">{formattedDate}</span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap text-sm">{c.comment}</p>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-gray-500 text-sm italic">No comments yet. Start the conversation below.</p>
                  )}
                </div>
                <form onSubmit={handleAddComment} className="space-y-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={3}
                    placeholder="Add a comment..."
                  />
                  
                  {/* File upload */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Attach Files</label>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      accept="image/*,.pdf,.doc,.docx,.txt,.log,.csv"
                    />
                    <p className="text-xs text-gray-500 mt-1">Accepted: Images, PDF, DOC, DOCX, TXT, LOG, CSV (Max 10MB per file)</p>
                    
                    {selectedFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {selectedFiles.map((file, index) => {
                          const fileStatus = fileUploadStatus[index]
                          const isImage = file.type.startsWith('image/')
                          
                          return (
                            <div key={index} className={`flex items-center justify-between p-2 rounded text-sm border ${
                              fileStatus?.status === 'success' ? 'bg-green-50 border-green-200' :
                              fileStatus?.status === 'error' ? 'bg-red-50 border-red-200' :
                              fileStatus?.status === 'uploading' ? 'bg-blue-50 border-blue-200' :
                              'bg-gray-50 border-gray-200'
                            }`}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {isImage && (
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="w-8 h-8 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="text-gray-700 truncate block">{file.name}</span>
                                  {fileStatus && (
                                    <span className={`text-xs ${
                                      fileStatus.status === 'success' ? 'text-green-600' :
                                      fileStatus.status === 'error' ? 'text-red-600' :
                                      'text-blue-600'
                                    }`}>
                                      {fileStatus.status === 'uploading' && '⏳ Uploading...'}
                                      {fileStatus.status === 'success' && '✅ Uploaded successfully'}
                                      {fileStatus.status === 'error' && `❌ ${fileStatus.message || 'Upload failed'}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</span>
                                {!uploadingFiles && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      removeFile(index)
                                      setFileUploadStatus(prev => {
                                        const newStatus = { ...prev }
                                        delete newStatus[index]
                                        return newStatus
                                      })
                                    }}
                                    className="text-red-600 hover:text-red-800 text-xs"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {hasRole(user, 'it_support', 'admin') && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">Internal note (not visible to user)</span>
                    </label>
                  )}
                  <button 
                    type="submit" 
                    disabled={uploadingFiles}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploadingFiles ? 'Uploading...' : 'Add Comment'}
                  </button>
                </form>
              </div>

              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-xl font-bold mb-4">Attachments ({ticket.attachments.length})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ticket.attachments.map((att) => {
                      const isImage = att.mimeType?.startsWith('image/') || att.mime_type?.startsWith('image/')
                      const originalName = att.originalName || att.original_name || 'Unknown'
                      const size = att.size || 0
                      // Get base URL - if it already includes /api, don't add it again
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
                      const apiBaseUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`
                      const token = localStorage.getItem('token')
                      // Use Cloudinary URL directly if available, otherwise use API endpoint
                      const cloudinaryPath = att.filePath || att.file_path
                      const isCloudinaryUrl = cloudinaryPath && cloudinaryPath.startsWith('http')
                      const viewUrl = isCloudinaryUrl 
                        ? (cloudinaryPath || '')
                        : `${apiBaseUrl}/attachments/view/${att.id}?token=${token}`
                      const downloadUrl = `${apiBaseUrl}/attachments/download/${att.id}`
                      
                      const handleDownload = async (e: React.MouseEvent) => {
                        e.preventDefault()
                        
                        // Always use the backend download endpoint for security and proper authentication
                        // This ensures RBAC checks and handles both Cloudinary and local files
                        try {
                          const response = await fetch(downloadUrl, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          })
                          if (response.ok) {
                            const blob = await response.blob()
                            const blobUrl = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = blobUrl
                            a.download = originalName
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            window.URL.revokeObjectURL(blobUrl)
                          } else {
                            const errorData = await response.json().catch(() => ({}))
                            alert(errorData.message || 'Failed to download file')
                          }
                        } catch (error) {
                          console.error('Download error:', error)
                          alert('Failed to download file')
                        }
                      }

                      return (
                        <div key={att.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                          {isImage ? (
                            <div className="space-y-2">
                              <div 
                                className="w-full h-32 bg-gray-100 rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
                                onClick={() => window.open(viewUrl, '_blank')}
                              >
                                <img
                                  src={viewUrl}
                                  alt={originalName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    // Fallback if image fails to load
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                    const parent = target.parentElement
                                    if (parent) {
                                      parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-4xl">🖼️</div>'
                                    }
                                  }}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity rounded flex items-center justify-center pointer-events-none">
                                  <span className="text-white text-xs opacity-0 group-hover:opacity-100">Click to view full size</span>
                                </div>
                              </div>
                              <button
                                onClick={handleDownload}
                                className="block text-sm text-blue-600 hover:underline truncate w-full text-left"
                              >
                                {originalName}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-4xl">
                                📎
                              </div>
                              <button
                                onClick={handleDownload}
                                className="block text-sm text-blue-600 hover:underline truncate w-full text-left"
                              >
                                {originalName}
                              </button>
                            </div>
                          )}
                          <p className="text-xs text-gray-500">{(size / 1024).toFixed(2)} KB</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Details</h2>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Status</span>
                    {canEdit && hasRole(user, 'it_support', 'admin') ? (
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border rounded-md"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-1">{ticket.status ? ticket.status.replace('_', ' ') : 'new'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Priority</span>
                    <p className="mt-1">{ticket.priority || 'medium'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Request Type</span>
                    <p className="mt-1">
                      {(ticket.request_type || ticket.requestType)
                        ? (ticket.request_type || ticket.requestType || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Affected System</span>
                    <p className="mt-1">{ticket?.affected_system || ticket?.affectedSystem || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Created By</span>
                    <p className="mt-1">{ticket.createdByName || 'N/A'}</p>
                  </div>
                  {ticket.assignedToName && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Assigned To</span>
                      <p className="mt-1">{ticket.assignedToName}</p>
                    </div>
                  )}
                  {(ticket.sla_due || ticket.slaDue) ? (
                    <div>
                      <span className="text-sm font-medium text-gray-600">SLA Due</span>
                      <p className={`mt-1 ${(ticket.sla_due || ticket.slaDue) && new Date(ticket.sla_due || ticket.slaDue || '') < new Date() ? 'text-red-600 font-bold' : ''}`}>
                        {(ticket.sla_due || ticket.slaDue) && new Date(ticket.sla_due || ticket.slaDue || '').toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-sm font-medium text-gray-600">Created</span>
                    <p className="mt-1">
                      {(ticket.created_at || ticket.createdAt) 
                        ? new Date(ticket.created_at || ticket.createdAt || '').toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Edit Ticket</h2>
              <form onSubmit={handleEditTicket} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={6}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Affected System</label>
                  <input
                    type="text"
                    value={editData.affectedSystem}
                    onChange={(e) => setEditData({ ...editData, affectedSystem: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priority *</label>
                  <select
                    value={editData.priority}
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="flex gap-4">
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-4 text-red-600">Delete Ticket</h2>
              <p className="mb-4 text-gray-700">
                Are you sure you want to delete this ticket? This action cannot be undone and will also delete all associated comments and attachments.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleDeleteTicket}
                  disabled={deleting}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Convert Modal */}
        {showConvertModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Convert Ticket to Incident</h2>
              <form onSubmit={handleConvertToIncident} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Incident Category *</label>
                  <select
                    value={convertData.category}
                    onChange={(e) => setConvertData({ ...convertData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select category</option>
                    <option value="phishing">Phishing</option>
                    <option value="malware">Malware</option>
                    <option value="unauthorized_access">Unauthorized Access</option>
                    <option value="data_exposure">Data Exposure</option>
                    <option value="policy_violation">Policy Violation</option>
                    <option value="system_compromise">System Compromise</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Severity *</label>
                  <select
                    value={convertData.severity}
                    onChange={(e) => setConvertData({ ...convertData, severity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={convertData.description}
                    onChange={(e) => setConvertData({ ...convertData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={4}
                  />
                </div>
                <div className="flex gap-4">
                  <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                    Convert
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConvertModal(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
