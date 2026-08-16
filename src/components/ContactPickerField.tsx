import { useState, useMemo } from 'react'
import { User, Plus, X } from 'lucide-react'
import type { Contact } from '../types'
import { filterContactOptions } from './ContactMentionPopup'
import './ContactPickerField.css'

interface ContactPickerFieldProps {
  label: string
  linkedContacts: Contact[]
  allContacts: Contact[]
  onAdd: (contact: Contact) => void
  onRemove: (id: string) => void
  onCreate: (name: string) => Promise<Contact | null>
  onChipClick?: (contact: Contact) => void
  readOnly?: boolean
}

/** Search-as-you-type contact linking with inline "Create <name>" for
 *  contacts that don't exist yet — shared by the New Event form and the
 *  existing-event detail view so both support adding brand-new contacts,
 *  not just picking from a fixed dropdown of ones that already exist. */
export default function ContactPickerField({
  label,
  linkedContacts,
  allContacts,
  onAdd,
  onRemove,
  onCreate,
  onChipClick,
  readOnly,
}: ContactPickerFieldProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const available = allContacts
      .filter((c) => !linkedContacts.some((l) => l.id === c.id))
      .map((c) => ({ id: c.id, name: c.name }))
    return filterContactOptions(available, query)
  }, [allContacts, linkedContacts, query])

  const exactMatch = allContacts.some((c) => c.name.toLowerCase() === query.trim().toLowerCase())

  const handleCreate = async () => {
    const name = query.trim()
    if (!name) return
    const created = await onCreate(name)
    if (created) setQuery('')
  }

  return (
    <div className="form-group contact-picker">
      <label>{label}</label>
      {linkedContacts.length > 0 && (
        <div className="contact-picker-chips">
          {linkedContacts.map((c) => (
            <span
              key={c.id}
              className={`contact-picker-chip ${onChipClick ? 'clickable' : ''}`}
              onClick={onChipClick ? () => onChipClick(c) : undefined}
            >
              {c.name}
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(c.id) }}
                  aria-label={`Remove ${c.name}`}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {readOnly ? (
        linkedContacts.length === 0 && <span className="contact-picker-empty">No contacts linked</span>
      ) : (
        <>
          <input
            value={query}
            placeholder="Search contacts or type a name…"
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim() && matches.length === 0) {
                e.preventDefault()
                void handleCreate()
              }
            }}
          />
          {open && query.trim() && (
            <div className="contact-picker-dropdown">
              {matches.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="contact-picker-option"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const contact = allContacts.find((c) => c.id === opt.id)
                    if (contact) { onAdd(contact); setQuery('') }
                  }}
                >
                  <User size={13} />
                  {opt.name}
                </button>
              ))}
              {!exactMatch && (
                <button
                  type="button"
                  className="contact-picker-option contact-picker-create"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    void handleCreate()
                  }}
                >
                  <Plus size={13} />
                  Create &ldquo;{query.trim()}&rdquo;
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
