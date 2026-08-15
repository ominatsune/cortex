import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import {
  extractNoteTitle,
  findWikiLinks,
} from '@cortex/core'
import { stripTagsBlock } from '../utils/note-tags'
import { resolveWikiLinkPath, wikiLinkTitleMatches } from '../utils/wiki-links'
import './LinksPanel.css'

interface ResolvedLink {
  title: string
  path: string | null
}

interface LinksPanelProps {
  selectedPath: string | null
  noteContent: string
  refreshKey: number
  onOpenNote: (path: string, name: string, opts?: { fromLink?: boolean }) => void
  onError: (msg: string) => void
}


export default function LinksPanel({
  selectedPath,
  noteContent,
  refreshKey,
  onOpenNote,
  onError,
}: LinksPanelProps) {
  const [linksFrom, setLinksFrom] = useState<ResolvedLink[]>([])
  const [linksTo, setLinksTo] = useState<{ title: string; path: string }[]>([])
  const [loading, setLoading] = useState(false)

  const loadLinks = useCallback(async () => {
    if (!selectedPath) {
      setLinksFrom([])
      setLinksTo([])
      return
    }

    setLoading(true)
    try {
      const [notesFiles, diaryFiles] = await Promise.all([
        window.cortex.storage.listFiles('notes'),
        window.cortex.storage.listFiles('diary'),
      ])
      const files = [...notesFiles, ...diaryFiles]
      const titleIndex = new Map<string, { path: string; title: string }>()

      for (const file of files) {
        try {
          const raw = await window.cortex.storage.readFile(file.path)
          const { body } = stripTagsBlock(raw)
          const title = extractNoteTitle(body)
          titleIndex.set(file.path, { path: file.path, title })
        } catch {
          // skip unreadable files
        }
      }

      const resolveTitle = async (linkTitle: string): Promise<string | null> =>
        resolveWikiLinkPath(linkTitle, files, (path) => window.cortex.storage.readFile(path))

      const fromTitles = findWikiLinks(noteContent)
      const resolvedFrom = await Promise.all(
        fromTitles.map(async (title) => ({
          title,
          path: await resolveTitle(title),
        }))
      )
      setLinksFrom(resolvedFrom)

      const currentEntry = titleIndex.get(selectedPath)
      const currentTitle = currentEntry?.title ?? extractNoteTitle(noteContent)
      const currentBase = selectedPath.split('/').pop()?.replace(/\.md$/, '') ?? ''

      const backlinks: { title: string; path: string }[] = []
      for (const [path, { title }] of titleIndex) {
        if (path === selectedPath) continue
        try {
          const raw = await window.cortex.storage.readFile(path)
          const { body } = stripTagsBlock(raw)
          const outgoing = findWikiLinks(body)
          if (outgoing.some((link) => wikiLinkTitleMatches(link, currentTitle, currentBase))) {
            backlinks.push({ title, path })
          }
        } catch {
          // skip
        }
      }

      backlinks.sort((a, b) => a.title.localeCompare(b.title))
      setLinksTo(backlinks)
    } catch {
      onError('Failed to load links')
      setLinksFrom([])
      setLinksTo([])
    } finally {
      setLoading(false)
    }
  }, [selectedPath, noteContent, onError])

  useEffect(() => {
    void loadLinks()
  }, [loadLinks, refreshKey])

  const openLink = (path: string, title: string) => {
    onOpenNote(path, title, { fromLink: true })
  }

  if (!selectedPath) {
    return (
      <div className="links-panel">
        <div className="links-panel-empty">Open a note to see its links</div>
      </div>
    )
  }

  return (
    <div className="links-panel">
      <section className="links-section">
        <h3 className="links-section-title">
          <ArrowRight size={14} />
          Links from this file
        </h3>
        {loading && linksFrom.length === 0 ? (
          <div className="links-panel-muted">Loading…</div>
        ) : linksFrom.length === 0 ? (
          <div className="links-panel-muted">No outgoing wiki links</div>
        ) : (
          <ul className="links-list">
            {linksFrom.map(({ title, path }) => (
              <li key={title}>
                {path ? (
                  <button
                    type="button"
                    className="links-item resolved"
                    onClick={() => openLink(path, title)}
                  >
                    {title}
                  </button>
                ) : (
                  <span className="links-item unresolved">{title}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="links-section">
        <h3 className="links-section-title">
          <ArrowLeft size={14} />
          Links to this file
        </h3>
        {loading && linksTo.length === 0 ? (
          <div className="links-panel-muted">Loading…</div>
        ) : linksTo.length === 0 ? (
          <div className="links-panel-muted">No notes link here yet</div>
        ) : (
          <ul className="links-list">
            {linksTo.map(({ title, path }) => (
              <li key={path}>
                <button
                  type="button"
                  className="links-item resolved"
                  onClick={() => openLink(path, title)}
                >
                  {title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
