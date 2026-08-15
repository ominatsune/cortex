import {
  defaultNoteContent,
  defaultUntitledNoteContent,
  extractNoteTitle,
  extractTagsFromContent,
  HIDDEN_VAULT_PATHS,
  NOTES_HIDDEN_PATHS,
  VAULT_FOLDERS,
  isDiaryPath,
  isValidDiaryDate,
  diaryDateFromPath,
  resolveDiaryPath,
  sanitizeNoteName,
  stripFileTypeLine,
  stripTagsBlock,
  UNTITLED_NOTE,
} from '@cortex/core'
import type { AttachmentEntry, TreeNode } from '@cortex/core'
import { dialog } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getVaultPath } from './vault-manager'

export function getDataPath(): string {
  return getVaultPath()
}

export async function readVaultFile(relativePath: string): Promise<string> {
  const fullPath = vaultFilePath(relativePath)
  try {
    return await fs.readFile(fullPath, 'utf-8')
  } catch {
    return ''
  }
}

export async function writeVaultFile(relativePath: string, content: string): Promise<void> {
  const normalizedPath = normalizeRelative(relativePath)
  const fullPath = vaultFilePath(normalizedPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, normalizeDiaryContent(normalizedPath, content), 'utf-8')
}

function normalizeRelative(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '')
}

function vaultFilePath(relativePath: string): string {
  const normalized = normalizeRelative(relativePath)
  if (!normalized || normalized.includes('..')) {
    throw new Error(`Invalid note path: ${relativePath}`)
  }
  return path.join(getDataPath(), ...normalized.split('/'))
}

function vaultBasename(relativePath: string, ext?: string): string {
  const normalized = normalizeRelative(relativePath)
  return ext ? path.posix.basename(normalized, ext) : path.posix.basename(normalized)
}

function vaultDirname(relativePath: string): string {
  return path.posix.dirname(normalizeRelative(relativePath))
}

function vaultJoin(dir: string, fileName: string): string {
  const normalizedDir = normalizeRelative(dir)
  if (!normalizedDir || normalizedDir === '.') return fileName
  return `${normalizedDir}/${fileName}`
}

function isHiddenPath(relativePath: string): boolean {
  const top = relativePath.split('/')[0]
  return HIDDEN_VAULT_PATHS.has(top)
}

function isNotesPath(relativePath: string): boolean {
  const normalized = normalizeRelative(relativePath)
  return normalized === VAULT_FOLDERS.NOTES || normalized.startsWith(`${VAULT_FOLDERS.NOTES}/`)
}

function normalizeDiaryContent(relativePath: string, content: string): string {
  if (!isDiaryPath(relativePath)) return content
  const expectedDate = diaryDateFromPath(relativePath)
  if (!expectedDate) return content
  const title = extractNoteTitle(content)
  if (isValidDiaryDate(title)) return content

  if (/^#{1,6}\s+.*$/m.test(content)) {
    return content.replace(/^#{1,6}\s+.*$/m, `# ${expectedDate}`)
  }
  return `# ${expectedDate}\n\n${content}`
}

export async function buildVaultTree(dir: string, basePath: string): Promise<TreeNode[]> {
  return buildVaultTreeWithHidden(dir, basePath, HIDDEN_VAULT_PATHS)
}

export async function buildNotesTree(basePath: string): Promise<TreeNode[]> {
  const notesDir = path.join(basePath, VAULT_FOLDERS.NOTES)
  try { await fs.mkdir(notesDir, { recursive: true }) } catch { /* ok */ }
  return buildVaultTreeWithHidden(notesDir, basePath, NOTES_HIDDEN_PATHS, false)
}

export async function buildDiaryTree(basePath: string): Promise<TreeNode[]> {
  const diaryDir = path.join(basePath, VAULT_FOLDERS.DIARY)
  try { await fs.mkdir(diaryDir, { recursive: true }) } catch { /* ok */ }
  return buildVaultTreeWithHidden(diaryDir, basePath, new Set<string>(), true)
}

async function buildVaultTreeWithHidden(dir: string, basePath: string, hidden: Set<string>, sortDesc = false): Promise<TreeNode[]> {
  const nodes: TreeNode[] = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return nodes
  }

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    // Files: sort ascending for notes, descending for diary (newest first)
    const cmp = a.name.localeCompare(b.name)
    return sortDesc ? -cmp : cmp
  })

  for (const entry of sorted) {
    if (entry.name.startsWith('.')) continue
    const relativePath = normalizeRelative(path.relative(basePath, path.join(dir, entry.name)))
    const topLevel = relativePath.split('/')[0]
    if (hidden.has(topLevel)) continue

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      const children = await buildVaultTreeWithHidden(fullPath, basePath, hidden, sortDesc)
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'folder',
        children,
      })
    } else {
      const stat = await fs.stat(fullPath)
      const isMarkdown = entry.name.endsWith('.md')
      nodes.push({
        name: isMarkdown ? entry.name.replace(/\.md$/, '') : entry.name,
        path: relativePath,
        type: 'file',
        modified: stat.mtime.toISOString(),
      })
    }
  }

  return nodes
}

