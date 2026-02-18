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

const STORAGE_KEY_AFFECTED = 'starkson_affected_systems'
const STORAGE_KEY_CATEGORIES = 'starkson_categories'

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

export const AFFECTED_SYSTEMS_DEFAULTS = AFFECTED_SYSTEMS_DEFAULT
export const CATEGORIES_DEFAULTS = CATEGORIES_DEFAULT

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
