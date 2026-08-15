import { app, dialog } from 'electron'
import { execFile } from 'child_process'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { VAULT_FOLDERS, type CloudProvider } from '@cortex/core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VAULT_MARKER_FILE = 'vault.cortex'
const VAULT_FOLDER_ICON_FILE = 'folder-icon.png'

const CONFIG_FILE = 'cortex-config.json'

interface AppConfig {
  vaultPath: string | null
}

let activeVaultPath: string | null = null

async function configPath(): Promise<string> {
  return path.join(app.getPath('userData'), CONFIG_FILE)
}

async function readConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(await configPath(), 'utf-8')
    return JSON.parse(raw) as AppConfig
  } catch {
    return { vaultPath: null }
  }
}

async function writeConfig(config: AppConfig): Promise<void> {
  await fs.writeFile(await configPath(), JSON.stringify(config, null, 2), 'utf-8')
}

export async function initVault(): Promise<string | null> {
  const config = await readConfig()
  if (!config.vaultPath) {
    activeVaultPath = null
    return null
  }

  // Check the vault directory still exists — user may have deleted it externally
  try {
    const stat = await fs.stat(config.vaultPath)
    if (!stat.isDirectory()) {
      throw new Error('Not a directory')
    }
  } catch {
    // Vault folder is gone — clear the saved path so the setup screen appears
    await writeConfig({ vaultPath: null })
    activeVaultPath = null
    return null
  }

  // Reinstate any minimum folders (notes/, diary/, etc.), the vault marker,
  // and the folder icon if they were deleted externally since last launch.
  await ensureVaultFolders(config.vaultPath)

  activeVaultPath = config.vaultPath
  return activeVaultPath
}

export function getVaultPath(): string {
  if (!activeVaultPath) {
    throw new Error('No vault configured')
  }
  return activeVaultPath
}

export function isVaultConfigured(): boolean {
  return activeVaultPath !== null
}

export function getVaultStatus(): { configured: boolean; path: string | null; name: string | null } {
  if (!activeVaultPath) {
    return { configured: false, path: null, name: null }
  }
  return {
    configured: true,
    path: activeVaultPath,
    name: path.basename(activeVaultPath),
  }
}

export async function setActiveVault(vaultRoot: string): Promise<void> {
  activeVaultPath = vaultRoot
  await writeConfig({ vaultPath: vaultRoot })
}

export async function closeVault(): Promise<void> {
  activeVaultPath = null
  await writeConfig({ vaultPath: null })
}

export async function createVaultStructure(vaultRoot: string): Promise<void> {
  const settingsDir = path.join(vaultRoot, VAULT_FOLDERS.SETTINGS)
  await Promise.all([
    fs.mkdir(path.join(vaultRoot, VAULT_FOLDERS.CONTACTS), { recursive: true }),
    fs.mkdir(path.join(vaultRoot, VAULT_FOLDERS.DIARY), { recursive: true }),
    fs.mkdir(path.join(vaultRoot, VAULT_FOLDERS.NOTES), { recursive: true }),
    fs.mkdir(path.join(vaultRoot, VAULT_FOLDERS.ATTACHMENTS), { recursive: true }),
    fs.mkdir(path.join(vaultRoot, VAULT_FOLDERS.CALENDAR), { recursive: true }),
    fs.mkdir(settingsDir, { recursive: true }),
  ])

  const settingsFile = path.join(settingsDir, 'preferences.md')
  try {
    await fs.access(settingsFile)
  } catch {
    await fs.writeFile(
      settingsFile,
      '---\ntheme: dark\n---\n\n# Cortex Settings\n\nPreferences for this vault. Edit freely — everything here is plain markdown.\n',
      'utf-8'
    )
  }

  await writeVaultMarker(settingsDir, path.basename(vaultRoot))
  const iconPath = await writeVaultFolderIcon(settingsDir)
  // Fire-and-forget: never let icon-setting slow down or fail vault setup.
  if (iconPath) applyMacFolderIcon(vaultRoot, iconPath)
}

/** Marks a directory as a Cortex vault. Written once — never overwritten, so
 *  the original creation date survives re-opening the vault later. */
async function writeVaultMarker(settingsDir: string, vaultName: string): Promise<void> {
  const markerPath = path.join(settingsDir, VAULT_MARKER_FILE)
  try {
    await fs.access(markerPath)
    return
  } catch {
    const creationDate = new Date().toISOString().slice(0, 10)
    const contents = `cortex.vault {\n    vault.name = '${vaultName}',\n    creation.date = '${creationDate}',\n}\n`
    await fs.writeFile(markerPath, contents, 'utf-8')
  }
}