export async function buildTree(dir: string, basePath: string): Promise<TreeNode[]> {
  return buildVaultTree(dir, basePath)
}

export async function listMarkdownFiles(
  dir: string,
  basePath: string,
  options: { skipHiddenPaths?: boolean } = {}
): Promise<{ name: string; path: string; modified: string }[]> {
  // skipHiddenPaths defaults to true — callers scoping to a single visible
  // section (e.g. "notes") rely on this to keep contacts/diary/attachments
  // out of the results. indexAllTags explicitly opts out since it must
  // scan every record type.
  const { skipHiddenPaths = true } = options
  const files: { name: string; path: string; modified: string }[] = []

  async function walk(currentDir: string) {
    let entries
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.name.endsWith('.md')) {
        try {
          const stat = await fs.stat(fullPath)
          const rel = normalizeRelative(path.relative(basePath, fullPath))
          // The hidden-section check must be relative to the walk root
          // (dir), not basePath — otherwise scoping the walk to e.g.
          // "diary/" (itself a hidden top-level folder) would flag every
          // file inside it as hidden and filter out the whole section.
          if (skipHiddenPaths) {
            const relFromDir = normalizeRelative(path.relative(dir, fullPath))
            if (isHiddenPath(relFromDir)) continue
          }
          files.push({
            name: entry.name.replace('.md', ''),
            path: rel,
            modified: stat.mtime.toISOString(),
          })
        } catch {
          // File removed between readdir and stat
        }
      }
    }
  }

  await walk(dir)
  return files
}

export async function createFolder(relativePath: string): Promise<string> {
  if (!isNotesPath(relativePath)) {
    throw new Error('Folders can only be created inside notes')
  }
  const fullPath = path.join(getDataPath(), relativePath)
  await fs.mkdir(fullPath, { recursive: true })
  return normalizeRelative(relativePath)
}

function noteRelativePath(relativeDir: string, fileName: string): string {
  const safeName = `${fileName}.md`
  if (!relativeDir || relativeDir === '.' || relativeDir === '/') return safeName
  return vaultJoin(relativeDir, safeName)
}

export async function createNote(
  relativeDir = ''
): Promise<{ name: string; path: string; modified: string }> {
  // Default to the notes root when no folder is specified
  const dir = !relativeDir || relativeDir === '' ? VAULT_FOLDERS.NOTES : relativeDir
  if (!isNotesPath(dir)) {
    throw new Error('Notes can only be created inside the notes folder')
  }
  let label = UNTITLED_NOTE
  let counter = 2
  let relativePath = noteRelativePath(dir, label)

  while (true) {
    const fullPath = vaultFilePath(relativePath)
    try {
      await fs.access(fullPath)
      label = `${UNTITLED_NOTE} ${counter++}`
      relativePath = noteRelativePath(dir, label)
    } catch {
      break
    }
  }

  const fullPath = vaultFilePath(relativePath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, defaultUntitledNoteContent(), 'utf-8')
  const stat = await fs.stat(fullPath)
  return { name: label, path: relativePath, modified: stat.mtime.toISOString() }
}

export async function createNoteWithTitle(
  relativeDir: string,
  title: string
): Promise<{ name: string; path: string; modified: string; created: boolean }> {
  const dir = !relativeDir || relativeDir === '' ? VAULT_FOLDERS.NOTES : relativeDir
  if (!isNotesPath(dir)) {
    throw new Error('Notes can only be created inside the notes folder')
  }
  const sanitized = sanitizeNoteName(title)
  let relativePath = noteRelativePath(dir, sanitized)
  const fullPath = vaultFilePath(relativePath)

  try {
    await fs.access(fullPath)
    const stat = await fs.stat(fullPath)
    return { name: sanitized, path: relativePath, modified: stat.mtime.toISOString(), created: false }
  } catch {
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, defaultNoteContent(title.trim()), 'utf-8')
    const stat = await fs.stat(fullPath)
    return { name: sanitized, path: relativePath, modified: stat.mtime.toISOString(), created: true }
  }
}

export async function syncNoteFilename(relativePath: string, content: string): Promise<string> {
  const normalizedPath = normalizeRelative(relativePath)
  if (isDiaryPath(normalizedPath)) {
    const { body } = stripTagsBlock(content)
    const date = extractNoteTitle(body)
    const currentDate = diaryDateFromPath(normalizedPath)
    if (!isValidDiaryDate(date)) {
      throw new Error('Diary titles must use YYYY-MM-DD')
    }
    if (date === currentDate) return normalizedPath

    const nextPath = resolveDiaryPath(date)
    try {
      await fs.access(vaultFilePath(nextPath))
      throw new Error(`A diary entry already exists for ${date}`)
    } catch (err) {
      if (err instanceof Error && !err.message.includes('ENOENT')) {
        throw err
      }
    }
    return renamePath(normalizedPath, nextPath)
  }

  const { body } = stripTagsBlock(content)
  const title = extractNoteTitle(body)
  const sanitized = sanitizeNoteName(title)
  const currentBase = vaultBasename(normalizedPath, '.md')

  if (
    !title ||
    title.toLowerCase() === UNTITLED_NOTE.toLowerCase() ||
    sanitized.toLowerCase() === currentBase.toLowerCase()
  ) {
    return normalizedPath
  }

  const dir = vaultDirname(normalizedPath)
  let candidate = sanitized
  let counter = 2

  while (true) {
    const newRelative = dir === '.' ? `${candidate}.md` : vaultJoin(dir, `${candidate}.md`)

    if (newRelative === normalizedPath) return normalizedPath

    const fullNew = vaultFilePath(newRelative)
    try {
      await fs.access(fullNew)
      candidate = `${sanitized} ${counter++}`
    } catch {
      return await renamePath(normalizedPath, newRelative)
    }
  }
}

