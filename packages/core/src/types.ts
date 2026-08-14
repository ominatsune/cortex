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
}

export interface CreateEventInput {
  title: string
  start: string
  end: string
  allDay?: boolean
  location?: string
  notes?: string
  color?: string
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
