'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api, { getApiBaseUrl } from '@/lib/api'
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

const STATUS_OPTIONS = ['new', 'assigned', 'in_progress', 'waiting for user', 'resolved', 'closed']

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
  const [converting, setConverting] = useState(false)
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

  const fetchTicket = useCallback(async () => {
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
  }, [params.id])

  useEffect(() => {
    if (!mounted) return

    if (!user) {
      router.push('/login')
      return
    }
    fetchTicket()
  }, [params.id, user, router, mounted, fetchTicket])

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
            const response = await fetch(`${getApiBaseUrl()}/attachments/ticket/${params.id}`, {
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
    if (!ticket) {
      alert('Ticket not found')
      return
    }
    if (ticket.isConverted) {
      alert('This ticket has already been converted to an incident.')
      if (ticket.convertedIncidentId) {
        router.push(`/incidents/${ticket.convertedIncidentId}`)
      }
      return
    }

    setConverting(true)
    try {
      const response = await api.post(`/tickets/${params.id}/convert`, convertData)
      const { incidentId, incidentNumber } = response.data || {}
      // Update ticket state immediately so the page shows "Converted to Incident" without waiting for a full refetch
      setTicket((prev) => (prev ? {
        ...prev,
        status: 'converted_to_incident',
        isConverted: true,
        convertedIncidentId: incidentId ?? prev.convertedIncidentId,
        convertedIncidentNumber: incidentNumber ?? prev.convertedIncidentNumber,
      } : prev))
      setShowConvertModal(false)
      // Refetch in background to load incident timeline etc.; do not block the UI
      fetchTicket()
    } catch (error: any) {
      console.error('Failed to convert ticket:', error)
      const errorMessage = error.response?.data?.message || 'Failed to convert ticket. It may have already been converted.'
      alert(errorMessage)
      if (error.response?.status === 400 && error.response?.data?.incidentId) {
        router.push(`/incidents/${error.response.data.incidentId}`)
      } else {
        fetchTicket()
      }
    } finally {
      setConverting(false)
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
      <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">{ticket.title || 'Untitled Ticket'}</h1>
              <p className="text-gray-500 font-mono text-sm mt-0.5">{ticket.ticket_number || ticket.ticketNumber || `#${ticket.id}`}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canModify && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors"
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
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors"
                    >
                      Convert to Incident
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-xl border border-gray-200">
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
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{ticket.description || 'No description provided'}</p>
              </div>

              {/* Timeline Section - Show if ticket is converted or has timeline entries */}
              {(ticket.isConverted || (ticket.incidentTimeline && ticket.incidentTimeline.length > 0)) ? (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Comments</h2>
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
                        <div key={c.id} className={`p-4 rounded-xl border-l-4 ${isInternal ? 'bg-amber-50 border-amber-400' : 'bg-gray-50 border-blue-500'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-sm font-semibold text-gray-800">{userName}</span>
                              {isInternal && (
                                <span className="ml-2 text-xs font-medium bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">🔒 Internal</span>
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
                <form onSubmit={handleAddComment} className="space-y-4">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[88px]"
                    rows={3}
                    placeholder="Add a comment..."
                  />
                  
                  {/* File upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Attach Files</label>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:transition-colors"
                      accept="image/*,.pdf,.doc,.docx,.txt,.log,.csv"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">Images, PDF, DOC, DOCX, TXT, LOG, CSV (max 10MB per file)</p>
                    
                    {selectedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedFiles.map((file, index) => {
                          const fileStatus = fileUploadStatus[index]
                          const isImage = file.type.startsWith('image/')
                          
                          return (
                            <div key={index} className={`flex items-center justify-between p-3 rounded-xl text-sm border ${
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
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">Internal note (not visible to user)</span>
                    </label>
                  )}
                  <button 
                    type="submit" 
                    disabled={uploadingFiles}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    {uploadingFiles ? 'Uploading...' : 'Add Comment'}
                  </button>
                </form>
              </div>

              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Attachments ({ticket.attachments.length})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ticket.attachments.map((att) => {
                      const isImage = att.mimeType?.startsWith('image/') || att.mime_type?.startsWith('image/')
                      const originalName = att.originalName || att.original_name || 'Unknown'
                      const size = att.size || 0
                      const token = localStorage.getItem('token')
                      // Use Cloudinary URL directly if available, otherwise use API endpoint
                      const cloudinaryPath = att.filePath || att.file_path
                      const isCloudinaryUrl = cloudinaryPath && cloudinaryPath.startsWith('http')
                      const viewUrl = isCloudinaryUrl 
                        ? (cloudinaryPath || '')
                        : `${getApiBaseUrl()}/attachments/view/${att.id}?token=${token}`
                      const downloadUrl = `${getApiBaseUrl()}/attachments/download/${att.id}`
                      
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
                        <div key={att.id} className="border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow bg-white">
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
                                className="block text-sm font-medium text-blue-600 hover:text-blue-700 truncate w-full text-left transition-colors"
                              >
                                {originalName}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center text-4xl">
                                📎
                              </div>
                              <button
                                onClick={handleDownload}
                                className="block text-sm font-medium text-blue-600 hover:text-blue-700 truncate w-full text-left transition-colors"
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
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Details</h2>
                <div className="space-y-4">
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Status</span>
                    {canModify && hasRole(user, 'it_support', 'admin') ? (
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mt-1 cursor-pointer transition-shadow"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-1 text-gray-900 font-medium">{ticket.status ? ticket.status.replace(/_/g, ' ') : 'new'}</p>
                    )}
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Priority</span>
                    <p className="mt-1 text-gray-900">{ticket.priority || 'medium'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Request Type</span>
                    <p className="mt-1 text-gray-900">
                      {(ticket.request_type || ticket.requestType)
                        ? (ticket.request_type || ticket.requestType || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Affected System</span>
                    <p className="mt-1 text-gray-900">{ticket?.affected_system || ticket?.affectedSystem || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created By</span>
                    <p className="mt-1 text-gray-900">{ticket.createdByName || 'N/A'}</p>
                  </div>
                  {ticket.assignedToName && (
                    <div>
                      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Assigned To</span>
                      <p className="mt-1 text-gray-900">{ticket.assignedToName}</p>
                    </div>
                  )}
                  {(ticket.sla_due || ticket.slaDue) ? (
                    <div>
                      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">SLA Due</span>
                      <p className={`mt-1 ${(ticket.sla_due || ticket.slaDue) && new Date(ticket.sla_due || ticket.slaDue || '') < new Date() ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
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
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created</span>
                    <p className="mt-1 text-gray-900">
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
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Ticket</h2>
              <form onSubmit={handleEditTicket} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-y"
                    rows={6}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Affected System</label>
                  <input
                    type="text"
                    value={editData.affectedSystem}
                    onChange={(e) => setEditData({ ...editData, affectedSystem: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority *</label>
                  <select
                    value={editData.priority}
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">Save Changes</button>
                  <button type="button" onClick={() => setShowEditModal(false)} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-gray-100">
              <h2 className="text-xl font-bold mb-4 text-red-600">Delete Ticket</h2>
              <p className="mb-5 text-gray-600">
                Are you sure you want to delete this ticket? This action cannot be undone and will also delete all associated comments and attachments.
              </p>
              <div className="flex gap-3">
                <button onClick={handleDeleteTicket} disabled={deleting} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors">
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
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
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[80px] resize-y"
                    rows={4}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={converting} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors">
                    {converting ? 'Converting…' : 'Convert'}
                  </button>
                  <button type="button" disabled={converting} onClick={() => setShowConvertModal(false)} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
