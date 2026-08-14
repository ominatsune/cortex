import { extractNoteTitle, diaryDateFromPath } from '@cortex/core'

export { extractNoteTitle }

export function splitNoteHeaderPath(
  vaultName: string,
  noteRelativePath: string | null,
  content: string
): { prefix: string; title: string } {
  if (noteRelativePath) {
    const diaryDate = diaryDateFromPath(noteRelativePath)
    if (diaryDate) {
      const withoutExt = noteRelativePath.replace(/\\/g, '/').replace(/\.md$/, '')
      const parts = withoutExt.split('/')
      parts.pop()
      const dir = parts.length > 0 ? `${parts.join('/')}/` : ''
      return { prefix: `${vaultName}/${dir}`, title: diaryDate }
    }
  }

  const title = extractNoteTitle(content)

  if (!noteRelativePath) {
    return { prefix: `${vaultName}/`, title }
  }

  const withoutExt = noteRelativePath.replace(/\\/g, '/').replace(/\.md$/, '')
  const parts = withoutExt.split('/')
  parts.pop()
  const dir = parts.length > 0 ? `${parts.join('/')}/` : ''
  const prefix = `${vaultName}/${dir}`

  return { prefix, title }
}

/** @deprecated use splitNoteHeaderPath */
export function buildNoteDisplayPath(
  vaultName: string,
  noteRelativePath: string | null,
  title: string
): string {
  const { prefix } = splitNoteHeaderPath(vaultName, noteRelativePath, `# ${title}\n`)
  return `${prefix}${title}`
}
