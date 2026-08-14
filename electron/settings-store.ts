import type { ThemeMode } from '@cortex/core'
import { VAULT_FOLDERS } from '@cortex/core'
import fs from 'fs/promises'
import path from 'path'
import { getVaultPath, isVaultConfigured } from './vault-manager'

const DEFAULT_THEME: ThemeMode = 'dark'

function settingsPath(): string {
  return path.join(getVaultPath(), VAULT_FOLDERS.SETTINGS, 'preferences.md')
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    result[key] = value
  }
  return result
}

function updateFrontmatter(raw: string, updates: Record<string, string>): string {
  const match = raw.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/)
  if (!match) {
    const lines = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join('\n')
    return `---\n${lines}\n---\n`
  }
  const fm = parseFrontmatter(raw)
  Object.assign(fm, updates)
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')
  return `---\n${lines}\n---${match[2]}`
}

async function readSettingsFile(): Promise<string> {
  const file = settingsPath()
  try {
    return await fs.readFile(file, 'utf-8')
  } catch {
    const content = `---\ntheme: ${DEFAULT_THEME}\n---\n\n# Cortex Settings\n`
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content, 'utf-8')
    return content
  }
}

export async function getTheme(): Promise<ThemeMode> {
  if (!isVaultConfigured()) return DEFAULT_THEME
  const raw = await readSettingsFile()
  const fm = parseFrontmatter(raw)
  return fm.theme === 'light' ? 'light' : 'dark'
}

export async function setTheme(theme: ThemeMode): Promise<void> {
  const raw = await readSettingsFile()
  const updated = updateFrontmatter(raw, { theme })
  await fs.writeFile(settingsPath(), updated, 'utf-8')
}