function resolveBundledIconPath(): string | null {
  const candidates = [
    path.join(__dirname, '../dist/macos-app-icon-dark.png'),
    path.join(__dirname, '../public/macos-app-icon-dark.png'),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

/** Drops a copy of the app icon into the vault's settings folder — the
 *  source used both as a reference and (on macOS) as the vault's actual
 *  Finder folder icon. Written once, like the marker file. */
async function writeVaultFolderIcon(settingsDir: string): Promise<string | null> {
  const iconPath = path.join(settingsDir, VAULT_FOLDER_ICON_FILE)
  try {
    await fs.access(iconPath)
    return iconPath
  } catch {
    const source = resolveBundledIconPath()
    if (!source) return null
    await fs.copyFile(source, iconPath)
    return iconPath
  }
}

/** Sets `vaultRoot`'s Finder icon (macOS only) to the standard macOS folder
 *  shape with the app icon badged in the center — the same look Obsidian
 *  uses for its vault folders, not a full icon replacement. Best-effort and
 *  non-blocking — never awaited by callers, and failures are swallowed. */
function applyMacFolderIcon(vaultRoot: string, iconPath: string): void {
  if (process.platform !== 'darwin') return

  const script = `
    ObjC.import('Cocoa');
    function run(argv) {
      const iconPath = argv[0];
      const targetPath = argv[1];

      const badge = $.NSImage.alloc.initWithContentsOfFile(iconPath);
      const folder = $.NSImage.imageNamed('NSFolder');
      if (!badge || !folder) return;

      const canvasSize = $.NSMakeSize(1024, 1024);
      const composite = $.NSImage.alloc.initWithSize(canvasSize);

      composite.lockFocus;

      const SourceOver = 2;
      folder.drawInRectFromRectOperationFraction(
        $.NSMakeRect(0, 0, canvasSize.width, canvasSize.height),
        $.NSMakeRect(0, 0, folder.size.width, folder.size.height),
        SourceOver,
        1.0
      );

      // Badge the app icon centered in the folder body, a bit smaller than
      // the folder itself and nudged down slightly to sit clear of the tab.
      const badgeSize = canvasSize.width * 0.5;
      const badgeX = (canvasSize.width - badgeSize) / 2;
      const badgeY = (canvasSize.height - badgeSize) / 2 - canvasSize.height * 0.04;
      badge.drawInRectFromRectOperationFraction(
        $.NSMakeRect(badgeX, badgeY, badgeSize, badgeSize),
        $.NSMakeRect(0, 0, badge.size.width, badge.size.height),
        SourceOver,
        1.0
      );

      composite.unlockFocus;

      $.NSWorkspace.sharedWorkspace.setIconForFileOptions(composite, targetPath, 0);
    }
  `

  execFile('osascript', ['-l', 'JavaScript', '-e', script, iconPath, vaultRoot], (error) => {
    if (error) {
      console.warn('Failed to set vault folder icon:', error.message)
      return
    }
    // Setting a custom folder icon creates a companion "Icon\r" file inside
    // the folder to hold the icon data — normal macOS behavior, but it's
    // meant to stay invisible. Finder usually hides it itself when the icon
    // is set through its own UI; doing it via NSWorkspace doesn't, so hide
    // it explicitly or it shows up as a stray "Icon?" file.
    const iconFilePath = path.join(vaultRoot, 'Icon\r')
    execFile('chflags', ['hidden', iconFilePath], (hideError) => {
      if (hideError) console.warn('Failed to hide Icon\\r file:', hideError.message)
    })
  })
}

export async function ensureVaultFolders(vaultRoot: string): Promise<void> {
  await createVaultStructure(vaultRoot)
}

export async function createVaultAt(parentPath: string, vaultName: string): Promise<string> {
  const safeName = vaultName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'Cortex Vault'
  const vaultRoot = path.join(parentPath, safeName)
  try {
    await fs.mkdir(vaultRoot, { recursive: false })
  } catch {
    throw new Error('A vault with this name already exists in this location')
  }
  await createVaultStructure(vaultRoot)
  await setActiveVault(vaultRoot)
  return vaultRoot
}

export async function openVaultAt(vaultRoot: string): Promise<void> {
  const stat = await fs.stat(vaultRoot)
  if (!stat.isDirectory()) throw new Error('Selected path is not a directory')
  await ensureVaultFolders(vaultRoot)
  await setActiveVault(vaultRoot)
}

export function resolveCloudBasePath(provider: CloudProvider): string {
  const home = os.homedir()
  const platform = process.platform

  switch (provider) {
    case 'icloud':
      if (platform === 'darwin') {
        return path.join(home, 'Library/Mobile Documents/com~apple~CloudDocs')
      }
      if (platform === 'win32') {
        return path.join(home, 'iCloudDrive')
      }
      return home
    case 'google-drive':
      if (platform === 'darwin') {
        return path.join(home, 'Library/CloudStorage')
      }
      return path.join(home, 'Google Drive')
    case 'onedrive':
      if (platform === 'win32') {
        return path.join(home, 'OneDrive')
      }
      if (platform === 'darwin') {
        return path.join(home, 'Library/CloudStorage')
      }
      return path.join(home, 'OneDrive')
    case 'dropbox':
      return path.join(home, 'Dropbox')
    default:
      return home
  }
}

export async function pickParentDirectory(defaultPath?: string): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    defaultPath: defaultPath ?? os.homedir(),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
}

export async function pickExistingVault(defaultPath?: string): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    defaultPath: defaultPath ?? os.homedir(),
    properties: ['openDirectory'],
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
}
