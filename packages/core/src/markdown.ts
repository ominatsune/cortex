import { stripTagsBlock } from './tags'

export function attachmentMarkdown(relativePath: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
  if (ext && imageExts.includes(ext)) {
    return `![${fileName}](${relativePath})`
  }
  return `[${fileName}](${relativePath})`
}

export function sanitizeNoteName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'Untitled'
}

export const UNTITLED_NOTE = 'Untitled note'
export const UNTITLED_CONTACT = 'Untitled contact'

export const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g

export function extractNoteTitle(content: string): string {
  const { body } = stripTagsBlock(content)
  const firstLine = body.split('\n')[0] ?? ''
  return firstLine.replace(/^#{1,6}\s*/, '').trim() || UNTITLED_NOTE
}

export function findWikiLinks(content: string): string[] {
  const links = new Set<string>()
  const re = new RegExp(WIKI_LINK_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const title = m[1].trim()
    if (title) links.add(title)
  }
  return Array.from(links)
}

export function defaultNoteContent(title: string): string {
  return `# ${title}\n\n`
}

export function defaultUntitledNoteContent(): string {
  return `# ${UNTITLED_NOTE}\n\n`
}

/** Keeps blank lines visible in markdown preview/read mode. */
export function preserveEmptyLinesForPreview(markdown: string): string {
  return markdown.split('\n').map((line) => (line.length === 0 ? '\u00A0' : line)).join('\n')
}

export function defaultDiaryContent(dateStr: string): string {
  return `# ${dateStr}\n\n`
}
