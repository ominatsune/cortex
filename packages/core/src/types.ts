export type AppZone = 'notes' | 'diary' | 'contacts'
export type EditorMode = 'edit' | 'read'
export type StorageSection = 'notes' | 'diary' | 'all'

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  modified?: string
  children?: TreeNode[]
}

export interface FileEntry {
  name: string
  path: string
  modified: string
}

export interface AttachmentEntry {
  name: string
  path: string
  size: number
  modified: string
}

export interface TagIndex {
  tag: string
  count: number
  paths: string[]
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
  notes?: string
  color?: string
  contactIds?: string[]
  notePaths?: string[]
  diaryDates?: string[]
}

export interface CreateEventInput {
  title: string
  start: string
  end: string
  allDay?: boolean
  location?: string
  notes?: string
  color?: string
  contactIds?: string[]
  notePaths?: string[]
  diaryDates?: string[]
}

export interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  notes?: string
  tags: string[]
  created: string
  modified: string
}

export interface OpenDocument {
  path: string
  name: string
  zone: AppZone
}

export type SearchResultType = 'note' | 'diary' | 'contact' | 'calendar' | 'tag'

export interface SearchResult {
  type: SearchResultType
  /** Vault-relative path; absent for 'tag' results. */
  path?: string
  /** Note title / diary date / contact name / event title / '#tagname'. */
  title: string
  /** Contact email or company, event date range, or a matched-text snippet. */
  subtitle?: string
}
