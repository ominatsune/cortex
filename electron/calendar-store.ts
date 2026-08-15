import type { CalendarEvent } from '@cortex/core'
import { VAULT_FOLDERS, withFileTypeLine, stripFileTypeLine } from '@cortex/core'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { buildFrontmatter, parseFrontmatter, sanitizeFileName } from './markdown-files'
import { getDataPath } from './storage'

export type StoredCalendarEvent = CalendarEvent

function calendarDir(): string {
  return path.join(getDataPath(), VAULT_FOLDERS.CALENDAR)
}

function eventFilePath(id: string, title: string): string {
  return path.join(calendarDir(), `${sanitizeFileName(title)}-${id.slice(0, 8)}.md`)
}

function parseCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const items = value.split(',').map((v) => v.trim()).filter(Boolean)
  return items.length > 0 ? items : undefined
}

function parseEventFile(raw: string): StoredCalendarEvent | null {
  const stripped = stripFileTypeLine(raw)
  const { meta, body } = parseFrontmatter(stripped)
  if (!meta.id || !meta.title || !meta.start || !meta.end) return null
  return {
    id: meta.id,
    title: meta.title,
    start: meta.start,
    end: meta.end,
    allDay: meta.allDay === 'true',
    location: meta.location || undefined,
    notes: body.trim() || undefined,
    color: meta.color || undefined,
    contactIds: parseCsv(meta.contactIds),
    notePaths: parseCsv(meta.notePaths),
    diaryDates: parseCsv(meta.diaryDates),
  }
}

async function writeEventFile(event: StoredCalendarEvent, existingPath?: string): Promise<string> {
  await fs.mkdir(calendarDir(), { recursive: true })
  const filePath = existingPath ?? eventFilePath(event.id, event.title)
  const content = withFileTypeLine(
    'calendar',
    buildFrontmatter(
      {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        location: event.location,
        color: event.color,
        contactIds: event.contactIds,
        notePaths: event.notePaths,
        diaryDates: event.diaryDates,
      },
      event.notes ?? ''
    )
  )
  await fs.writeFile(filePath, content, 'utf-8')
  return filePath
}

async function findEventFile(id: string): Promise<string | null> {
  let entries: string[]
  try {
    entries = await fs.readdir(calendarDir())
  } catch {
    return null
  }
  for (const name of entries) {
    if (!name.endsWith('.md')) continue
    const filePath = path.join(calendarDir(), name)
    const raw = await fs.readFile(filePath, 'utf-8')
    const event = parseEventFile(raw)
    if (event?.id === id) return filePath
  }
  return null
}

async function readAllEvents(): Promise<StoredCalendarEvent[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(calendarDir())
  } catch {
    return []
  }
  const events: StoredCalendarEvent[] = []
  for (const name of entries) {
    if (!name.endsWith('.md')) continue
    const raw = await fs.readFile(path.join(calendarDir(), name), 'utf-8')
    const event = parseEventFile(raw)
    if (event) events.push(event)
  }
  return events
}

export async function listStoredEvents(start: string, end: string): Promise<StoredCalendarEvent[]> {
  const events = await readAllEvents()
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  return events.filter((evt) => {
    const evtStart = new Date(evt.start).getTime()
    return evtStart >= startMs && evtStart < endMs
  })
}

export async function createStoredEvent(
  input: Omit<StoredCalendarEvent, 'id'>
): Promise<StoredCalendarEvent> {
  const event: StoredCalendarEvent = { ...input, id: uuidv4() }
  await writeEventFile(event)
  return event
}

export async function updateStoredEvent(
  id: string,
  updates: Partial<Omit<StoredCalendarEvent, 'id'>>
): Promise<StoredCalendarEvent | null> {
  const filePath = await findEventFile(id)
  if (!filePath) return null

  const raw = await fs.readFile(filePath, 'utf-8')
  const existing = parseEventFile(raw)
  if (!existing) return null

  const updated: StoredCalendarEvent = { ...existing, ...updates }

  if (updates.title && updates.title !== existing.title) {
    await fs.unlink(filePath)
    await writeEventFile(updated)
  } else {
    await writeEventFile(updated, filePath)
  }
  return updated
}

export async function deleteStoredEvent(id: string): Promise<boolean> {
  const filePath = await findEventFile(id)
  if (!filePath) return false
  await fs.unlink(filePath)
  return true
}

export async function getEventByRelativePath(relativePath: string): Promise<StoredCalendarEvent | null> {
  try {
    const raw = await fs.readFile(path.join(getDataPath(), relativePath), 'utf-8')
    return parseEventFile(raw)
  } catch {
    return null
  }
}

export async function getEventFilePath(id: string): Promise<string | null> {
  return findEventFile(id)
}
