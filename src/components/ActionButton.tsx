interface ActionButtonProps {
  main: string
  sub: string
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
  title?: string
}

/** Two-line stacked action button ("CLOSE" / "NOTE") matching ModeToggle's
 *  segment look, for the action row's right-side Close/Delete pair and the
 *  center-cluster Back button. */
export default function ActionButton({ main, sub, onClick, variant = 'default', disabled, title }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`action-btn ${variant === 'danger' ? 'danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title ?? `${main} ${sub}`}
    >
      <span className="action-btn-main">{main}</span>
      <span className="action-btn-sub">{sub}</span>
    </button>
  )
}