export async function movePath(fromRelative: string, toFolderRelative: string): Promise<string> {
  if (isDiaryPath(fromRelative)) {
    throw new Error('Diary entries are locked to their date')
  }
  if (!isNotesPath(fromRelative) || !isNotesPath(toFolderRelative)) {
    throw new Error('Notes can only be moved inside the notes folder')
  }
  const base = getDataPath()
  const from = path.join(base, fromRelative)
  const entryName = path.basename(from)
  const destDir = toFolderRelative
    ? path.join(base, toFolderRelative)
    : base
  await fs.mkdir(destDir, { recursive: true })
  const dest = path.join(destDir, entryName)
  if (path.normalize(from) === path.normalize(dest)) {
    return normalizeRelative(fromRelative)
  }
  await fs.rename(from, dest)
  return normalizeRelative(path.relative(base, dest))
}

export async function deletePath(relativePath: string): Promise<boolean> {
  const fullPath = path.join(getDataPath(), relativePath)
  const stat = await fs.stat(fullPath)
  if (stat.isDirectory()) {
    await fs.rm(fullPath, { recursive: true })
  } else {
    await fs.unlink(fullPath)
  }
  return true
}

export async function renamePath(oldPath: string, newPath: string): Promise<string> {
  const normalizedOld = normalizeRelative(oldPath)
  const normalizedNew = normalizeRelative(newPath)
  const fullOld = vaultFilePath(normalizedOld)
  const fullNew = vaultFilePath(normalizedNew)
  await fs.mkdir(path.dirname(fullNew), { recursive: true })
  await fs.rename(fullOld, fullNew)
  return normalizedNew
}

function attachmentDir(_relativeFolder: string): string {
  return path.join(getDataPath(), VAULT_FOLDERS.ATTACHMENTS)
}

export async function listAttachments(relativeFolder: string): Promise<AttachmentEntry[]> {
  const dir = attachmentDir(relativeFolder)
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const attachments: AttachmentEntry[] = []
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (entry.name.endsWith('.md')) continue
      const fullPath = path.join(dir, entry.name)
      const stat = await fs.stat(fullPath)
      const rel = relativeFolder
        ? normalizeRelative(path.join(relativeFolder, entry.name))
        : entry.name
      attachments.push({
        name: entry.name,
        path: rel,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      })
    }
    return attachments.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

export async function addAttachment(
  relativeFolder: string,
  sourcePath?: string
): Promise<AttachmentEntry | null> {
  let filePath = sourcePath
  if (!filePath) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null
    filePath = filePaths[0]
  }

  const originalName = path.basename(filePath)
  const ext = path.extname(originalName)
  const base = path.basename(originalName, ext)
  const safeName = `${base}-${uuidv4().slice(0, 8)}${ext}`
  const destDir = attachmentDir(relativeFolder)
  await fs.mkdir(destDir, { recursive: true })
  const destPath = path.join(destDir, safeName)
  await fs.copyFile(filePath, destPath)
  const stat = await fs.stat(destPath)
  const rel = `${VAULT_FOLDERS.ATTACHMENTS}/${safeName}`
  return {
    name: safeName,
    path: rel,
    size: stat.size,
    modified: stat.mtime.toISOString(),
  }
}

export async function deleteAttachment(relativePath: string): Promise<boolean> {
  const fullPath = path.join(getDataPath(), relativePath)
  await fs.unlink(fullPath)
  return true
}

export async function indexAllTags(): Promise<{ tag: string; count: number; paths: string[] }[]> {
  const base = getDataPath()
  const files = await listMarkdownFiles(base, base, { skipHiddenPaths: false })
  const tagMap = new Map<string, string[]>()

  for (const file of files) {
    const filePath = vaultFilePath(file.path)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      // Contact files (and any other "typed" file) are prefixed with a
      // `// type = ... //` marker line, which breaks the frontmatter-tags
      // regex unless stripped first.
      const tags = extractTagsFromContent(stripFileTypeLine(content))
      for (const tag of tags) {
        const existing = tagMap.get(tag) ?? []
        existing.push(file.path)
        tagMap.set(tag, existing)
      }
    } catch {
      // Skip missing or unreadable files (e.g. stale tree entries)
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, paths]) => ({ tag, count: paths.length, paths }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
