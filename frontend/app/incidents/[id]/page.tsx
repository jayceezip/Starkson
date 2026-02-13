'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Listbox, Transition } from '@headlessui/react'
import api, { getApiBaseUrl } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'

interface Incident {
  id: number
  incidentNumber: string
  category: string
  title: string
  description: string
  severity: string
  status: string
  impactConfidentiality: string
  impactIntegrity: string
  impactAvailability: string
  affectedAsset: string
  affectedUser: string
  affectedUserId?: string
  rootCause: string
  resolutionSummary: string
  assignedToName: string
  createdByName: string
  sourceTicketNumber: string
  sourceTicketId?: string | null
  createdAt: string
  timeline: TimelineEntry[]
  attachments: Attachment[]
}

interface TimelineEntry {
  id: number
  action: string
  description: string
  userName: string
  createdAt: string
}

interface Attachment {
  id: number
  originalName: string
  size: number
  createdAt: string
}

const STATUS_OPTIONS = ['new', 'triaged', 'investigating', 'contained', 'recovered', 'closed']

// Modern Status Select Component for Incidents
const ModernIncidentStatusSelect = ({ 
  value, 
  onChange, 
  disabled 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  disabled?: boolean;
}) => {
  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; dot: string; ring: string }> = {
      'new': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', ring: 'ring-blue-500' },
      'triaged': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', ring: 'ring-purple-500' },
      'investigating': { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', ring: 'ring-yellow-500' },
      'contained': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', ring: 'ring-orange-500' },
      'recovered': { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', ring: 'ring-green-500' },
      'closed': { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500', ring: 'ring-gray-500' },
    };
    return colors[status] || { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500', ring: 'ring-gray-500' };
  };

  const currentStatus = getStatusColor(value);

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className="relative mt-1">
        <Listbox.Button className={`
          relative w-full flex items-center justify-between gap-2 px-4 py-2.5
          ${currentStatus.bg} ${currentStatus.text}
          rounded-xl border border-transparent
          hover:border-gray-200 hover:shadow-md
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          transition-all duration-200 ease-in-out
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          font-medium text-left
        `}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${currentStatus.dot}`} />
            <span className="capitalize">{value.replace(/_/g, ' ')}</span>
          </div>
          <svg
            className="w-4 h-4 transition-transform duration-200 ui-open:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Listbox.Button>
        
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-60 overflow-auto focus:outline-none">
            {STATUS_OPTIONS.map((status) => {
              const colors = getStatusColor(status);
              return (
                <Listbox.Option
                  key={status}
                  value={status}
                  className={({ active }) => `
                    relative cursor-pointer select-none py-2.5 px-4
                    ${active ? 'bg-gray-50' : ''}
                    transition-colors duration-150
                  `}
                >
                  {({ selected }) => (
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <span className={`flex-1 text-sm font-medium capitalize ${
                        selected ? colors.text : 'text-gray-700'
                      }`}>
                        {status.replace(/_/g, ' ')}
                      </span>
                      {selected && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}
                </Listbox.Option>
              );
            })}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
};

// Pill/badge colors for Severity (and Impact (CIA) — same value)
function getSeverityBadgeClass(severity: string): string {
  const map: Record<string, string> = {
    none: 'bg-gray-100 text-gray-800',
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  }
  return map[severity?.toLowerCase()] ?? 'bg-gray-100 text-gray-800'
}

// Read from API response (camelCase or snake_case)
function getIncidentField(incident: any, camel: string, snake?: string): string {
  if (!incident) return ''
  const s = snake ?? camel.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
  const v = incident[camel] ?? incident[s]
  return v != null ? String(v) : ''
}

export default function IncidentDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false)
  const [timelineEntry, setTimelineEntry] = useState({ action: '', description: '' })
  const [investigationModalOpen, setInvestigationModalOpen] = useState(false)
  const [investigationForm, setInvestigationForm] = useState({ rootCause: '', resolutionSummary: '' })

  useEffect(() => {
    setMounted(true)
    const currentUser = getStoredUser()
    setUser(currentUser)
  }, [])

  const fetchIncident = useCallback(async () => {
    try {
      const response = await api.get(`/incidents/${params.id}`)
      setIncident(response.data)
    } catch (error) {
      console.error('Failed to fetch incident:', error)
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
    fetchIncident()
  }, [params.id, user, router, mounted, fetchIncident])

  const handleStatusChange = async (newStatus: string) => {
    if (!incident || updatingStatus) return;
    
    // Show confirmation modal for 'recovered' and 'closed' statuses
    if (newStatus === 'recovered' || newStatus === 'closed') {
      setPendingStatus(newStatus);
      setShowStatusConfirmModal(true);
    } else {
      await executeStatusChange(newStatus);
    }
  }

  const executeStatusChange = async (newStatus: string) => {
    if (!incident || updatingStatus) return;
    
    setUpdatingStatus(true);
    try {
      await api.put(`/incidents/${params.id}`, { status: newStatus })
      // Optimistically update the UI
      setIncident(prev => prev ? { ...prev, status: newStatus } : null)
      // Fetch in background to sync with server
      fetchIncident()
    } catch (error) {
      console.error('Failed to update status:', error)
      // Revert optimistic update on error
      fetchIncident()
    } finally {
      setUpdatingStatus(false);
      setPendingStatus(null);
      setShowStatusConfirmModal(false);
    }
  }

  const handleStatusConfirm = () => {
    if (pendingStatus) {
      executeStatusChange(pendingStatus);
    }
  }

  const handleStatusCancel = () => {
    setPendingStatus(null);
    setShowStatusConfirmModal(false);
  }

  const handleAddTimelineEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!timelineEntry.action.trim() || !timelineEntry.description.trim()) return

    try {
      await api.post(`/incidents/${params.id}/timeline`, timelineEntry)
      setTimelineEntry({ action: '', description: '' })
      fetchIncident()
    } catch (error) {
      console.error('Failed to add timeline entry:', error)
    }
  }

  const openInvestigationModal = () => {
    const rc = (incident as any)?.rootCause ?? (incident as any)?.root_cause ?? ''
    const res = (incident as any)?.resolutionSummary ?? (incident as any)?.resolution_summary ?? ''
    setInvestigationForm({ rootCause: rc, resolutionSummary: res })
    setInvestigationModalOpen(true)
  }

  const handleSaveInvestigation = async (e: React.FormEvent) => {
    e.preventDefault()
    const rootCause = investigationForm.rootCause.trim()
    const resolutionSummary = investigationForm.resolutionSummary.trim()
    try {
      await api.put(`/incidents/${params.id}`, {
        rootCause: rootCause || null,
        resolutionSummary: resolutionSummary || null
      })
      setInvestigationModalOpen(false)
      fetchIncident()
    } catch (error) {
      console.error('Failed to save investigation:', error)
    }
  }

  const handleClearInvestigation = async () => {
    try {
      await api.put(`/incidents/${params.id}`, {
        rootCause: null,
        resolutionSummary: null
      })
      setInvestigationModalOpen(false)
      setInvestigationForm({ rootCause: '', resolutionSummary: '' })
      fetchIncident()
    } catch (error) {
      console.error('Failed to clear investigation:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-blue-500',
      'triaged': 'bg-purple-500',
      'investigating': 'bg-yellow-500',
      'contained': 'bg-orange-500',
      'recovered': 'bg-green-500',
      'closed': 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  if (!mounted || !user || loading || !incident) {
    return (
      <ProtectedRoute allowedRoles={['security_officer', 'admin', 'it_support']}>
        <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // IT Support has read-only access; no one can edit when incident is closed
  const isReadOnly = user?.role === 'it_support' || incident?.status === 'closed'

  return (
    <ProtectedRoute allowedRoles={['security_officer', 'admin', 'it_support']}>
      <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">{incident.title || 'Untitled Incident'}</h1>
            <p className="text-gray-500 font-mono text-sm mt-0.5">{incident.incidentNumber || `#${incident.id}`}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{incident.description}</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Timeline</h2>
                <div className="space-y-4 mb-4 max-h-96 overflow-y-auto pr-2">
                  {incident.timeline && incident.timeline.length > 0 ? (
                    incident.timeline.map((entry: any) => {
                      const entryDate = entry.created_at || entry.createdAt
                      const formattedDate = entryDate 
                        ? new Date(entryDate).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })
                        : 'Invalid Date'
                      
                      return (
                        <div key={entry.id} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
                          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-semibold text-gray-800">{entry.action}</span>
                              <span className="text-xs text-gray-500">{formattedDate}</span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1">{entry.description}</p>
                            <p className="text-xs text-gray-500">by {entry.userName || 'Unknown User'}</p>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-gray-500 text-sm italic">No timeline entries yet</p>
                  )}
                </div>
                {!isReadOnly && (
                  <form onSubmit={handleAddTimelineEntry} className="space-y-4 pt-2 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Action *</label>
                      <input
                        type="text"
                        value={timelineEntry.action}
                        onChange={(e) => setTimelineEntry({ ...timelineEntry, action: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Investigation started"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
                      <textarea
                        value={timelineEntry.description}
                        onChange={(e) => setTimelineEntry({ ...timelineEntry, description: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[88px]"
                        rows={3}
                        placeholder="Detailed description of the action taken..."
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">
                        Add Timeline Entry
                      </button>
                      {incident.status !== 'closed' && (
                        <button
                          type="button"
                          onClick={openInvestigationModal}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-gray-600 hover:bg-gray-700 shadow-sm transition-colors"
                        >
                          {incident.rootCause || incident.resolutionSummary ? 'Edit' : 'Add'} Root Cause & Resolution
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {investigationModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setInvestigationModalOpen(false)}>
                  <div className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Investigation – Root Cause & Resolution</h2>
                    <form onSubmit={handleSaveInvestigation} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Root Cause</label>
                        <textarea
                          value={investigationForm.rootCause}
                          onChange={(e) => setInvestigationForm({ ...investigationForm, rootCause: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[100px]"
                          rows={4}
                          placeholder="Document root cause analysis..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Resolution Summary</label>
                        <textarea
                          value={investigationForm.resolutionSummary}
                          onChange={(e) => setInvestigationForm({ ...investigationForm, resolutionSummary: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[100px]"
                          rows={4}
                          placeholder="Document resolution summary..."
                        />
                      </div>
                      <div className="flex flex-wrap gap-3 justify-between pt-2">
                        <button
                          type="button"
                          onClick={handleClearInvestigation}
                          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
                        >
                          Clear contents
                        </button>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setInvestigationModalOpen(false)} className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                            Cancel
                          </button>
                          <button type="submit" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">
                            Save
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {incident.attachments && incident.attachments.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Evidence Attachments</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {incident.attachments.map((att: any) => {
                      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
                      const downloadUrl = `${getApiBaseUrl()}/attachments/download/${att.id}`
                      return (
                        <button
                          key={att.id}
                          onClick={(e) => {
                            e.preventDefault()
                            fetch(downloadUrl, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            })
                              .then(response => response.blob())
                              .then(blob => {
                                const blobUrl = window.URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = blobUrl
                                a.download = att.original_name || att.originalName || 'attachment'
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                window.URL.revokeObjectURL(blobUrl)
                              })
                              .catch(error => {
                                console.error('Download error:', error)
                                alert('Failed to download file')
                              })
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all text-left group"
                        >
                          <span className="text-2xl">📎</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                              {att.original_name || att.originalName || 'Attachment'}
                            </p>
                            <p className="text-xs text-gray-500">{(att.size / 1024).toFixed(2)} KB</p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
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
                    {isReadOnly ? (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(incident.status)}`} />
                        <p className="text-gray-900 font-medium capitalize">
                          {incident.status.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ) : (
                      <ModernIncidentStatusSelect
                        value={incident.status}
                        onChange={handleStatusChange}
                        disabled={updatingStatus}
                      />
                    )}
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Severity</span>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getSeverityBadgeClass(getIncidentField(incident, 'severity'))}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'critical' ? 'bg-red-500' :
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'high' ? 'bg-orange-500' :
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'medium' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`} />
                        {getIncidentField(incident, 'severity') || '—'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Category</span>
                    <p className="mt-1 text-gray-900 capitalize">{incident.category?.replace(/_/g, ' ') ?? '—'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Impact (CIA)</span>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getSeverityBadgeClass(getIncidentField(incident, 'severity'))}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'critical' ? 'bg-red-500' :
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'high' ? 'bg-orange-500' :
                          getIncidentField(incident, 'severity')?.toLowerCase() === 'medium' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`} />
                        {getIncidentField(incident, 'severity') || '—'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Affected Asset</span>
                    <span className="ml-1 text-xs text-gray-400">(from ticket)</span>
                    <p className="mt-1 text-gray-900">{getIncidentField(incident, 'affectedAsset') || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Affected User</span>
                    <span className="ml-1 text-xs text-gray-400">(ticket creator)</span>
                    <p className="mt-1 text-gray-900">
                      {getIncidentField(incident, 'affectedUser') || 'N/A'}
                      {getIncidentField(incident, 'affectedUserId') && (
                        <span className="ml-1 text-xs text-gray-400">(ID: {getIncidentField(incident, 'affectedUserId')})</span>
                      )}
                    </p>
                  </div>
                  {incident.sourceTicketNumber && (
                    <div>
                      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Source Ticket</span>
                      <p className="mt-1">
                        <Link 
                          href={incident.sourceTicketId ? `/tickets/${incident.sourceTicketId}` : '#'} 
                          className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                        >
                          {incident.sourceTicketNumber}
                        </Link>
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Assigned To</span>
                    <p className="mt-1 text-gray-900">{incident.assignedToName || 'Unassigned'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created By</span>
                    <p className="mt-1 text-gray-900">{incident.createdByName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created</span>
                    <p className="mt-1 text-gray-900">
                      {incident.createdAt 
                        ? new Date(incident.createdAt).toLocaleString('en-US', {
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

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Investigation</h2>
                <div className="space-y-4">
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Root Cause</span>
                    <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-xl">
                      {(incident as any).rootCause ?? (incident as any).root_cause ?? 'Not documented'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Resolution Summary</span>
                    <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-xl">
                      {(incident as any).resolutionSummary ?? (incident as any).resolution_summary ?? 'Not documented'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Change Confirmation Modal for Recovered Incident */}
        {showStatusConfirmModal && pendingStatus === 'recovered' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Recover Incident</h2>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-600">
                  Are you sure you want to mark this incident as recovered? This indicates that the system has been restored to normal operation.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleStatusConfirm}
                    disabled={updatingStatus}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    {updatingStatus ? 'Updating...' : 'Yes, Mark as Recovered'}
                  </button>
                  <button
                    onClick={handleStatusCancel}
                    disabled={updatingStatus}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Change Confirmation Modal for Closing Incident */}
        {showStatusConfirmModal && pendingStatus === 'closed' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Close Incident</h2>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-600">
                  Are you sure you want to close this incident? This action is irreversible and the incident will be marked as complete.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleStatusConfirm}
                    disabled={updatingStatus}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-white bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    {updatingStatus ? 'Closing...' : 'Yes, Close Incident'}
                  </button>
                  <button
                    onClick={handleStatusCancel}
                    disabled={updatingStatus}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}