import { Plus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './EventLinkSection.css'

export interface EventLinkOption {
  value: string
  label: string
}

interface EventLinkSectionProps {
  title: string
  icon: LucideIcon
  chips: { key: string; label: string }[]
  available: EventLinkOption[]
  picked: string
  onPickedChange: (value: string) => void
  onAdd: () => void
  onRemove: (key: string) => void
  onChipClick?: (key: string) => void
  emptyLabel: string
  addPlaceholder: string
  /** Hides remove buttons and the add-row — for viewing an already-saved
   *  event without risking an accidental edit. Editable (the default) when
   *  building up links before the thing being linked even exists yet, e.g.
   *  the create-event form. */
  readOnly?: boolean
}

export default function EventLinkSection({
  title,
  icon: Icon,
  chips,
  available,
  picked,
  onPickedChange,
  onAdd,
  onRemove,
  onChipClick,
  emptyLabel,
  addPlaceholder,
  readOnly = false,
}: EventLinkSectionProps) {
  return (
    <div className="event-link-section">
      <h3 className="event-link-title"><Icon size={13} /> {title}</h3>
      <div className="event-link-chips">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className={`event-link-chip ${onChipClick ? '' : 'static'}`}
            onClick={onChipClick ? () => onChipClick(chip.key) : undefined}
          >
            {chip.label}
            {!readOnly && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(chip.key) }}
                aria-label={`Remove ${chip.label}`}
              >
                <X size={10} />
              </button>
            )}
          </span>
        ))}
        {chips.length === 0 && <span className="event-link-empty">{emptyLabel}</span>}
      </div>
      {!readOnly && available.length > 0 && (
        <div className="event-link-add-row">
          <select value={picked} onChange={(e) => onPickedChange(e.target.value)}>
            <option value="">{addPlaceholder}</option>
            {available.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button type="button" onClick={onAdd} disabled={!picked}><Plus size={14} /></button>
        </div>
      )}
    </div>
  )
}
