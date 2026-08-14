import type {
  AppZone,
  AttachmentEntry,
  CalendarEvent,
  CloudProvider,
  Contact,
  CortexAPI,
  CreateEventInput,
  EditorMode,
  FileEntry,
  OpenDocument,
  TagIndex,
  ThemeMode,
  TreeNode,
  VaultStatus,
} from '@cortex/core'

declare global {
  interface Window {
    cortex: CortexAPI
  }
}

export type {
  AppZone,
  AttachmentEntry,
  CalendarEvent,
  CloudProvider,
  Contact,
  CreateEventInput,
  EditorMode,
  FileEntry,
  OpenDocument,
  TagIndex,
  ThemeMode,
  TreeNode,
  VaultStatus,
}
