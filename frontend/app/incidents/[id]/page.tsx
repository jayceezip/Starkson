'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

function getSeverityBadgeClass(severity: string): string {
  const map: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  }
  return map[severity?.toLowerCase()] ?? 'bg-gray-100 text-gray-800'
}

function getImpactBadgeClass(impact: string): string {
  const map: Record<string, string> = {
    none: 'bg-gray-100 text-gray-700 border border-gray-300',
    low: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    medium: 'bg-amber-100 text-amber-800 border border-amber-300',
    high: 'bg-red-100 text-red-800 border border-red-300',
  }
  return map[impact?.toLowerCase()] ?? 'bg-gray-100 text-gray-700 border border-gray-300'
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
  const [timelineEntry, setTimelineEntry] = useState({ action: '', description: '' })
  const [investigationModalOpen, setInvestigationModalOpen] = useState(false)
  const [investigationForm, setInvestigationForm] = useState({ rootCause: '', resolutionSummary: '' })
  const [editingAffected, setEditingAffected] = useState<'asset' | 'user' | null>(null)
  const [affectedDraft, setAffectedDraft] = useState({ asset: '', user: '' })

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
    try {
      await api.put(`/incidents/${params.id}`, { status: newStatus })
      fetchIncident()
    } catch (error) {
      console.error('Failed to update status:', error)
    }
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

  const handleSaveAffected = async (field: 'asset' | 'user') => {
    const value = field === 'asset' ? affectedDraft.asset : affectedDraft.user
    try {
      await api.put(`/incidents/${params.id}`, field === 'asset' ? { affectedAsset: value || null } : { affectedUser: value || null })
      setEditingAffected(null)
      fetchIncident()
    } catch (error) {
      console.error('Failed to save affected:', error)
    }
  }

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

  // IT Support has read-only access (can view but not edit)
  const isReadOnly = user?.role === 'it_support'

  return (
    <ProtectedRoute allowedRoles={['security_officer', 'admin', 'it_support']}>
      <div className="min-h-screen bg-gray-50 pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{incident.title || 'Untitled Incident'}</h1>
            <p className="text-gray-600 font-mono">{incident.incidentNumber || incident.incidentNumber || `#${incident.id}`}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{incident.description}</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Timeline</h2>
                <div className="space-y-4 mb-4">
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
                        <div key={entry.id} className="border-l-4 border-blue-400 pl-4">
                          <div className="flex justify-between mb-2">
                            <span className="font-medium">{entry.action}</span>
                            <span className="text-xs text-gray-500">{formattedDate}</span>
                          </div>
                          <p className="text-gray-700">{entry.description}</p>
                          <p className="text-xs text-gray-500 mt-1">by {entry.userName || 'Unknown User'}</p>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-gray-500 text-sm">No timeline entries yet</p>
                  )}
                </div>
                {!isReadOnly && (
                  <form onSubmit={handleAddTimelineEntry} className="space-y-2">
                    <input
                      type="text"
                      value={timelineEntry.action}
                      onChange={(e) => setTimelineEntry({ ...timelineEntry, action: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="Action (e.g., Investigation started)"
                      required
                    />
                    <textarea
                      value={timelineEntry.description}
                      onChange={(e) => setTimelineEntry({ ...timelineEntry, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      rows={3}
                      placeholder="Description"
                      required
                    />
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                      Add Timeline Entry
                    </button>
                  </form>
                )}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={openInvestigationModal}
                    className="mt-4 w-full sm:w-auto bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                  >
                    {incident.rootCause || incident.rootCause || incident.resolutionSummary || incident.resolutionSummary ? 'Edit' : 'Add'} Root Cause & Resolution Summary
                  </button>
                )}
              </div>

              {investigationModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setInvestigationModalOpen(false)}>
                  <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-4">Investigation – Root Cause & Resolution</h3>
                      <form onSubmit={handleSaveInvestigation} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Root Cause</label>
                          <textarea
                            value={investigationForm.rootCause}
                            onChange={(e) => setInvestigationForm({ ...investigationForm, rootCause: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            rows={4}
                            placeholder="Document root cause analysis..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Summary</label>
                          <textarea
                            value={investigationForm.resolutionSummary}
                            onChange={(e) => setInvestigationForm({ ...investigationForm, resolutionSummary: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            rows={4}
                            placeholder="Document resolution summary..."
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 justify-between">
                          <button
                            type="button"
                            onClick={handleClearInvestigation}
                            className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50"
                          >
                            Clear contents
                          </button>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setInvestigationModalOpen(false)} className="px-4 py-2 border rounded-md hover:bg-gray-50">
                              Cancel
                            </button>
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                              Save
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {incident.attachments && incident.attachments.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-xl font-bold mb-4">Evidence Attachments</h2>
                  <div className="space-y-2">
                    {incident.attachments.map((att: any) => {
                      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
                      const downloadUrl = `${getApiBaseUrl()}/attachments/download/${att.id}`
                      return (
                        <a
                          key={att.id}
                          href={downloadUrl}
                          className="block p-2 hover:bg-gray-50 rounded"
                          onClick={(e) => {
                            e.preventDefault()
                            // Use fetch to download with auth token
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
                        >
                          📎 {att.original_name || att.originalName || 'Attachment'} ({(att.size / 1024).toFixed(2)} KB)
                        </a>
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
                    {isReadOnly ? (
                      <p className="mt-1">{incident.status}</p>
                    ) : (
                      <select
                        value={incident.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border rounded-md"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Severity</span>
                    <p className="mt-1">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${getSeverityBadgeClass(getIncidentField(incident, 'severity'))}`}>
                        {getIncidentField(incident, 'severity') || '—'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Category</span>
                    <p className="mt-1">{incident.category?.replace('_', ' ') ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Impact (CIA)</span>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${getImpactBadgeClass(getIncidentField(incident, 'impactConfidentiality'))}`}>C: {getIncidentField(incident, 'impactConfidentiality') || 'none'}</span>
                      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${getImpactBadgeClass(getIncidentField(incident, 'impactIntegrity'))}`}>I: {getIncidentField(incident, 'impactIntegrity') || 'none'}</span>
                      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${getImpactBadgeClass(getIncidentField(incident, 'impactAvailability'))}`}>A: {getIncidentField(incident, 'impactAvailability') || 'none'}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Affected Asset</span>
                    <span className="ml-1 text-xs text-gray-500">(from ticket’s Affected System when converted)</span>
                    {editingAffected === 'asset' ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={affectedDraft.asset}
                          onChange={(e) => setAffectedDraft((d) => ({ ...d, asset: e.target.value }))}
                          className="flex-1 min-w-0 px-2 py-1 border rounded text-sm"
                          placeholder="e.g. Workstation, Server"
                        />
                        <button type="button" onClick={() => handleSaveAffected('asset')} className="text-sm bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Save</button>
                        <button type="button" onClick={() => { setEditingAffected(null) }} className="text-sm border px-2 py-1 rounded hover:bg-gray-50">Cancel</button>
                      </div>
                    ) : (
                      <p className="mt-1">
                        {getIncidentField(incident, 'affectedAsset') || 'N/A'}
                        {!isReadOnly && (
                          <button type="button" onClick={() => { setEditingAffected('asset'); setAffectedDraft((d) => ({ ...d, asset: getIncidentField(incident, 'affectedAsset') })) }} className="ml-2 text-sm text-blue-600 hover:underline">
                            {getIncidentField(incident, 'affectedAsset') ? 'Edit' : 'Set'}
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Affected User</span>
                    <span className="ml-1 text-xs text-gray-500">(ticket creator when converted)</span>
                    {editingAffected === 'user' ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={affectedDraft.user}
                          onChange={(e) => setAffectedDraft((d) => ({ ...d, user: e.target.value }))}
                          className="flex-1 min-w-0 px-2 py-1 border rounded text-sm"
                          placeholder="Name of affected user"
                        />
                        <button type="button" onClick={() => handleSaveAffected('user')} className="text-sm bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Save</button>
                        <button type="button" onClick={() => { setEditingAffected(null) }} className="text-sm border px-2 py-1 rounded hover:bg-gray-50">Cancel</button>
                      </div>
                    ) : (
                      <p className="mt-1">
                        {getIncidentField(incident, 'affectedUser') || 'N/A'}
                        {getIncidentField(incident, 'affectedUserId') && (
                          <span className="ml-1 text-xs text-gray-500">(from ticket creator id)</span>
                        )}
                        {!isReadOnly && (
                          <button type="button" onClick={() => { setEditingAffected('user'); setAffectedDraft((d) => ({ ...d, user: getIncidentField(incident, 'affectedUser') })) }} className="ml-2 text-sm text-blue-600 hover:underline">
                            {getIncidentField(incident, 'affectedUser') ? 'Edit' : 'Set'}
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                  {incident.sourceTicketNumber && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Source Ticket</span>
                      <p className="mt-1">
                        <a href={`/tickets/${incident.sourceTicketNumber}`} className="text-blue-600 hover:underline">
                          {incident.sourceTicketNumber}
                        </a>
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-600">Assigned To</span>
                    <p className="mt-1">{incident.assignedToName || 'Unassigned'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Created</span>
                    <p className="mt-1">
                      {incident.createdAt || incident.createdAt 
                        ? new Date(incident.createdAt || incident.createdAt).toLocaleString('en-US', {
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

              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Investigation</h2>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Root Cause</span>
                    <p className="mt-1 text-sm text-gray-700">{(incident as any).rootCause ?? (incident as any).root_cause ?? 'Not documented'}</p>
                    {!isReadOnly && (
                      <button type="button" onClick={openInvestigationModal} className="mt-2 text-sm text-blue-600 hover:underline">
                        {(incident as any).rootCause || (incident as any).root_cause ? 'Update' : 'Add'} Root Cause & Resolution
                      </button>
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Resolution Summary</span>
                    <p className="mt-1 text-sm text-gray-700">{(incident as any).resolutionSummary ?? (incident as any).resolution_summary ?? 'Not documented'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
