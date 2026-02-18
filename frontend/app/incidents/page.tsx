'use client'

import { useEffect, useState, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Listbox, Transition } from '@headlessui/react'
import api from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getStoredUser } from '@/lib/auth'
import { formatPinoyDateTime } from '@/lib/date'
import { REAL_BRANCHES } from '@/lib/branches'

interface Incident {
  id: number
  incidentNumber: string
  category: string
  title: string
  severity: string
  status: string
  createdAt: string
  sourceTicketNumber?: string
  sourceTicketId?: string | null
  affectedAsset?: string | null
  affectedUser?: string | null
}

const PAGE_SIZE = 10

// Modern Status Select Component for Filters
const ModernStatusFilterSelect = ({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) => {
  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; dot: string }> = {
      'new': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
      'triaged': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
      'investigating': { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
      'contained': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      'recovered': { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
      'closed': { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
    };
    return colors[status];
  };

  const options = [
    { value: '', label: 'All statuses' },
    { value: 'new', label: 'New' },
    { value: 'triaged', label: 'Triaged' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'contained', label: 'Contained' },
    { value: 'recovered', label: 'Recovered' },
    { value: 'closed', label: 'Closed' },
  ];

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className={`
          relative w-full flex items-center justify-between gap-2 px-4 py-2.5
          ${value ? getStatusColor(value)?.bg : 'bg-white'}
          ${value ? getStatusColor(value)?.text : 'text-gray-900'}
          rounded-xl border border-gray-200
          hover:border-gray-300 hover:shadow-sm
          focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
          transition-all duration-200 ease-in-out
          cursor-pointer font-medium text-left
        `}>
          <div className="flex items-center gap-2">
            {value && (
              <span className={`w-2 h-2 rounded-full ${getStatusColor(value)?.dot}`} />
            )}
            <span>{selectedOption.label}</span>
          </div>
          <svg
            className="w-4 h-4 text-gray-500 transition-transform duration-200 ui-open:rotate-180"
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
            {options.map((option) => {
              const colors = option.value ? getStatusColor(option.value) : null;
              return (
                <Listbox.Option
                  key={option.value || 'all'}
                  value={option.value}
                  className={({ active }) => `
                    relative cursor-pointer select-none py-2.5 px-4
                    ${active ? 'bg-gray-50' : ''}
                    transition-colors duration-150
                  `}
                >
                  {({ selected }) => (
                    <div className="flex items-center gap-3">
                      {option.value && (
                        <span className={`w-2 h-2 rounded-full ${colors?.dot}`} />
                      )}
                      <span className={`flex-1 text-sm font-medium ${
                        selected ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {option.label}
                      </span>
                      {selected && (
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// Modern Severity Select Component for Filters
const ModernSeverityFilterSelect = ({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) => {
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, { bg: string; text: string; dot: string }> = {
      low: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
      medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
      high: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      critical: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    };
    return colors[severity];
  };

  const options = [
    { value: '', label: 'All severities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className={`
          relative w-full flex items-center justify-between gap-2 px-4 py-2.5
          ${value ? getSeverityColor(value)?.bg : 'bg-white'}
          ${value ? getSeverityColor(value)?.text : 'text-gray-900'}
          rounded-xl border border-gray-200
          hover:border-gray-300 hover:shadow-sm
          focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
          transition-all duration-200 ease-in-out
          cursor-pointer font-medium text-left
        `}>
          <div className="flex items-center gap-2">
            {value && (
              <span className={`w-2 h-2 rounded-full ${getSeverityColor(value)?.dot}`} />
            )}
            <span>{selectedOption.label}</span>
          </div>
          <svg
            className="w-4 h-4 text-gray-500 transition-transform duration-200 ui-open:rotate-180"
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
            {options.map((option) => {
              const colors = option.value ? getSeverityColor(option.value) : null;
              return (
                <Listbox.Option
                  key={option.value || 'all'}
                  value={option.value}
                  className={({ active }) => `
                    relative cursor-pointer select-none py-2.5 px-4
                    ${active ? 'bg-gray-50' : ''}
                    transition-colors duration-150
                  `}
                >
                  {({ selected }) => (
                    <div className="flex items-center gap-3">
                      {option.value && (
                        <span className={`w-2 h-2 rounded-full ${colors?.dot}`} />
                      )}
                      <span className={`flex-1 text-sm font-medium ${
                        selected ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {option.label}
                      </span>
                      {selected && (
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// Modern Category Select Component for Filters (no colors)
const ModernCategoryFilterSelect = ({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) => {
  const options = [
    { value: '', label: 'All categories' },
    { value: 'phishing', label: 'Phishing' },
    { value: 'malware', label: 'Malware' },
    { value: 'unauthorized_access', label: 'Unauthorized Access' },
    { value: 'data_exposure', label: 'Data Exposure' },
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'system_compromise', label: 'System Compromise' },
  ];

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="
          relative w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-white text-gray-900
          rounded-xl border border-gray-200
          hover:border-gray-300 hover:shadow-sm
          focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
          transition-all duration-200 ease-in-out
          cursor-pointer font-medium text-left
        ">
          <span>{selectedOption.label}</span>
          <svg
            className="w-4 h-4 text-gray-500 transition-transform duration-200 ui-open:rotate-180"
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
            {options.map((option) => (
              <Listbox.Option
                key={option.value || 'all'}
                value={option.value}
                className={({ active }) => `
                  relative cursor-pointer select-none py-2.5 px-4
                  ${active ? 'bg-gray-50' : ''}
                  transition-colors duration-150
                `}
              >
                {({ selected }) => (
                  <div className="flex items-center justify-between">
                    <span className={`flex-1 text-sm font-medium ${
                      selected ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {option.label}
                    </span>
                    {selected && (
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
};

export default function IncidentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || '',
    severity: searchParams.get('severity') || '',
    category: searchParams.get('category') || '',
    branch: searchParams.get('branch_acronym') || '',
  }))

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

    const fetchIncidents = async () => {
      try {
        const params = new URLSearchParams()
        if (filters.status) params.append('status', filters.status)
        if (filters.severity) params.append('severity', filters.severity)
        if (filters.category) params.append('category', filters.category)
        if (filters.branch) params.append('branch_acronym', filters.branch)
        
        const response = await api.get(`/incidents?${params.toString()}`)
        setIncidents(response.data)
      } catch (error) {
        console.error('Failed to fetch incidents:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchIncidents()
  }, [user, router, filters, mounted])

  // Keyword search: match incident number, title, category, severity, status, affected asset/user, source ticket
  const keywords = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filteredIncidents = keywords.length === 0
    ? incidents
    : incidents.filter((inc) => {
        const searchText = [
          inc.incidentNumber,
          inc.title,
          inc.category,
          inc.severity,
          inc.status,
          inc.affectedAsset,
          inc.affectedUser,
          inc.sourceTicketNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return keywords.every((kw) => searchText.includes(kw))
      })

  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const paginatedIncidents = filteredIncidents.slice(start, start + PAGE_SIZE)

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages)
  }, [filteredIncidents.length, totalPages, page])

  // Status colors aligned with ModernIncidentStatusSelect component
  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; dot: string }> = {
      'new': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
      'triaged': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
      'investigating': { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
      'contained': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      'recovered': { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
      'closed': { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
    };
    return colors[status] || { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' };
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, { bg: string; text: string; dot: string }> = {
      low: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
      medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
      high: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      critical: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    }
    return colors[severity] || { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' }
  }

  const getStatusLabel = (status: string) => {
    return status ? status.replace(/_/g, ' ') : 'new'
  }

  const getSeverityLabel = (severity: string) => {
    return severity || 'medium'
  }

  if (!mounted || !user) {
    return (
      <ProtectedRoute allowedRoles={['security_officer', 'admin']}>
        <div className="panel-page flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-500">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['security_officer', 'admin']}>
      <div className="panel-page">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cybersecurity Incidents</h1>
            {user?.role === 'user' && (
              <Link href="/incidents/create" className="btn-primary-incidents shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Incident
              </Link>
            )}
          </div>

          {/* Filters Card */}
          <div className="panel-card border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Filter incidents</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                <ModernStatusFilterSelect
                  value={filters.status}
                  onChange={(value) => setFilters({ ...filters, status: value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Severity</label>
                <ModernSeverityFilterSelect
                  value={filters.severity}
                  onChange={(value) => setFilters({ ...filters, severity: value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
                <ModernCategoryFilterSelect
                  value={filters.category}
                  onChange={(value) => setFilters({ ...filters, category: value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Branch</label>
                <Listbox value={filters.branch} onChange={(value) => setFilters({ ...filters, branch: value })}>
                  <div className="relative">
                    <Listbox.Button className="relative w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white text-gray-900 rounded-xl border border-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer font-medium text-left">
                      <span>{filters.branch ? REAL_BRANCHES.find((b) => b.acronym === filters.branch)?.name ?? filters.branch : 'All branches'}</span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </Listbox.Button>
                    <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                      <Listbox.Options className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-60 overflow-auto">
                        <Listbox.Option value="" className={({ active }) => `cursor-pointer py-2.5 px-4 ${active ? 'bg-gray-50' : ''}`}>All branches</Listbox.Option>
                        {REAL_BRANCHES.map((b) => (
                          <Listbox.Option key={b.acronym} value={b.acronym} className={({ active }) => `cursor-pointer py-2.5 px-4 ${active ? 'bg-gray-50' : ''}`}>
                            {b.name}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="panel-card border border-gray-200 flex flex-col items-center justify-center py-16 text-gray-500">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-red-600 mb-4" />
              <p>Loading incidents...</p>
            </div>
          ) : incidents.length === 0 ? (
            <div className="panel-card border border-gray-200 text-center py-12 text-gray-500">No incidents found</div>
          ) : (
            <>
              {/* Search Bar - Moved above the table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="search"
                        placeholder="Search incidents by #, title, category, severity, status, affected asset/user..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow"
                      />
                    </div>
                    {searchQuery.trim() && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">
                          {filteredIncidents.length} result{filteredIncidents.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setPage(1);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-auto max-h-[calc(100vh-20rem)] min-h-[220px]">
                  {filteredIncidents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No incidents match your search. Try different keywords.
                    </div>
                  ) : (
                    <table className="min-w-[1000px] w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Incident #</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Category</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Title</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Severity</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Status</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Affected Asset</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Affected User</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Source Ticket</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Created</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {paginatedIncidents.map((incident) => {
                          const statusColors = getStatusColor(incident.status || 'new');
                          const severityColors = getSeverityColor(incident.severity || 'medium');
                          
                          return (
                            <tr key={incident.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Link href={`/incidents/${incident.id}`} className="font-mono text-red-600 hover:text-red-700 font-medium transition-colors">
                                  {incident.incidentNumber || `#${incident.id}`}
                                </Link>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {incident.category ? incident.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '—'}
                              </td>
                              <td className="px-4 py-4 min-w-[140px]">
                                <Link href={`/incidents/${incident.id}`} className="text-gray-900 hover:text-red-600 transition-colors line-clamp-2">
                                  {incident.title || 'Untitled'}
                                </Link>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${severityColors.bg} ${severityColors.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${severityColors.dot}`} />
                                  {getSeverityLabel(incident.severity || 'medium')}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
                                  {getStatusLabel(incident.status || 'new')}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {incident.affectedAsset || '—'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {incident.affectedUser || '—'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {incident.sourceTicketNumber ? (
                                  <Link href={incident.sourceTicketId ? `/tickets/${incident.sourceTicketId}` : '#'} className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                                    {incident.sourceTicketNumber}
                                  </Link>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatPinoyDateTime(incident.createdAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination */}
                {filteredIncidents.length > 0 && (
                  <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-wrap gap-3">
                    <p className="text-sm text-gray-600">
                      Showing {start + 1}–{Math.min(start + PAGE_SIZE, filteredIncidents.length)} of {filteredIncidents.length} incidents
                      {searchQuery.trim() ? ` (filtered from ${incidents.length})` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setPage((p) => Math.max(1, p - 1))} 
                        disabled={page <= 1} 
                        className="btn-pagination"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
                      <button 
                        type="button" 
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                        disabled={page >= totalPages} 
                        className="btn-pagination"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}