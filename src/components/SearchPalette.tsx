import { useEffect, useRef, useState } from 'react'
import { Search, StickyNote, BookOpen, User, CalendarDays, Tag as TagIcon } from 'lucide-react'
import { useSearch } from '../hooks/useSearch'
import type { SearchResult, SearchResultType } from '../types'
import './SearchPalette.css'

const TYPE_LABEL: Record<SearchResultType, string> = {
  note: 'Notes',
  diary: 'Diary',
  contact: 'Contacts',
  calendar: 'Calendar',
  tag: 'Tags',
}

const TYPE_ICON: Record<SearchResultType, typeof Search> = {
  note: StickyNote,
  diary: BookOpen,
  contact: User,
  calendar: CalendarDays,
  tag: TagIcon,
}

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
  onResultSelect: (result: SearchResult) => void
}

export default function SearchPalette({ open, onClose, onResultSelect }: SearchPaletteProps) {
  const { query, setQuery, results, loading } = useSearch()
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHighlight(0)
  }, [results])

  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open, setQuery])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (results.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => Math.min(h + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => Math.max(h - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        select(results[highlight])
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, results, highlight])

  if (!open) return null

  function select(result: SearchResult) {
    onResultSelect(result)
    onClose()
  }

  let runningIndex = -1

  return (
    <div className="modal-overlay search-palette-overlay" onMouseDown={onClose}>
      <div className="search-palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-palette-input-row">
          <Search size={16} className="search-palette-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Search notes, diary, contacts, calendar, tags…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="search-palette-results">
          {query.trim().length === 0 ? (
            <div className="search-palette-empty">Type to search your vault</div>
          ) : loading && results.length === 0 ? (
            <div className="search-palette-empty">Searching…</div>
          ) : results.length === 0 ? (
            <div className="search-palette-empty">No matches</div>
          ) : (
            (Object.keys(TYPE_LABEL) as SearchResultType[]).map((type) => {
              const items = results.filter((r) => r.type === type)
              if (items.length === 0) return null
              const Icon = TYPE_ICON[type]
              return (
                <div key={type} className="search-palette-group">
                  <div className="search-palette-group-label">{TYPE_LABEL[type]}</div>
                  {items.map((item) => {
                    runningIndex += 1
                    const index = runningIndex
                    return (
                      <button
                        key={`${type}:${item.path ?? item.title}`}
                        type="button"
                        className={`search-palette-item ${index === highlight ? 'active' : ''}`}
                        onMouseEnter={() => setHighlight(index)}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          select(item)
                        }}
                      >
                        <Icon size={15} className="search-palette-item-icon" />
                        <div className="search-palette-item-text">
                          <span className="search-palette-item-title">{item.title}</span>
                          {item.subtitle && (
                            <span className="search-palette-item-subtitle">{item.subtitle}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
