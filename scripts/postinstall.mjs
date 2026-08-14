import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const electronDir = path.join(root, 'node_modules', 'electron')
const pathFile = path.join(electronDir, 'path.txt')
const platformPath = 'Electron.app/Contents/MacOS/Electron'
const electronBinary = path.join(electronDir, 'dist', platformPath)

function electronReady() {
  return fs.existsSync(electronBinary) && fs.existsSync(pathFile)
}

try {
  if (!electronReady()) {
    execSync('node install.js', { cwd: electronDir, stdio: 'inherit' })
  }

  // install.js writes a trailing newline; electron/index.js doesn't trim it
  if (fs.existsSync(pathFile)) {
    fs.writeFileSync(pathFile, platformPath)
  }
} catch (err) {
  console.warn('Electron postinstall warning:', err)
}
