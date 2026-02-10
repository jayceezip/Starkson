'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  status: string
  createdAt?: string
}

const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'it_support', label: 'IT Support' },
  { value: 'security_officer', label: 'Security Officer' },
  { value: 'admin', label: 'Admin' },
]

export default function AdminUsersPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<string>('')

  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users')
      setUsers(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      console.error('Failed to fetch users:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mounted || !user) return
    if (!user) {
      router.push('/login')
      return
    }
    fetchUsers()
  }, [mounted, user, router])

  const handleUpdateRole = async (userId: string) => {
    if (!newRole) return
    try {
      await api.put(`/users/${userId}/role`, { role: newRole })
      setEditingRole(null)
      fetchUsers()
    } catch (e) {
      console.error('Failed to update role:', e)
      alert('Failed to update role')
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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        </div>
        <p className="text-gray-500 mb-6">View all users and assign or update roles.</p>

        {loading ? (
          <div className="panel-card text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="panel-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-[600px] w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        {editingRole === u.id ? (
                          <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="border rounded px-2 py-1"
                          >
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="capitalize">{u.role?.replace('_', ' ')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize">{u.status || 'active'}</td>
                      <td className="px-4 py-3">
                        {editingRole === u.id ? (
                          <span className="flex gap-2">
                            <button
                              onClick={() => handleUpdateRole(u.id)}
                              className="text-sm bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRole(null)}
                              className="text-sm border px-2 py-1 rounded hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingRole(u.id)
                              setNewRole(u.role || 'user')
                            }}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Update role
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
