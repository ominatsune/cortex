import { useEffect, useRef, useState } from 'react'
import { Hash, Plus, X } from 'lucide-react'
import './TagsPopup.css'

interface TagsPopupProps {
  tags: string[]
  onApply: (tags: string[]) => void
  onClose: () => void
}

export default function TagsPopup({ tags, onApply, onClose }: TagsPopupProps) {
  const [draft, setDraft] = useState<string[]>(tags)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [onClose])

  const addTag = (raw: string) => {
    const tag = raw.toLowerCase().replace(/^#/, '').trim()
    if (!tag || draft.includes(tag)) return
    setDraft((prev) => [...prev, tag].sort())
    setInput('')
  }

  const removeTag = (tag: string) => {
    setDraft((prev) => prev.filter((t) => t !== tag))
  }

  const handleSubmit = () => {
    let final = draft
    const pending = input.toLowerCase().replace(/^#/, '').trim()
    if (pending && !final.includes(pending)) {
      final = [...final, pending].sort()
    }
    onApply(final)
    onClose()
  }

  return (
    <div className="tags-popup-backdrop">
      <div className="tags-popup" ref={panelRef}>
        <div className="tags-popup-header">
          <Hash size={14} />
          <span>Tags</span>
          <button type="button" className="tags-popup-close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="tags-popup-chips">
          {draft.map((tag) => (
            <span key={tag} className="tags-popup-chip">
              #{tag}
              <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                <X size={10} />
              </button>
            </span>
          ))}
          {draft.length === 0 && <span className="tags-popup-empty">No tags yet</span>}
        </div>
        <div className="tags-popup-input-row">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add tag…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (input.trim()) addTag(input)
                else handleSubmit()
              }
            }}
          />
          <button type="button" className="tags-popup-add" onClick={() => addTag(input)} disabled={!input.trim()}>
            <Plus size={14} />
          </button>
        </div>
        <button type="button" className="btn btn-primary tags-popup-save" onClick={handleSubmit}>
          Apply tags
        </button>
      </div>
    </div>
  )
}
