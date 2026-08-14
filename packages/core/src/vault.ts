export type ThemeMode = 'light' | 'dark'

export type CloudProvider = 'icloud' | 'google-drive' | 'onedrive' | 'dropbox'

export interface VaultStatus {
  configured: boolean
  path: string | null
  name: string | null
}

/** System folders — hidden from the vault browser (dot-prefixed). */
export const VAULT_FOLDERS = {
  CONTACTS: 'contacts',
  CALENDAR: '.calendar',
  DIARY: 'diary',
  NOTES: 'notes',
  ATTACHMENTS: 'attachments',
  SETTINGS: '.settings',
} as const

export const HIDDEN_VAULT_PATHS = new Set([
  '.calendar',
  '.settings',
  'contacts',
  'diary',
  'attachments',
])

/** Folders hidden when browsing the notes zone specifically. */
export const NOTES_HIDDEN_PATHS = new Set([
  '.calendar',
  '.settings',
  'contacts',
  'diary',
  'attachments',
])

export function resolveDiaryPath(dateStr: string): string {
  const [year] = dateStr.split('-')
  return `${VAULT_FOLDERS.DIARY}/${year}/${dateStr}.md`
}

export function isDiaryPath(relativePath: string): boolean {
  return relativePath.replace(/\\/g, '/').startsWith(`${VAULT_FOLDERS.DIARY}/`)
}

export function diaryDateFromPath(relativePath: string): string | null {
  const match = relativePath.replace(/\\/g, '/').match(/(\d{4}-\d{2}-\d{2})\.md$/)
  return match?.[1] ?? null
}

export function isValidDiaryDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
