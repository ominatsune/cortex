import { app, BrowserWindow, ipcMain, dialog, nativeImage, nativeTheme } from 'electron'
import { defaultDiaryContent, resolveDiaryPath, VAULT_FOLDERS } from '@cortex/core'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { setApplicationMenu } from './app-menu'
import {
  getDataPath,
  buildNotesTree,
  buildDiaryTree,
  listMarkdownFiles,
  createFolder,
  createNote,
  deletePath,
  renamePath,
  syncNoteFilename,
  createNoteWithTitle,
  movePath,
  readVaultFile,
  writeVaultFile,
  listAttachments,
  addAttachment,
  deleteAttachment,
  indexAllTags,
} from './storage'
import {
  listStoredEvents,
  createStoredEvent,
  updateStoredEvent,
  deleteStoredEvent,
  getEventByRelativePath,
} from './calendar-store'
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  getContactByRelativePath,
} from './contacts-store'
import {
  initVault,
  getVaultStatus,
  createVaultAt,
  openVaultAt,
  pickParentDirectory,
  pickExistingVault,
  resolveCloudBasePath,
  isVaultConfigured,
  closeVault,
} from './vault-manager'
import { getTheme, setTheme } from './settings-store'
import type { CloudProvider } from '@cortex/core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveAppIconPath(): string {
  const macIconCandidates =
    process.platform === 'darwin'
      ? [
          ...(nativeTheme.shouldUseDarkColors
            ? [
                path.join(__dirname, '../dist/macos-app-icon-dark.png'),
                path.join(__dirname, '../public/macos-app-icon-dark.png'),
              ]
            : []),
          path.join(__dirname, '../dist/macos-app-icon.png'),
          path.join(__dirname, '../public/macos-app-icon.png'),
        ]
      : []
  const candidates = [
    ...macIconCandidates,
    path.join(__dirname, '../dist/cortex-icon.png'),
    path.join(__dirname, '../public/cortex-icon.png'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[1]
}

function updateMacAppIcon() {
  if (process.platform !== 'darwin' || !app.dock) return
  app.dock.setIcon(nativeImage.createFromPath(resolveAppIconPath()))
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const iconPath = resolveAppIconPath()
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 650,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1a1a1f',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await initVault()
  setApplicationMenu()
  updateMacAppIcon()
  nativeTheme.on('updated', updateMacAppIcon)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function requireVault() {
  if (!isVaultConfigured()) {
    throw new Error('No vault configured')
  }
}

// --- Vault ---

ipcMain.handle('vault:getStatus', () => getVaultStatus())

ipcMain.handle('vault:createNew', async (_, parentPath: string, vaultName: string) => {
  await createVaultAt(parentPath, vaultName)
  return getVaultStatus()
})

ipcMain.handle('vault:openExisting', async (_, defaultPath?: string) => {
  const selected = await pickExistingVault(defaultPath)
  if (!selected) return null
  await openVaultAt(selected)
  return getVaultStatus()
})

ipcMain.handle('vault:pickParentDirectory', async (_, defaultPath?: string) => {
  return pickParentDirectory(defaultPath)
})

ipcMain.handle('vault:getCloudBasePath', async (_, provider: CloudProvider) => {
  return resolveCloudBasePath(provider)
})

ipcMain.handle('vault:close', async () => {
  await closeVault()
  return getVaultStatus()
})

// --- Settings ---

ipcMain.handle('settings:getTheme', async () => {
  if (!isVaultConfigured()) return 'dark'
  return getTheme()
})

ipcMain.handle('settings:setTheme', async (_, theme: 'light' | 'dark') => {
  requireVault()
  await setTheme(theme)
  return true
})

// --- Storage ---

ipcMain.handle('storage:getDataPath', () => {
  requireVault()
  return getDataPath()
})

ipcMain.handle('storage:getVaultTree', async (_, zone?: 'notes' | 'diary') => {
  requireVault()
  const basePath = getDataPath()
  if (zone === 'diary') {
    return buildDiaryTree(basePath)
  }
  return buildNotesTree(basePath)
})

ipcMain.handle('storage:getTree', async (_, section: 'notes' | 'diary') => {
  requireVault()
  const basePath = getDataPath()
  if (section === 'diary') {
    return buildDiaryTree(basePath)
  }
  return buildNotesTree(basePath)
})

ipcMain.handle('storage:listFiles', async (_, section: 'notes' | 'diary') => {
  requireVault()
  const basePath = getDataPath()
  if (section === 'diary') {
    const dir = path.join(basePath, VAULT_FOLDERS.DIARY)
    const files = await listMarkdownFiles(dir, basePath)
    return files.sort((a, b) => b.name.localeCompare(a.name))
  }
  const files = await listMarkdownFiles(basePath, basePath)
  return files.sort((a, b) => a.name.localeCompare(b.name))
})

ipcMain.handle('storage:readFile', async (_, relativePath: string) => {
  requireVault()
  return readVaultFile(relativePath)
})

ipcMain.handle('storage:writeFile', async (_, relativePath: string, content: string) => {
  requireVault()
  try {
    await writeVaultFile(relativePath, content)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`writeFile(${relativePath}): ${message}`)
  }
})

ipcMain.handle('storage:deleteFile', async (_, relativePath: string) => {
  requireVault()
  return deletePath(relativePath)
})

ipcMain.handle('storage:createNote', async (_, folder?: string) => {
  requireVault()
  return createNote(folder ?? '')
})

ipcMain.handle('storage:createNoteWithTitle', async (_, folder: string, title: string) => {
  requireVault()
  return createNoteWithTitle(folder ?? '', title)
})

ipcMain.handle('storage:movePath', async (_, fromPath: string, toFolder: string) => {
  requireVault()
  return movePath(fromPath, toFolder)
})

ipcMain.handle('storage:syncNoteFilename', async (_, notePath: string, content: string) => {
  requireVault()
  return syncNoteFilename(notePath, content)
})

ipcMain.handle('storage:createFolder', async (_, folderPath: string) => {
  requireVault()
  return createFolder(folderPath)
})

ipcMain.handle('storage:rename', async (_, oldPath: string, newPath: string) => {
  requireVault()
  return renamePath(oldPath, newPath)
})

async function openDiaryEntry(dateStr: string): Promise<string> {
  const relativePath = resolveDiaryPath(dateStr)
  const fullPath = path.join(getDataPath(), relativePath)
  try {
    await fs.access(fullPath)
  } catch {
    const content = defaultDiaryContent(dateStr)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')
  }
  return relativePath
}

ipcMain.handle('storage:listDiaryDates', async () => {
  requireVault()
  const basePath = getDataPath()
  const diaryDir = path.join(basePath, VAULT_FOLDERS.DIARY)
  const dates: string[] = []
  try {
    const years = await fs.readdir(diaryDir, { withFileTypes: true })
    for (const year of years) {
      if (!year.isDirectory()) continue
      const yearDir = path.join(diaryDir, year.name)
      const files = await fs.readdir(yearDir)
      for (const file of files) {
        const m = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/)
        if (m) dates.push(m[1])
      }
    }
  } catch {
    // diary dir may not exist yet
  }
  return dates
})

