import { extractNoteTitle, sanitizeNoteName } from '@cortex/core'
import { stripTagsBlock } from './note-tags'

export function formatNotePathLabel(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/\.md$/, '')
}

export function wikiLinkTitleMatches(
  linkTitle: string,
  noteTitle: string,
  fileBaseName: string
): boolean {
  const normalized = sanitizeNoteName(linkTitle).toLowerCase()
  return (
    normalized === sanitizeNoteName(noteTitle).toLowerCase() ||
    normalized === sanitizeNoteName(fileBaseName).toLowerCase()
  )
}

function diaryDateFromEntryPath(relativePath: string): string | null {
  const match = relativePath.replace(/\\/g, '/').match(/^diary\/.*\/(\d{4}-\d{2}-\d{2})\.md$/)
  return match ? match[1] : null
}

export function filterWikiLinkFiles(
  files: { name: string; path: string }[],
  query: string
): { name: string; path: string }[] {
  const q = query.trim().toLowerCase()
  const matched = !q
    ? files
    : files.filter((f) => {
        const pathLabel = formatNotePathLabel(f.path).toLowerCase()
        return f.name.toLowerCase().includes(q) || pathLabel.includes(q)
      })

  // Diary entries sort to the top, newest first — typing [[2026... should
  // surface recent diary dates before unrelated notes.
  return [...matched].sort((a, b) => {
    const dateA = diaryDateFromEntryPath(a.path)
    const dateB = diaryDateFromEntryPath(b.path)
    if (dateA && dateB) return dateB.localeCompare(dateA)
    if (dateA && !dateB) return -1
    if (!dateA && dateB) return 1
    return 0
  })
}

export async function resolveWikiLinkPath(
  linkTitle: string,
  files: { name: string; path: string }[],
  readFile: (path: string) => Promise<string>
): Promise<string | null> {
  const trimmed = linkTitle.trim()
  if (!trimmed) return null

  const basenameMatches = files.filter(
    (f) => sanitizeNoteName(f.name).toLowerCase() === sanitizeNoteName(trimmed).toLowerCase()
  )
  if (basenameMatches.length === 1) return basenameMatches[0].path

  for (const file of files) {
    const base = file.name
    if (wikiLinkTitleMatches(trimmed, base, base)) return file.path
    try {
      const raw = await readFile(file.path)
      const { body } = stripTagsBlock(raw)
      const title = extractNoteTitle(body)
      if (wikiLinkTitleMatches(trimmed, title, base)) return file.path
    } catch {
      // skip unreadable files
    }
  }

  if (basenameMatches.length > 0) return basenameMatches[0].path
  return null
}
