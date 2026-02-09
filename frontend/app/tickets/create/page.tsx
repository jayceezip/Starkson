'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { getApiBaseUrl } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'

const REQUEST_TYPES = [
  { value: 'account_password', label: 'Account & Password Issues' },
  { value: 'software_installation', label: 'Software Installation' },
  { value: 'hardware', label: 'Hardware Problems' },
  { value: 'network_internet', label: 'Network / Internet Issues' },
  { value: 'access_request', label: 'Access Requests' },
  { value: 'general', label: 'General IT Assistance' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function CreateTicketPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    requestType: '',
    title: '',
    description: '',
    affectedSystem: '',
    priority: 'medium',
    category: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<Record<number, { status: 'pending' | 'uploading' | 'success' | 'error', message?: string }>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      // Validate file sizes (10MB limit)
      const validFiles = selectedFiles.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} is too large. Maximum size is 10MB.`)
          return false
        }
        return true
      })
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!formData.requestType || !formData.title || !formData.description) {
      setError('Please fill in all required fields')
      setLoading(false)
      return
    }

    try {
      // Create ticket first
      const response = await api.post('/tickets', formData)
      const ticketId = response.data.ticketId
      console.log('✅ Ticket created:', { 
        ticketId, 
        ticketNumber: response.data.ticketNumber,
        assignedTo: response.data.assignedTo,
        assigned: response.data.assigned
      })

      // Upload files if any
      if (files.length > 0) {
        setUploading(true)
        const uploadPromises = files.map(async (file, index) => {
          // Set status to uploading
          setUploadStatus(prev => ({ ...prev, [index]: { status: 'uploading' } }))
          
          try {
            const uploadFormData = new FormData()
            uploadFormData.append('file', file)
            
            const token = localStorage.getItem('token')
            const uploadUrl = `${getApiBaseUrl()}/attachments/ticket/${ticketId}`
            console.log(`📤 Uploading ${file.name} to: ${uploadUrl}`)
            const response = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: uploadFormData
            })
            
            if (response.ok) {
              const result = await response.json().catch(() => ({}))
              setUploadStatus(prev => ({ ...prev, [index]: { status: 'success', message: 'Uploaded successfully' } }))
              console.log(`✅ File uploaded: ${file.name}`, result)
            } else {
              const errorData = await response.json().catch(() => ({}))
              const errorMessage = errorData.error || errorData.message || `Upload failed (${response.status})`
              console.error(`❌ Upload failed for ${file.name}:`, errorData)
              setUploadStatus(prev => ({ ...prev, [index]: { status: 'error', message: errorMessage } }))
              throw new Error(errorMessage)
            }
          } catch (err: any) {
            const errorMessage = err.message || 'Upload failed'
            console.error(`❌ Upload error for ${file.name}:`, err)
            setUploadStatus(prev => ({ ...prev, [index]: { status: 'error', message: errorMessage } }))
            throw err
          }
        })
        
        try {
          await Promise.all(uploadPromises)
        } catch (err) {
          // Some uploads may have failed, but continue
          console.error('Some file uploads failed:', err)
        }
        setUploading(false)
      }

      router.push(`/tickets/${ticketId}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create ticket')
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['user', 'admin']}>
      <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <h1 className="text-3xl font-bold mb-6">Create IT Support Ticket</h1>
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow max-w-3xl">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Request Type *</label>
              <select
                value={formData.requestType}
                onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select request type</option>
                {REQUEST_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
                placeholder="Brief description of the issue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                rows={6}
                required
                placeholder="Detailed description of the issue, steps to reproduce, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Affected System</label>
              <input
                type="text"
                value={formData.affectedSystem}
                onChange={(e) => setFormData({ ...formData, affectedSystem: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., Windows 10, Outlook, Network"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Priority *</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Optional category"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Attachments</label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full px-3 py-2 border rounded-md"
                accept="image/*,.pdf,.doc,.docx,.txt,.log,.csv"
              />
              <p className="text-xs text-gray-500 mt-1">Accepted: Images, PDF, DOC, DOCX, TXT, LOG, CSV (Max 10MB per file)</p>
              
              {files.length > 0 && (
                <div className="mt-2 space-y-2">
                  {files.map((file, index) => {
                    const fileStatus = uploadStatus[index]
                    const isImage = file.type.startsWith('image/')
                    
                    return (
                      <div key={index} className={`flex items-center justify-between p-2 rounded border ${
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
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 truncate block">{file.name}</span>
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
                          {!uploading && (
                            <button
                              type="button"
                              onClick={() => {
                                removeFile(index)
                                setUploadStatus(prev => {
                                  const newStatus = { ...prev }
                                  delete newStatus[index]
                                  return newStatus
                                })
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
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

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || uploading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading files...' : loading ? 'Creating...' : 'Create Ticket'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  )
}
