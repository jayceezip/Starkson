'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'
import { useBranches } from '@/lib/useBranches'

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  status: string
  createdAt?: string
  branchAcronyms?: string[]
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
  const [searchQuery, setSearchQuery] = useState('')
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<string>('')
  const [editingBranches, setEditingBranches] = useState<string | null>(null)
  const [editingBranchUserName, setEditingBranchUserName] = useState<string>('')
  const [editingBranchAcronyms, setEditingBranchAcronyms] = useState<string[]>([])
  const [savingBranches, setSavingBranches] = useState(false)

  const { branches, realBranches, ALL_BRANCHES_ACRONYM } = useBranches()

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

  // Keyword search: match name, email, role (case-insensitive)
  const keywords = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredUsers = keywords.length === 0
    ? users
    : users.filter((u) => {
        const searchText = [u.name, u.email, u.role, u.status, (u.branchAcronyms || []).join(' ')].filter(Boolean).join(' ').toLowerCase()
        return keywords.every((kw) => searchText.includes(kw))
      })

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

  const handleOpenBranchEdit = (u: UserRow) => {
    if (u.role === 'admin') return
    setEditingBranches(u.id)
    setEditingBranchUserName(u.name)
    setEditingBranchAcronyms(Array.isArray(u.branchAcronyms) ? [...u.branchAcronyms] : [])
  }

  const handleBranchCheckboxChange = (acronym: string, checked: boolean) => {
    if (acronym === ALL_BRANCHES_ACRONYM) {
      setEditingBranchAcronyms(checked ? [ALL_BRANCHES_ACRONYM] : [])
    } else {
      setEditingBranchAcronyms((prev) => {
        const next = prev.filter((a) => a !== ALL_BRANCHES_ACRONYM)
        if (checked) return [...next, acronym]
        return next.filter((a) => a !== acronym)
      })
    }
  }

  const handleUpdateBranches = async (userId: string) => {
    if (editingBranchAcronyms.length === 0) {
      alert('Please assign at least one branch or All Branches.')
      return
    }
    setSavingBranches(true)
    try {
      await api.put(`/users/${userId}/branches`, {
        branchAcronyms: editingBranchAcronyms.includes(ALL_BRANCHES_ACRONYM)
          ? [ALL_BRANCHES_ACRONYM]
          : editingBranchAcronyms,
      })
      setEditingBranches(null)
      fetchUsers()
    } catch (e) {
      console.error('Failed to update branches:', e)
      alert('Failed to update branches')
    } finally {
      setSavingBranches(false)
    }
  }

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-blue-600 rounded-full" />
        </div>
      </ProtectedRoute>
    )
  }

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800 border-purple-200',
      it_support: 'bg-blue-100 text-blue-800 border-blue-200',
      security_officer: 'bg-red-100 text-red-800 border-red-200',
      user: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    return colors[role] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getStatusBadgeColor = (status: string) => {
    return status === 'active' || !status
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen bg-[#f5f5f7] pt-20 lg:pt-8 px-4 lg:px-8 pb-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Admin Panel
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">User Management</h1>
          </div>
          <Link
            href="/admin/users/create"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 text-base font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create an account
          </Link>
        </div>
        <p className="text-gray-600 mb-8 text-base">Manage user accounts, assign roles, and monitor account status across the platform.</p>

        {/* Stats & Search */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <label htmlFor="user-search" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search users
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                id="user-search"
                type="search"
                placeholder="Search by name, email, role, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm focus:shadow-md"
              />
            </div>
            {searchQuery.trim() && (
              <p className="mt-3 text-sm text-gray-600 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} match your search
              </p>
            )}
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Total Users</p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mb-4" />
              <p className="text-gray-500 font-medium">Loading users...</p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium mb-1">No users found</p>
              <p className="text-sm text-gray-500">Users will appear here once they register.</p>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium mb-1">No users match your search</p>
              <p className="text-sm text-gray-500">Try different keywords or clear your search.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Branches</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingRole === u.id ? (
                          <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="w-full max-w-[200px] px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-sm"
                          >
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${getRoleBadgeColor(u.role || 'user')}`}>
                            {u.role?.replace('_', ' ') || 'user'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.role === 'admin' ? (
                          <span className="text-sm text-gray-500">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              {u.branchAcronyms && u.branchAcronyms.length > 0
                                ? u.branchAcronyms.includes('ALL')
                                  ? 'All Branches'
                                  : u.branchAcronyms.join(', ')
                                : '—'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenBranchEdit(u)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                              title="Edit branches"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusBadgeColor(u.status ?? 'active')}`}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {editingRole === u.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateRole(u.id)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all hover:shadow"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRole(null)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingRole(u.id)
                              setNewRole(u.role || 'user')
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Role
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {searchQuery.trim() && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600">
                  Showing <span className="font-bold text-gray-900">{filteredUsers.length}</span> of <span className="font-bold text-gray-900">{users.length}</span> users
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Assign branches modal */}
        {editingBranches && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setEditingBranches(null)}
              aria-hidden="true"
            />
            <div
              className="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">
                  Assign branches
                  {editingBranchUserName && (
                    <span className="ml-2 text-gray-500 font-normal">— {editingBranchUserName}</span>
                  )}
                </h2>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <label className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={editingBranchAcronyms.includes(ALL_BRANCHES_ACRONYM)}
                    onChange={(e) => handleBranchCheckboxChange(ALL_BRANCHES_ACRONYM, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">All Branches</span>
                </label>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {realBranches.map((b) => (
                    <label
                      key={b.acronym}
                      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer ${editingBranchAcronyms.includes(ALL_BRANCHES_ACRONYM) ? 'opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={editingBranchAcronyms.includes(b.acronym)}
                        disabled={editingBranchAcronyms.includes(ALL_BRANCHES_ACRONYM)}
                        onChange={(e) => handleBranchCheckboxChange(b.acronym, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm font-medium text-gray-900">{b.acronym}</span>
                      <span className="text-sm text-gray-500 truncate flex-1">{b.name}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => editingBranches && handleUpdateBranches(editingBranches)}
                    disabled={savingBranches}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingBranches ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBranches(null)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
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
