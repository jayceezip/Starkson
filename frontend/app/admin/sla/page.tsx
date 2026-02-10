'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'

interface SlaRule {
  id: string
  priority: string
  response_time_minutes?: number
  resolution_time_hours?: number
  responseTimeMinutes?: number
  resolutionTimeHours?: number
  is_active?: boolean
  isActive?: boolean
}

const PRIORITIES = ['urgent', 'high', 'medium', 'low']

export default function AdminSlaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [rules, setRules] = useState<SlaRule[]>([])
  const [compliance, setCompliance] = useState<Record<string, { total: number; breached: number }>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editingRule, setEditingRule] = useState<SlaRule | null>(null)
  const [form, setForm] = useState({ priority: 'medium', responseTimeMinutes: 240, resolutionTimeHours: 48 })

  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  const fetchRules = async () => {
    try {
      const res = await api.get('/sla')
      setRules(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      console.error('Failed to fetch SLA:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompliance = async () => {
    try {
      const res = await api.get('/sla/compliance')
      setCompliance(res.data || {})
    } catch (_) {}
  }

  useEffect(() => {
    if (!mounted || !user) return
    if (!user) {
      router.push('/login')
      return
    }
    fetchRules()
    fetchCompliance()
  }, [mounted, user, router])

  const openAdd = () => {
    setForm({ priority: 'medium', responseTimeMinutes: 240, resolutionTimeHours: 48 })
    setEditingRule(null)
    setModal('add')
  }

  const openEdit = (rule: SlaRule) => {
    setEditingRule(rule)
    setForm({
      priority: rule.priority,
      responseTimeMinutes: rule.responseTimeMinutes ?? rule.response_time_minutes ?? 0,
      resolutionTimeHours: rule.resolutionTimeHours ?? rule.resolution_time_hours ?? 0
    })
    setModal('edit')
  }

  const handleSave = async () => {
    try {
      if (modal === 'add') {
        await api.post('/sla', {
          priority: form.priority,
          responseTimeMinutes: form.responseTimeMinutes,
          resolutionTimeHours: form.resolutionTimeHours
        })
      } else if (editingRule) {
        await api.put(`/sla/${editingRule.id}`, {
          responseTimeMinutes: form.responseTimeMinutes,
          resolutionTimeHours: form.resolutionTimeHours
        })
      }
      setModal(null)
      setEditingRule(null)
      fetchRules()
      fetchCompliance()
    } catch (e: any) {
      console.error('Save SLA error:', e)
      alert(e.response?.data?.message || 'Failed to save')
    }
  }

  const handleDelete = async (rule: SlaRule) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete SLA rule for priority "${rule.priority}"?`)) return
    try {
      await api.delete(`/sla/${rule.id}`)
      fetchRules()
      fetchCompliance()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to delete')
    }
  }

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <div className="panel-page flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="panel-page">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin" className="text-gray-500 hover:text-gray-900">← Admin Panel</Link>
          <h1 className="text-2xl font-bold text-gray-900">SLA & Priority Management</h1>
        </div>
        <p className="text-gray-500 mb-6">Configurable SLA rules, priority-based response times, and breach indicators.</p>

        {/* SLA breach indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {PRIORITIES.map((p) => {
            const c = compliance[p] || { total: 0, breached: 0 }
            return (
              <div key={p} className="panel-card">
                <h3 className="panel-card-title capitalize">{p}</h3>
                <p className="panel-card-value">{c.breached > 0 ? <span className="text-red-600">{c.breached} breached</span> : '0 breached'}</p>
                <p className="text-xs text-gray-500 mt-1">{c.total} tickets</p>
              </div>
            )
          })}
        </div>

        <div className="panel-card p-0 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="panel-section-title mb-0">SLA Rules</h2>
            <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Add rule
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[500px] w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response time (min)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resolution time (hrs)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium capitalize">{r.priority}</td>
                      <td className="px-4 py-3">{r.responseTimeMinutes ?? r.response_time_minutes ?? '—'}</td>
                      <td className="px-4 py-3">{r.resolutionTimeHours ?? r.resolution_time_hours ?? '—'}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => openEdit(r)} className="text-sm text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => handleDelete(r)} className="text-sm text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModal(null)}>
            <div className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">{modal === 'add' ? 'Add SLA rule' : 'Edit SLA rule'}</h3>
              {modal === 'add' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Response time (minutes)</label>
                <input
                  type="number"
                  min={0}
                  value={form.responseTimeMinutes}
                  onChange={(e) => setForm({ ...form, responseTimeMinutes: parseInt(e.target.value, 10) || 0 })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution time (hours)</label>
                <input
                  type="number"
                  min={0}
                  value={form.resolutionTimeHours}
                  onChange={(e) => setForm({ ...form, resolutionTimeHours: parseInt(e.target.value, 10) || 0 })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
