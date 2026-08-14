import { useState } from 'react'
import { FolderOpen, Cloud, HardDrive, ChevronLeft } from 'lucide-react'
import type { CloudProvider } from '@cortex/core'
import AppLogo from './AppLogo'
import './VaultSetup.css'

interface VaultSetupProps {
  onComplete: () => void
  onError: (msg: string) => void
}

type Step =
  | 'choose'
  | 'cloud-provider'
  | 'vault-name'
  | null

type VaultAction = 'create-local' | 'open-local' | 'create-cloud' | 'open-cloud'

const CLOUD_PROVIDERS: { id: CloudProvider; label: string }[] = [
  { id: 'icloud', label: 'iCloud Drive' },
  { id: 'google-drive', label: 'Google Drive' },
  { id: 'onedrive', label: 'OneDrive' },
  { id: 'dropbox', label: 'Dropbox' },
]

export default function VaultSetup({ onComplete, onError }: VaultSetupProps) {
  const [step, setStep] = useState<Step>('choose')
  const [action, setAction] = useState<VaultAction | null>(null)
  const [cloudProvider, setCloudProvider] = useState<CloudProvider | null>(null)
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [vaultName, setVaultName] = useState('')
  const [loading, setLoading] = useState(false)

  const isCloud = action === 'create-cloud' || action === 'open-cloud'
  const isCreate = action === 'create-local' || action === 'create-cloud'

  const handleChoose = async (chosen: VaultAction) => {
    setAction(chosen)
    if (chosen === 'create-local' || chosen === 'open-local') {
      if (chosen === 'open-local') {
        setLoading(true)
        try {
          const status = await window.cortex.vault.openExisting()
          if (status) onComplete()
        } catch {
          onError('Failed to open vault')
        } finally {
          setLoading(false)
        }
        return
      }
      setLoading(true)
      try {
        const dir = await window.cortex.vault.pickParentDirectory()
        if (dir) {
          setParentPath(dir)
          setStep('vault-name')
        }
      } catch {
        onError('Failed to pick directory')
      } finally {
        setLoading(false)
      }
      return
    }
    setStep('cloud-provider')
  }

  const handleCloudProvider = async (provider: CloudProvider) => {
    setCloudProvider(provider)
    setLoading(true)
    try {
      const basePath = await window.cortex.vault.getCloudBasePath(provider)
      if (action === 'open-cloud') {
        const status = await window.cortex.vault.openExisting(basePath)
        if (status) onComplete()
        return
      }
      const dir = await window.cortex.vault.pickParentDirectory(basePath)
      if (dir) {
        setParentPath(dir)
        setStep('vault-name')
      }
    } catch {
      onError('Failed to access cloud storage location')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVault = async () => {
    if (!parentPath || !vaultName.trim()) return
    setLoading(true)
    try {
      await window.cortex.vault.createNew(parentPath, vaultName.trim())
      onComplete()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create vault')
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (step === 'vault-name') {
      setStep(isCloud ? 'cloud-provider' : 'choose')
      setParentPath(null)
      setVaultName('')
      return
    }
    if (step === 'cloud-provider') {
      setStep('choose')
      setAction(null)
      setCloudProvider(null)
      return
    }
  }

  return (
    <div className="vault-setup">
      <div className="vault-setup-card">
        <div className="vault-setup-logo">
          <AppLogo variant="full" size="xl" />
        </div>
        <p className="vault-setup-subtitle">Select a vault to get started</p>

        {step === 'choose' && (
          <div className="vault-options">
            <section className="vault-option-group">
              <h2><HardDrive size={16} /> Local</h2>
              <button className="vault-option-btn" onClick={() => handleChoose('create-local')} disabled={loading}>
                <FolderOpen size={18} />
                <span>Create a new vault</span>
              </button>
              <button className="vault-option-btn" onClick={() => handleChoose('open-local')} disabled={loading}>
                <FolderOpen size={18} />
                <span>Open an existing vault</span>
              </button>
            </section>
            <section className="vault-option-group">
              <h2><Cloud size={16} /> Cloud storage</h2>
              <button className="vault-option-btn" onClick={() => handleChoose('create-cloud')} disabled={loading}>
                <Cloud size={18} />
                <span>Create a new vault</span>
              </button>
              <button className="vault-option-btn" onClick={() => handleChoose('open-cloud')} disabled={loading}>
                <Cloud size={18} />
                <span>Open an existing vault</span>
              </button>
            </section>
          </div>
        )}

        {step === 'cloud-provider' && (
          <div className="vault-cloud-step">
            <button className="vault-back-btn" onClick={goBack}>
              <ChevronLeft size={16} /> Back
            </button>
            <h2>Choose cloud storage</h2>
            <div className="vault-cloud-list">
              {CLOUD_PROVIDERS.map(({ id, label }) => (
                <button
                  key={id}
                  className="vault-option-btn"
                  onClick={() => handleCloudProvider(id)}
                  disabled={loading}
                >
                  <Cloud size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'vault-name' && isCreate && (
          <div className="vault-name-step">
            <button className="vault-back-btn" onClick={goBack}>
              <ChevronLeft size={16} /> Back
            </button>
            <h2>Name your vault</h2>
            {parentPath && (
              <p className="vault-parent-path">Location: {parentPath}</p>
            )}
            {isCloud && cloudProvider && (
              <p className="vault-parent-path">Cloud: {CLOUD_PROVIDERS.find((p) => p.id === cloudProvider)?.label}</p>
            )}
            <input
              className="vault-name-input"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="My Cortex Vault"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateVault()}
            />
            <button
              className="btn btn-primary vault-create-btn"
              onClick={handleCreateVault}
              disabled={!vaultName.trim() || loading}
            >
              Create vault
            </button>
          </div>
        )}

        {loading && <p className="vault-loading">Working…</p>}
      </div>
    </div>
  )
}
