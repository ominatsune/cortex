import { useState, useEffect, useCallback } from 'react'
import { Tag } from 'lucide-react'
import type { TagIndex } from '../types'
import './TagLegend.css'

interface TagLegendProps {
  activeTag: string | null
  onTagSelect: (tag: string | null) => void
  refreshKey: number
  variant?: 'sidebar' | 'panel'
}

export default function TagLegend({
  activeTag,
  onTagSelect,
  refreshKey,
  variant = 'sidebar',
}: TagLegendProps) {
  const [tags, setTags] = useState<TagIndex[]>([])

  const loadTags = useCallback(async () => {
    try {
      const data = await window.cortex.tags.index()
      setTags(data)
    } catch {
      setTags([])
    }
  }, [])

  useEffect(() => {
    loadTags()
  }, [loadTags, refreshKey])

  return (
    <div className={`tag-legend ${variant === 'panel' ? 'tag-legend-panel' : ''}`}>
      <div className="tag-legend-header">
        <Tag size={14} />
        <span>Tags</span>
        {activeTag && (
          <button className="tag-clear" onClick={() => onTagSelect(null)}>Clear</button>
        )}
      </div>
      <div className="tag-list">
        {tags.map(({ tag, count }) => (
          <button
            key={tag}
            className={`tag-chip ${activeTag === tag ? 'active' : ''}`}
            onClick={() => onTagSelect(activeTag === tag ? null : tag)}
          >
            #{tag}
            <span className="tag-count">{count}</span>
          </button>
        ))}
        {tags.length === 0 && (
          <div className="tag-empty">Use #tags in notes to categorize</div>
        )}
      </div>
    </div>
  )
}
