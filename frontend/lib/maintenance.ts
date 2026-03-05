// Default lists for ticket form dropdowns. Can be extended via Maintenance modal (stored in localStorage).

const AFFECTED_SYSTEMS_DEFAULT = [
  'Windows 11',
  'Viber',
  'Wi-Fi Network',
  'LAN',
  'Desktop',
  'Laptop',
  'Printer',
]

const CATEGORIES_DEFAULT = [
  'Hardware',
  'Software',
  'Network',
  'Peripheral',
]

const INCIDENT_CATEGORIES_DEFAULT = [
  'Phishing',
  'Malware',
  'Unauthorized Access',
  'Data Exposure',
  'Policy Violation',
  'System Compromise',
  'Other',
]

// Default Severities
const SEVERITIES_DEFAULT = [
  'Low',
  'Medium',
  'High',
  'Critical',
]

// Default Ticket Statuses
const TICKET_STATUSES_DEFAULT = [
  'New',
  'Assigned',
  'In Progress',
  'Waiting for User',
  'Resolved',
  'Closed',
  'Converted to Incident',
]

// Default Priorities
const PRIORITIES_DEFAULT = [
  'Low',
  'Medium',
  'High',
  'Urgent',
]

const INCIDENT_STATUSES_DEFAULT = [
  'New',
  'Triaged',
  'Investigating',
  'Contained',
  'Recovered',
  'Closed',
]

const STORAGE_KEY_AFFECTED = 'starkson_affected_systems'
const STORAGE_KEY_CATEGORIES = 'starkson_categories'
const STORAGE_KEY_INCIDENT_CATEGORIES = 'starkson_incident_categories'
const STORAGE_KEY_SEVERITIES = 'starkson_severities'
const STORAGE_KEY_TICKET_STATUSES = 'starkson_ticket_statuses'
const STORAGE_KEY_PRIORITIES = 'starkson_priorities'
const STORAGE_KEY_INCIDENT_STATUSES = 'starkson_incident_statuses'

export const INCIDENT_STATUSES_DEFAULTS = INCIDENT_STATUSES_DEFAULT

function getFromStorage<T>(key: string, defaultValue: T[]): T[] {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored) as T[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // ignore
  }
  return defaultValue
}

function setToStorage<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

// Initialize default values if they don't exist
export function initializeDefaults(): void {
  if (typeof window === 'undefined') return
  
  // Only set defaults if no data exists
  if (!localStorage.getItem(STORAGE_KEY_AFFECTED)) {
    setAffectedSystems(AFFECTED_SYSTEMS_DEFAULT)
  }
  if (!localStorage.getItem(STORAGE_KEY_CATEGORIES)) {
    setCategories(CATEGORIES_DEFAULT)
  }
  if (!localStorage.getItem(STORAGE_KEY_PRIORITIES)) {
    setPriorities(PRIORITIES_DEFAULT)
  }
  if (!localStorage.getItem(STORAGE_KEY_INCIDENT_CATEGORIES)) {
    setIncidentCategories(INCIDENT_CATEGORIES_DEFAULT)
  }
  if (!localStorage.getItem(STORAGE_KEY_SEVERITIES)) {
    setSeverities(SEVERITIES_DEFAULT)
  }
  if (!localStorage.getItem(STORAGE_KEY_TICKET_STATUSES)) {
    setTicketStatuses(TICKET_STATUSES_DEFAULT)
  }
  if (!localStorage.getItem(STORAGE_KEY_INCIDENT_STATUSES)) {
    setIncidentStatuses(INCIDENT_STATUSES_DEFAULT)
  }
}

export const AFFECTED_SYSTEMS_DEFAULTS = AFFECTED_SYSTEMS_DEFAULT
export const CATEGORIES_DEFAULTS = CATEGORIES_DEFAULT
export const INCIDENT_CATEGORIES_DEFAULTS = INCIDENT_CATEGORIES_DEFAULT
export const SEVERITIES_DEFAULTS = SEVERITIES_DEFAULT
export const TICKET_STATUSES_DEFAULTS = TICKET_STATUSES_DEFAULT
export const PRIORITIES_DEFAULTS = PRIORITIES_DEFAULT

export function getAffectedSystems(): string[] {
  return getFromStorage(STORAGE_KEY_AFFECTED, AFFECTED_SYSTEMS_DEFAULT)
}