ipcMain.handle('storage:openDiaryEntry', async (_, dateStr: string) => {
  requireVault()
  return openDiaryEntry(dateStr)
})

ipcMain.handle('storage:getDiaryPath', async (_, dateStr: string) => {
  requireVault()
  return openDiaryEntry(dateStr)
})

// --- Attachments ---

ipcMain.handle('attachments:list', async (_, relativeFolder: string) => {
  requireVault()
  return listAttachments(relativeFolder)
})

ipcMain.handle('attachments:add', async (_, relativeFolder: string) => {
  requireVault()
  return addAttachment(relativeFolder)
})

ipcMain.handle('attachments:delete', async (_, relativePath: string) => {
  requireVault()
  return deleteAttachment(relativePath)
})

// --- Tags ---

ipcMain.handle('tags:index', async () => {
  requireVault()
  try {
    return await indexAllTags()
  } catch {
    return []
  }
})

// --- Calendar ---

ipcMain.handle('calendar:listEvents', async (_, start: string, end: string) => {
  requireVault()
  return listStoredEvents(start, end)
})

ipcMain.handle('calendar:createEvent', async (_, event: Parameters<typeof createStoredEvent>[0]) => {
  requireVault()
  return createStoredEvent(event)
})

ipcMain.handle('calendar:updateEvent', async (_, id: string, updates: Parameters<typeof updateStoredEvent>[1]) => {
  requireVault()
  return updateStoredEvent(id, updates)
})

ipcMain.handle('calendar:deleteEvent', async (_, id: string) => {
  requireVault()
  return deleteStoredEvent(id)
})

// --- Contacts ---

ipcMain.handle('contacts:list', () => {
  requireVault()
  return listContacts()
})

ipcMain.handle('contacts:create', async (_, contact: Parameters<typeof createContact>[0]) => {
  requireVault()
  return createContact(contact)
})

ipcMain.handle('contacts:update', async (_, id: string, updates: Parameters<typeof updateContact>[1]) => {
  requireVault()
  return updateContact(id, updates)
})

ipcMain.handle('contacts:delete', async (_, id: string) => {
  requireVault()
  return deleteContact(id)
})

ipcMain.handle('contacts:getByPath', async (_, relativePath: string) => {
  requireVault()
  return getContactByRelativePath(relativePath)
})

ipcMain.handle('calendar:getByPath', async (_, relativePath: string) => {
  requireVault()
  return getEventByRelativePath(relativePath)
})

// --- PDF Export ---

ipcMain.handle('export:pdf', async (_, html: string, defaultName: string) => {
  requireVault()
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: `${defaultName}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return null

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true },
  })

  await pdfWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  )

  const pdfData = await pdfWindow.webContents.printToPDF({
    printBackground: true,
    margins: { marginType: 'default' },
  })

  pdfWindow.close()
  await fs.writeFile(filePath, pdfData)
  return filePath
})
