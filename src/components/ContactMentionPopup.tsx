import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import './WikiLinkPopup.css'

export interface ContactOption {
  id: string
  name: string
}

interface ContactMentionPopupProps {
  query: string
  options: ContactOption[]
  loading: boolean
  coords: { top: number; left: number; bottom: number } | null
  onSelect: (option: ContactOption) => void
}

export function filterContactOptions(
  contacts: ContactOption[],
  query: string
): ContactOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return contacts.slice(0, 12)
  return contacts.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 12)
}

export default function ContactMentionPopup({
  query,
  options,
  loading,
  coords,
  onSelect,
}: ContactMentionPopupProps) {
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    setHighlight(0)
  }, [query, options.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (options.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setHighlight((h) => Math.min(h + 1, options.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setHighlight((h) => Math.max(h - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onSelect(options[highlight])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onSelect({ id: '', name: '' }) // signal dismiss
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [highlight, options, onSelect])

  if (!coords) return null

  return (
    <div
      className="wiki-link-popup"
      style={{
        top: coords.top - 8,
        left: coords.left,
        transform: 'translateY(-100%)',
      }}
    >
      {loading && options.length === 0 ? (
        <div className="wiki-link-popup-empty">Loading contacts…</div>
      ) : options.length === 0 ? (
        <div className="wiki-link-popup-empty">No matching contacts</div>
      ) : (
        options.map((opt, i) => (
          <button
            key={opt.id}
            type="button"
            className={`wiki-link-popup-item ${i === highlight ? 'active' : ''}`}
            onMouseEnter={() => setHighlight(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(opt)
            }}
          >
            <User size={14} className="wiki-link-popup-icon" />
            <span className="wiki-link-popup-label">{opt.name}</span>
          </button>
        ))
      )}
    </div>
  )
}
