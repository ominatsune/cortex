import { useEffect, useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import { sanitizeNoteName } from '@cortex/core'
import { filterWikiLinkFiles, formatNotePathLabel } from '../utils/wiki-links'
import './WikiLinkPopup.css'

export interface WikiLinkOption {
  name: string
  path: string
  pathLabel: string
  isNew?: boolean
}

interface WikiLinkPopupProps {
  query: string
  options: WikiLinkOption[]
  loading: boolean
  coords: { top: number; left: number; bottom: number } | null
  onSelect: (option: WikiLinkOption) => void
}

export function buildWikiLinkOptions(
  files: { name: string; path: string }[],
  query: string
): WikiLinkOption[] {
  const trimmed = query.trim()
  const matched = filterWikiLinkFiles(files, query).slice(0, 12)

  const fileOptions = matched.map((f) => ({
    name: f.name,
    path: f.path,
    pathLabel: formatNotePathLabel(f.path),
  }))

  if (!trimmed) return fileOptions

  const exists = files.some(
    (f) => sanitizeNoteName(f.name).toLowerCase() === sanitizeNoteName(trimmed).toLowerCase()
  )
  if (exists) return fileOptions

  return [{ name: trimmed, path: '', pathLabel: '', isNew: true }, ...fileOptions]
}

export default function WikiLinkPopup({
  query,
  options,
  loading,
  coords,
  onSelect,
}: WikiLinkPopupProps) {
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
        <div className="wiki-link-popup-empty">Loading notes…</div>
      ) : options.length === 0 ? (
        <div className="wiki-link-popup-empty">Type a note name</div>
      ) : (
        options.map((opt, i) => (
          <button
            key={opt.isNew ? `new:${opt.name}` : opt.path}
            type="button"
            className={`wiki-link-popup-item ${i === highlight ? 'active' : ''}`}
            onMouseEnter={() => setHighlight(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(opt)
            }}
          >
            {opt.isNew ? (
              <>
                <Plus size={14} className="wiki-link-popup-icon create" />
                <span>Create &ldquo;{opt.name}&rdquo;</span>
              </>
            ) : (
              <>
                <FileText size={14} className="wiki-link-popup-icon" />
                <span className="wiki-link-popup-label">{opt.pathLabel}</span>
              </>
            )}
          </button>
        ))
      )}
    </div>
  )
}
