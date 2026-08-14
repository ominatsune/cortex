import type { EditorMode } from '../types'
import './ModeToggle.css'

interface ModeToggleProps {
  mode: EditorMode
  onChange: (mode: EditorMode) => void
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle" role="group" aria-label="Editor mode">
      <button
        type="button"
        className={`mode-toggle-segment ${mode === 'read' ? 'active' : ''}`}
        onClick={() => onChange('read')}
      >
        <span className="mode-toggle-main">READ</span>
        <span className="mode-toggle-sub">MODE</span>
      </button>
      <span className="mode-toggle-divider" aria-hidden="true" />
      <button
        type="button"
        className={`mode-toggle-segment ${mode === 'edit' ? 'active' : ''}`}
        onClick={() => onChange('edit')}
      >
        <span className="mode-toggle-main">EDIT</span>
        <span className="mode-toggle-sub">MODE</span>
      </button>
    </div>
  )
}
