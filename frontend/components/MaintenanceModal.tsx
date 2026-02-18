'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import {
  getAffectedSystems,
  setAffectedSystems,
  getCategories,
  setCategories,
  getIncidentCategories,
  setIncidentCategories,
} from '@/lib/maintenance'

type Branch = { acronym: string; name: string }

type ManageType = 'branches' | 'category' | 'affected_system' | 'incident_category' | null
type ActionType = 'add' | 'delete' | null

const LABELS: Record<NonNullable<ManageType>, { singular: string; plural: string }> = {
  branches: { singular: 'Branch', plural: 'Branches' },
  category: { singular: 'Category', plural: 'Categories' },
  affected_system: { singular: 'Affected System', plural: 'Affected Systems' },
  incident_category: { singular: 'Incident Category', plural: 'Incident Categories' },
}

export default function MaintenanceModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [manageType, setManageType] = useState<ManageType>(null)
  const [actionType, setActionType] = useState<ActionType>(null)
  const [categories, setCategoriesState] = useState<string[]>([])
  const [affectedSystems, setAffectedSystemsState] = useState<string[]>([])
  const [incidentCategories, setIncidentCategoriesState] = useState<string[]>([])
  const [branches, setBranchesState] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [branchError, setBranchError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const fetchBranches = async () => {
    try {
      setBranchesLoading(true)
      setBranchError('')
      const res = await api.get('/branches')
      setBranchesState(res.data || [])
    } catch (err: any) {
      setBranchError(err.response?.data?.message || 'Failed to load branches')
      setBranchesState([])
    } finally {
      setBranchesLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setManageType(null)
      setActionType(null)
      setCategoriesState(getCategories())
      setAffectedSystemsState(getAffectedSystems())
      setIncidentCategoriesState(getIncidentCategories())
      fetchBranches()
      setSuccessMessage('')
    }
  }, [isOpen])

  const refreshLists = () => {
    setCategoriesState(getCategories())
    setAffectedSystemsState(getAffectedSystems())
    setIncidentCategoriesState(getIncidentCategories())
  }

  const handleAddCategory = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const list = getCategories()
    if (list.includes(trimmed)) return
    setCategories([...list, trimmed])
    refreshLists()
    setSuccessMessage(`Category "${trimmed}" added successfully`)
    // Close modal after successful addition
    setTimeout(() => {
      onClose()
    }, 500)
  }

  
  const handleDeleteCategory = (name: string) => {
    const list = getCategories().filter((c) => c !== name)
    setCategories(list)
    refreshLists()
    setSuccessMessage(`Category "${name}" deleted successfully`)
    // Close modal after successful deletion
    setTimeout(() => {
      onClose()
    }, 500)
  }

  const handleAddAffectedSystem = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const list = getAffectedSystems()
    if (list.includes(trimmed)) return
    setAffectedSystems([...list, trimmed])
    refreshLists()
    setSuccessMessage(`Affected System "${trimmed}" added successfully`)
    // Close modal after successful addition
    setTimeout(() => {
      onClose()
    }, 500)
  }

  const handleDeleteAffectedSystem = (name: string) => {
    const list = getAffectedSystems().filter((s) => s !== name)
    setAffectedSystems(list)
    refreshLists()
    setSuccessMessage(`Affected System "${name}" deleted successfully`)
    // Close modal after successful deletion
    setTimeout(() => {
      onClose()
    }, 500)
  }

  const handleAddIncidentCategory = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const list = getIncidentCategories()
    if (list.includes(trimmed)) return
    setIncidentCategories([...list, trimmed])
    refreshLists()
    setSuccessMessage(`Incident Category "${trimmed}" added successfully`)
    // Close modal after successful addition
    setTimeout(() => {
      onClose()
    }, 500)
  }

  const handleDeleteIncidentCategory = (name: string) => {
    const list = getIncidentCategories().filter((c) => c !== name)
    setIncidentCategories(list)
    refreshLists()
    setSuccessMessage(`Incident Category "${name}" deleted successfully`)
    // Close modal after successful deletion
    setTimeout(() => {
      onClose()
    }, 500)
  }

  const handleAddBranch = async (acronym: string, name: string) => {
    try {
      setBranchError('')
      await api.post('/branches', { acronym: acronym.trim().toUpperCase(), name: name.trim() })
      await fetchBranches()
      setSuccessMessage(`Branch "${acronym}" added successfully`)
      // Close modal after successful addition
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (err: any) {
      setBranchError(err.response?.data?.message || 'Failed to add branch')
    }
  }

  const handleDeleteBranch = async (acronym: string) => {
    try {
      setBranchError('')
      await api.delete(`/branches/${encodeURIComponent(acronym)}`)
      await fetchBranches()
      setSuccessMessage(`Branch "${acronym}" deleted successfully`)
      // Close modal after successful deletion
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (err: any) {
      setBranchError(err.response?.data?.message || 'Failed to delete branch')
    }
  }

  const goBack = () => {
    setSuccessMessage('') // Clear success message when navigating
    if (actionType) {
      setActionType(null)
    } else if (manageType) {
      setManageType(null)
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {actionType
              ? manageType
                ? `${actionType === 'add' ? 'Add' : 'Delete'} a ${LABELS[manageType].singular}`
                : 'Maintenance'
              : manageType
                ? `Manage ${LABELS[manageType].plural}`
                : 'Maintenance'}
          </h2>
          <button
            type="button"
            onClick={goBack}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}

          {!manageType ? (
            /* Step 1: Choose what to manage */
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setManageType('branches')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
              >
                <span className="font-medium text-gray-900">Manage Branches</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setManageType('category')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
              >
                <span className="font-medium text-gray-900">Manage Category</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setManageType('incident_category')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
              >
                <span className="font-medium text-gray-900">Manage Incident Category</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setManageType('affected_system')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
              >
                <span className="font-medium text-gray-900">Manage Affected System</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : !actionType ? (
            /* Step 2: Add or Delete */
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setActionType('add')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
              >
                <span className="font-medium text-gray-900">
                  Add a {LABELS[manageType].singular}
                </span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setActionType('delete')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50/50 transition-colors text-left"
              >
                <span className="font-medium text-gray-900">
                  Delete a {LABELS[manageType].singular.toLowerCase()}
                </span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ) : manageType === 'branches' ? (
            <>
              {branchError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {branchError}
                </div>
              )}
              {actionType === 'add' ? (
                <BranchAddForm 
                  onSubmit={handleAddBranch} 
                  loading={branchesLoading} 
                />
              ) : (
                <BranchDeleteForm
                  branches={branches}
                  onDelete={handleDeleteBranch}
                  loading={branchesLoading}
                />
              )}
            </>
          ) : manageType === 'category' ? (
            actionType === 'add' ? (
              <AddForm
                label={`New ${LABELS.category.singular}`}
                placeholder="e.g., Security"
                onSubmit={handleAddCategory}
              />
            ) : (
              <DeleteForm
                label={`Select ${LABELS.category.singular} to delete`}
                options={categories}
                onDelete={handleDeleteCategory}
              />
            )
          ) : manageType === 'incident_category' ? (
            actionType === 'add' ? (
              <AddForm
                label={`New ${LABELS.incident_category.singular}`}
                placeholder="e.g., Data Breach"
                onSubmit={handleAddIncidentCategory}
              />
            ) : (
              <DeleteForm
                label={`Select ${LABELS.incident_category.singular} to delete`}
                options={incidentCategories}
                onDelete={handleDeleteIncidentCategory}
              />
            )
          ) : manageType === 'affected_system' ? (
            actionType === 'add' ? (
              <AddForm
                label={`New ${LABELS.affected_system.singular}`}
                placeholder="e.g., Outlook"
                onSubmit={handleAddAffectedSystem}
              />
            ) : (
              <DeleteForm
                label={`Select ${LABELS.affected_system.singular} to delete`}
                options={affectedSystems}
                onDelete={handleDeleteAffectedSystem}
              />
            )
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AddForm({
  label,
  placeholder,
  onSubmit,
}: {
  label: string
  placeholder: string
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(value)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <button
        type="submit"
        className="w-full px-4 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Add
      </button>
    </form>
  )
}

function BranchAddForm({
  onSubmit,
  loading,
}: {
  onSubmit: (acronym: string, name: string) => void | Promise<void>
  loading: boolean
}) {
  const [acronym, setAcronym] = useState('')
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const a = acronym.trim().toUpperCase()
    const n = name.trim()
    if (!a || !n) return
    await onSubmit(a, n)
    setAcronym('')
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Acronym</label>
        <input
          type="text"
          value={acronym}
          onChange={(e) => setAcronym(e.target.value)}
          placeholder="e.g., D10"
          maxLength={10}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., D10 – New Branch"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !acronym.trim() || !name.trim()}
        className="w-full px-4 py-2.5 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Adding...' : 'Add Branch'}
      </button>
    </form>
  )
}

function BranchDeleteForm({
  branches,
  onDelete,
  loading,
}: {
  branches: Branch[]
  onDelete: (acronym: string) => void | Promise<void>
  loading: boolean
}) {
  const [selected, setSelected] = useState('')

  const handleDelete = async () => {
    if (!selected) return
    await onDelete(selected)
    setSelected('')
  }

  const realBranches = branches.filter((b) => b.acronym !== 'ALL')

  if (loading && realBranches.length === 0) {
    return <p className="text-sm text-gray-500">Loading branches...</p>
  }
  if (realBranches.length === 0) {
    return <p className="text-sm text-gray-500">No branches to delete.</p>
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">Select branch to delete</label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Select...</option>
        {realBranches.map((b) => (
          <option key={b.acronym} value={b.acronym}>
            {b.acronym} – {b.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleDelete}
        disabled={!selected || loading}
        className="w-full px-4 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Deleting...' : 'Delete Branch'}
      </button>
    </div>
  )
}

function DeleteForm({
  label,
  options,
  onDelete,
}: {
  label: string
  options: string[]
  onDelete: (value: string) => void
}) {
  const [selected, setSelected] = useState('')

  const handleDelete = () => {
    if (selected) {
      onDelete(selected)
      setSelected('')
    }
  }

  if (options.length === 0) {
    return <p className="text-sm text-gray-500">No items to delete.</p>
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleDelete}
        disabled={!selected}
        className="w-full px-4 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Delete
      </button>
    </div>
  )
}