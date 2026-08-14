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

export function filterWikiLinkFiles(
  files: { name: string; path: string }[],
  query: string
): { name: string; path: string }[] {
  const q = query.trim().toLowerCase()
  if (!q) return files
  return files.filter((f) => {
    const pathLabel = formatNotePathLabel(f.path).toLowerCase()
    return f.name.toLowerCase().includes(q) || pathLabel.includes(q)
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
