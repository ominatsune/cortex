import type {
  AttachmentEntry,
  CalendarEvent,
  Contact,
  CreateEventInput,
  FileEntry,
  StorageSection,
  TagIndex,
  TreeNode,
} from './types'
import type { CloudProvider, ThemeMode, VaultStatus } from './vault'

export interface CortexStorageAPI {
  getDataPath(): Promise<string>
  getTree(section: StorageSection): Promise<TreeNode[]>
  getVaultTree(zone?: 'notes' | 'diary'): Promise<TreeNode[]>
  listFiles(section: StorageSection): Promise<FileEntry[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<boolean>
  deleteFile(path: string): Promise<boolean>
  createNote(folder?: string): Promise<FileEntry>
  createNoteWithTitle(folder: string, title: string): Promise<FileEntry & { created: boolean }>
  createFolder(folderPath: string): Promise<string>
  rename(oldPath: string, newPath: string): Promise<string>
  movePath(fromPath: string, toFolder: string): Promise<string>
  syncNoteFilename(notePath: string, content: string): Promise<string>
  openDiaryEntry(dateStr: string): Promise<string>
  /** @deprecated use openDiaryEntry */
  getDiaryPath(dateStr: string): Promise<string>
  listDiaryDates(): Promise<string[]>
}

export interface CortexAttachmentsAPI {
  list(relativeFolder: string): Promise<AttachmentEntry[]>
  add(relativeFolder: string): Promise<AttachmentEntry | null>
  delete(relativePath: string): Promise<boolean>
}

export interface CortexTagsAPI {
  index(): Promise<TagIndex[]>
}

export interface CortexCalendarAPI {
  listEvents(start: string, end: string): Promise<CalendarEvent[]>
  createEvent(event: CreateEventInput): Promise<CalendarEvent>
  updateEvent(id: string, updates: Partial<CreateEventInput>): Promise<CalendarEvent | null>
  deleteEvent(id: string): Promise<boolean>
  getByPath(relativePath: string): Promise<CalendarEvent | null>
}

export interface CortexContactsAPI {
  list(): Promise<Contact[]>
  create(contact: Omit<Contact, 'id' | 'created' | 'modified'>): Promise<Contact>
  update(id: string, updates: Partial<Omit<Contact, 'id' | 'created'>>): Promise<Contact | null>
  delete(id: string): Promise<boolean>
  getByPath(relativePath: string): Promise<Contact | null>
}

export interface CortexExportAPI {
  pdf(html: string, defaultName: string): Promise<string | null>
}

export interface CortexVaultAPI {
  getStatus(): Promise<VaultStatus>
  createNew(parentPath: string, vaultName: string): Promise<VaultStatus>
  openExisting(defaultPath?: string): Promise<VaultStatus | null>
  pickParentDirectory(defaultPath?: string): Promise<string | null>
  getCloudBasePath(provider: CloudProvider): Promise<string>
  close(): Promise<VaultStatus>
}

export interface CortexSettingsAPI {
  getTheme(): Promise<ThemeMode>
  setTheme(theme: ThemeMode): Promise<void>
}

export interface CortexAPI {
  storage: CortexStorageAPI
  attachments: CortexAttachmentsAPI
  tags: CortexTagsAPI
  calendar: CortexCalendarAPI
  contacts: CortexContactsAPI
  export: CortexExportAPI
  vault: CortexVaultAPI
  settings: CortexSettingsAPI
}

export type { CloudProvider, ThemeMode, VaultStatus }