export function setAffectedSystems(list: string[]): void {
  setToStorage(STORAGE_KEY_AFFECTED, list)
}

export function getCategories(): string[] {
  return getFromStorage(STORAGE_KEY_CATEGORIES, CATEGORIES_DEFAULT)
}

export function setCategories(list: string[]): void {
  setToStorage(STORAGE_KEY_CATEGORIES, list)
}

// Incident Categories
export function getIncidentCategories(): string[] {
  return getFromStorage(STORAGE_KEY_INCIDENT_CATEGORIES, INCIDENT_CATEGORIES_DEFAULT)
}

export function setIncidentCategories(list: string[]): void {
  setToStorage(STORAGE_KEY_INCIDENT_CATEGORIES, list)
}

// Severities
export function getSeverities(): string[] {
  return getFromStorage(STORAGE_KEY_SEVERITIES, SEVERITIES_DEFAULT)
}

export function setSeverities(list: string[]): void {
  setToStorage(STORAGE_KEY_SEVERITIES, list)
}

// Ticket Statuses
export function getTicketStatuses(): string[] {
  return getFromStorage(STORAGE_KEY_TICKET_STATUSES, TICKET_STATUSES_DEFAULT)
}

export function setTicketStatuses(list: string[]): void {
  setToStorage(STORAGE_KEY_TICKET_STATUSES, list)
}

// Priorities
export function getPriorities(): string[] {
  return getFromStorage(STORAGE_KEY_PRIORITIES, PRIORITIES_DEFAULT)
}

export function setPriorities(list: string[]): void {
  setToStorage(STORAGE_KEY_PRIORITIES, list)
}

export function getIncidentStatuses(): string[] {
  return getFromStorage(STORAGE_KEY_INCIDENT_STATUSES, INCIDENT_STATUSES_DEFAULT)
}

export function setIncidentStatuses(list: string[]): void {
  setToStorage(STORAGE_KEY_INCIDENT_STATUSES, list)
}

// Function to fetch/refresh all maintenance data from localStorage
export function fetchMaintenanceData(): {
  affectedSystems: string[];
  categories: string[];
  priorities: string[];
  incidentCategories: string[];
  severities: string[];
  ticketStatuses: string[];
  incidentStatuses: string[];
} {
  // Force a read from localStorage for all data types
  const affectedSystems = getFromStorage(STORAGE_KEY_AFFECTED, AFFECTED_SYSTEMS_DEFAULT);
  const categories = getFromStorage(STORAGE_KEY_CATEGORIES, CATEGORIES_DEFAULT);
  const priorities = getFromStorage(STORAGE_KEY_PRIORITIES, PRIORITIES_DEFAULT);
  const incidentCategories = getFromStorage(STORAGE_KEY_INCIDENT_CATEGORIES, INCIDENT_CATEGORIES_DEFAULT);
  const severities = getFromStorage(STORAGE_KEY_SEVERITIES, SEVERITIES_DEFAULT);
  const ticketStatuses = getFromStorage(STORAGE_KEY_TICKET_STATUSES, TICKET_STATUSES_DEFAULT);
  const incidentStatuses = getFromStorage(STORAGE_KEY_INCIDENT_STATUSES, INCIDENT_STATUSES_DEFAULT);
  
  return {
    affectedSystems,
    categories,
    priorities,
    incidentCategories,
    severities,
    ticketStatuses,
    incidentStatuses
  };
}

// Optional: Function to reset all data to defaults
export function resetAllToDefaults(): void {
  setAffectedSystems(AFFECTED_SYSTEMS_DEFAULT);
  setCategories(CATEGORIES_DEFAULT);
  setPriorities(PRIORITIES_DEFAULT);
  setIncidentCategories(INCIDENT_CATEGORIES_DEFAULT);
  setSeverities(SEVERITIES_DEFAULT);
  setTicketStatuses(TICKET_STATUSES_DEFAULT);
  setIncidentStatuses(INCIDENT_STATUSES_DEFAULT);
}

// Optional: Function to get all data at once (useful for debugging)
export function getAllMaintenanceData(): Record<string, string[]> {
  return {
    affectedSystems: getAffectedSystems(),
    categories: getCategories(),
    priorities: getPriorities(),
    incidentCategories: getIncidentCategories(),
    severities: getSeverities(),
    ticketStatuses: getTicketStatuses(),
    incidentStatuses: getIncidentStatuses()
  };
}