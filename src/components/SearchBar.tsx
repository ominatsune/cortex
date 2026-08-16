import { useEffect, useRef, useState } from 'react'
import { Search, X, StickyNote, BookOpen, User, CalendarDays, Tag as TagIcon } from 'lucide-react'
import { useSearch } from '../hooks/useSearch'
import type { SearchResult, SearchResultType } from '../types'
import './SearchBar.css'

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

interface SearchBarProps {
  onResultSelect: (result: SearchResult) => void
}

export default function SearchBar({ onResultSelect }: SearchBarProps) {
  const { query, setQuery, results, loading } = useSearch()
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHighlight(0)
  }, [results])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
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

  function select(result: SearchResult) {
    onResultSelect(result)
    // Deliberately keep the query — opening a result shouldn't end the
    // search session. Clicking back into the bar re-shows the same results
    // so the user can jump straight to another match without retyping.
    setOpen(false)
  }

  function clear() {
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const showDropdown = open && query.trim().length > 0

  let runningIndex = -1

  return (
    <div className="search-bar" ref={containerRef}>
      <div className="search-bar-input-row">
        <Search size={14} className="search-bar-icon" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search vault…"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        {query && (
          <button
            type="button"
            className="search-bar-clear"
            title="Clear search"
            onMouseDown={(e) => {
              e.preventDefault()
              clear()
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="search-bar-dropdown">
          {loading && results.length === 0 ? (
            <div className="search-bar-empty">Searching…</div>
          ) : results.length === 0 ? (
            <div className="search-bar-empty">No matches</div>
          ) : (
            (Object.keys(TYPE_LABEL) as SearchResultType[]).map((type) => {
              const items = results.filter((r) => r.type === type)
              if (items.length === 0) return null
              const Icon = TYPE_ICON[type]
              return (
                <div key={type} className="search-bar-group">
                  <div className="search-bar-group-label">{TYPE_LABEL[type]}</div>
                  {items.map((item) => {
                    runningIndex += 1
                    const index = runningIndex
                    return (
                      <button
                        key={`${type}:${item.path ?? item.title}`}
                        type="button"
                        className={`search-bar-item ${index === highlight ? 'active' : ''}`}
                        onMouseEnter={() => setHighlight(index)}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          select(item)
                        }}
                      >
                        <Icon size={14} className="search-bar-item-icon" />
                        <div className="search-bar-item-text">
                          <span className="search-bar-item-title">{item.title}</span>
                          {item.subtitle && <span className="search-bar-item-subtitle">{item.subtitle}</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
