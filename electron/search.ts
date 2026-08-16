import {
  extractNoteTitle,
  isDiaryPath,
  parseFileType,
  stripFileTypeLine,
  stripTagsBlock,
} from '@cortex/core'
import type { SearchResult } from '@cortex/core'
import { getDataPath, listMarkdownFiles, readVaultFile } from './storage'
import { parseContactFile } from './contacts-store'
import { parseEventFile } from './calendar-store'

const RESULTS_PER_TYPE = 8
const SNIPPET_RADIUS = 40

function buildSnippet(text: string | undefined, query: string): string | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const index = trimmed.toLowerCase().indexOf(query)
  if (index === -1) return trimmed.slice(0, SNIPPET_RADIUS * 2)
  const start = Math.max(0, index - SNIPPET_RADIUS)
  const end = Math.min(trimmed.length, index + query.length + SNIPPET_RADIUS)
  return `${start > 0 ? '…' : ''}${trimmed.slice(start, end)}${end < trimmed.length ? '…' : ''}`
}

/** Full-vault substring search across notes, diary entries, contacts,
 *  calendar events, and tags. Naive scan-and-filter, same pattern as
 *  indexAllTags — the IPC boundary (window.cortex.search.query) is what
 *  keeps this swappable for a real index later without touching callers. */
export async function searchVault(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const base = getDataPath()
  const files = await listMarkdownFiles(base, base, { skipHiddenPaths: false })

  const notes: SearchResult[] = []
  const diary: SearchResult[] = []
  const contacts: SearchResult[] = []
  const calendar: SearchResult[] = []
  const tagHits = new Map<string, string>()

  for (const file of files) {
    const raw = await readVaultFile(file.path)
    if (!raw) continue
    const fileType = parseFileType(raw)

    if (fileType === 'contact') {
      const contact = parseContactFile(raw)
      if (!contact) continue
      const haystack = [contact.name, contact.email, contact.phone, contact.company, contact.notes, ...contact.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (haystack.includes(q) && contacts.length < RESULTS_PER_TYPE) {
        contacts.push({
          type: 'contact',
          path: file.path,
          title: contact.name,
          subtitle: contact.company || contact.email || buildSnippet(contact.notes, q),
        })
      }
      for (const tag of contact.tags) {
        if (tag.toLowerCase().includes(q)) tagHits.set(tag.toLowerCase(), tag)
      }
      continue
    }

    if (fileType === 'calendar') {
      const event = parseEventFile(raw)
      if (!event) continue
      const haystack = [event.title, event.location, event.notes].filter(Boolean).join(' ').toLowerCase()
      if (haystack.includes(q) && calendar.length < RESULTS_PER_TYPE) {
        calendar.push({
          type: 'calendar',
          path: file.path,
          title: event.title,
          subtitle: event.location || event.start.slice(0, 10),
        })
      }
      continue
    }

    // Everything else is a plain note or a diary entry.
    const stripped = stripFileTypeLine(raw)
    const title = extractNoteTitle(stripped)
    const { body, tags } = stripTagsBlock(stripped)
    const haystack = `${title} ${body}`.toLowerCase()
    const isDiary = isDiaryPath(file.path)
    const bucket = isDiary ? diary : notes
    if (haystack.includes(q) && bucket.length < RESULTS_PER_TYPE) {
      bucket.push({
        type: isDiary ? 'diary' : 'note',
        path: file.path,
        title,
        subtitle: buildSnippet(body, q),
      })
    }
    for (const tag of tags) {
      if (tag.toLowerCase().includes(q)) tagHits.set(tag.toLowerCase(), tag)
    }
  }

  const tags: SearchResult[] = Array.from(tagHits.values())
    .slice(0, RESULTS_PER_TYPE)
    .map((tag) => ({ type: 'tag', title: `#${tag}` }))

  return [...notes, ...diary, ...contacts, ...calendar, ...tags]
}
