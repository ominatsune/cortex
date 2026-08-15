import { StickyNote, BookOpen, Users, Sun, Moon, FolderOpen, FolderX } from 'lucide-react'
import { VAULT_FOLDERS } from '@cortex/core'
import FileBrowser from './FileBrowser'
import ContactsList from './ContactsList'
import TagLegend from './TagLegend'
import AppLogo from './AppLogo'
import { useTheme } from '../context/ThemeContext'
import type { AppZone, Contact } from '../types'
import './LeftPanel.css'

interface LeftPanelProps {
  zone: AppZone
  onZoneChange: (zone: AppZone) => void
  selectedPath: string | null
  onSelectPath: (path: string, name: string, opts?: { isNew?: boolean }) => void
  onGoToVaultRoot: () => void
  onCloseOpenFile: () => void
  selectedContact: Contact | null
  onSelectContact: (contact: Contact | null) => void
  activeTag: string | null
  onTagSelect: (tag: string | null) => void
  refreshKey: number
  onRefresh: () => void
  onError: (msg: string) => void
  vaultName: string | null
  onCloseVault: () => void
}

const ZONES: { id: AppZone; label: string; icon: typeof StickyNote }[] = [
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'contacts', label: 'Contacts', icon: Users },
]

export default function LeftPanel({
  zone,
  onZoneChange,
  selectedPath,
  onSelectPath,
  onGoToVaultRoot,
  onCloseOpenFile,
  selectedContact,
  onSelectContact,
  activeTag,
  onTagSelect,
  refreshKey,
  onRefresh,
  onError,
  vaultName,
  onCloseVault,
}: LeftPanelProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <aside className="left-panel">
      <div className="left-panel-header">
        <div className="app-logo-row">
          <AppLogo variant="mark" size="md" />
          <span className="app-logo-label">Cortex</span>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className="app-zone">
        <div className="app-zone-label">Application</div>
        <div className="app-zone-tabs">
          {ZONES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`zone-tab ${zone === id ? 'active' : ''}`}
              onClick={() => onZoneChange(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="browser-zone">
        {zone === 'contacts' ? (
          <ContactsList
            selected={selectedContact}
            onSelect={onSelectContact}
            refreshKey={refreshKey}
            onRefresh={onRefresh}
            onError={onError}
            activeTag={activeTag}
          />
        ) : (
          <FileBrowser
            zone={zone}
            selectedPath={selectedPath}
            vaultName={vaultName}
            onSelect={onSelectPath}
            onGoToVaultRoot={onGoToVaultRoot}
            onCloseOpenFile={onCloseOpenFile}
            onRefresh={onRefresh}
            refreshKey={refreshKey}
            tagFilter={activeTag}
            onError={onError}
          />
        )}
      </div>

      <TagLegend activeTag={activeTag} onTagSelect={onTagSelect} refreshKey={refreshKey} />

      <div className="vault-footer">
        <div className="vault-footer-info">
          <FolderOpen size={14} className="vault-footer-icon" />
          <span className="vault-footer-name">{vaultName ?? 'Vault'}</span>
        </div>
        <button className="vault-action-btn" onClick={onCloseVault} title="Close vault">
          <FolderX size={13} />
          Close vault
        </button>
      </div>
    </aside>
  )
}

export { VAULT_FOLDERS }
