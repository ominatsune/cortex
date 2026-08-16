import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { preserveEmptyLinesForPreview } from '@cortex/core'
import { toggleTaskAtIndex } from '../utils/note-tasks'
import { splitMarkdownQuoteSegments } from '../utils/markdown-quotes'
import { findContactMentions } from '../utils/contact-mentions'
import { useRef, useMemo, isValidElement, type ReactNode, type ReactElement } from 'react'
import './MarkdownPreview.css'

interface MarkdownPreviewProps {
  content: string
  tags?: string[]
  onWikiLinkClick?: (title: string) => void
  onTaskToggle?: (content: string) => void
  contactNames?: string[]
  onContactClick?: (name: string) => void
}

function wikiUrlTransform(url: string): string {
  if (url.startsWith('wiki://') || url.startsWith('contact://') || url.startsWith('underline://')) return url
  return defaultUrlTransform(url)
}

/** `++text++` -> a markdown link with a custom scheme, the same trick
 *  preprocessWikiLinks uses — no rehype-raw / custom remark plugin needed,
 *  and it rides the existing `allowedElements` allowlist inside blockquotes
 *  for free since `a` is already permitted there. */
function preprocessUnderline(markdown: string): string {
  return markdown.replace(/\+\+(.+?)\+\+/g, (_match, text: string) => {
    return `[${text}](underline://)`
  })
}

function preprocessWikiLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_match, title: string) => {
    const encoded = encodeURIComponent(title.trim())
    return `[${title.trim()}](wiki://${encoded})`
  })
}

function preprocessContactMentions(markdown: string, contactNames: string[]): string {
  if (contactNames.length === 0) return markdown
  const matches = findContactMentions(markdown, contactNames)
  if (matches.length === 0) return markdown
  let result = ''
  let cursor = 0
  for (const match of matches) {
    result += markdown.slice(cursor, match.start)
    const label = markdown.slice(match.start, match.end)
    result += `[${label}](contact://${encodeURIComponent(match.name)})`
    cursor = match.end
  }
  result += markdown.slice(cursor)
  return result
}

function extractText(node: ReactNode): string {
  if (node == null || node === false) return ''
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (isValidElement(node)) {
    return extractText((node as ReactElement<{ children?: ReactNode }>).props.children)
  }
  return ''
}

function CodeBlockPreview({ children }: { children?: ReactNode }) {
  const text = extractText(children).replace(/\n$/, '')
  const lines = text.split('\n')
  if (lines.length === 0) {
    return (
      <div className="preview-code-block">
        <div className="preview-code-line">{'\u00A0'}</div>
      </div>
    )
  }
  return (
    <div className="preview-code-block">
      {lines.map((line, index) => (
        <div key={index} className="preview-code-line">
          {line || '\u00A0'}
        </div>
      ))}
    </div>
  )
}

function QuoteLineContent({
  line,
  components,
}: {
  line: string
  components: Components
}) {
  if (!line.trim()) {
    return <>{'\u00A0'}</>
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={wikiUrlTransform}
      allowedElements={['a', 'strong', 'em', 'del', 'code', 'br']}
      unwrapDisallowed
      components={{
        ...components,
        p: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => <>{children}</>,
      }}
    >
      {line}
    </ReactMarkdown>
  )
}

export default function MarkdownPreview({
  content,
  tags = [],
  onWikiLinkClick,
  onTaskToggle,
  contactNames = [],
  onContactClick,
}: MarkdownPreviewProps) {
  const segments = useMemo(
    () =>
      splitMarkdownQuoteSegments(
        preprocessUnderline(preprocessContactMentions(preprocessWikiLinks(content), contactNames))
      ),
    [content, contactNames]
  )
  const taskIndexRef = useRef(0)
  taskIndexRef.current = 0

  const components = useMemo(
    (): Components => ({
      a: ({ href, children }: { href?: string; children?: ReactNode }) => {
        if (href?.startsWith('wiki://')) {
          const title = decodeURIComponent(href.slice('wiki://'.length))
          return (
            <button
              type="button"
              className="wiki-link"
              onClick={(e) => {
                e.preventDefault()
                onWikiLinkClick?.(title)
              }}
            >
              {children}
            </button>
          )
        }
        if (href?.startsWith('contact://')) {
          const name = decodeURIComponent(href.slice('contact://'.length))
          return (
            <button
              type="button"
              className="contact-mention-link"
              onClick={(e) => {
                e.preventDefault()
                onContactClick?.(name)
              }}
            >
              {children}
            </button>
          )
        }
        if (href?.startsWith('underline://')) {
          return <span className="preview-underline">{children}</span>
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        )
      },
      input: ({ checked, type }: { checked?: boolean; type?: string }) => {
        if (type !== 'checkbox') return <input type={type} checked={checked} readOnly />
        const index = taskIndexRef.current++
        return (
          <input
            type="checkbox"
            className="preview-task-checkbox"
            checked={!!checked}
            onChange={() => onTaskToggle?.(toggleTaskAtIndex(content, index))}
          />
        )
      },
      blockquote: ({ children }: { children?: ReactNode }) => (
        <div className="preview-quote-block">{renderBlockquoteChildren(children)}</div>
      ),
      pre: ({ children }: { children?: ReactNode }) => (
        <CodeBlockPreview>{children}</CodeBlockPreview>
      ),
    }),
    [content, onWikiLinkClick, onTaskToggle, onContactClick]
  )

  return (
    <div className="preview-content">
      {segments.map((segment, segmentIndex) => {
        if (segment.kind === 'quote') {
          return (
            <div key={`quote-${segmentIndex}`} className="preview-quote-block">
              {segment.lines.map((line, lineIndex) => (
                <div key={lineIndex} className="preview-quote-line">
                  <div className="preview-quote-line-content">
                    <QuoteLineContent line={line} components={components} />
                  </div>
                </div>
              ))}
            </div>
          )
        }

        if (!segment.text) return null

        return (
          <ReactMarkdown
            key={`md-${segmentIndex}`}
            remarkPlugins={[remarkGfm, remarkBreaks]}
            urlTransform={wikiUrlTransform}
            components={components}
          >
            {preserveEmptyLinesForPreview(segment.text)}
          </ReactMarkdown>
        )
      })}
      {tags.length > 0 && (
        <div className="note-tags-footer">
          {tags.map((tag) => (
            <span key={tag} className="note-tag-chip">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function renderBlockquoteChildren(children: ReactNode): ReactNode {
  const lines: ReactNode[][] = [[]]

  const append = (node: ReactNode) => {
    lines[lines.length - 1].push(node)
  }

  const walk = (node: ReactNode) => {
    if (node == null || node === false) return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (isValidElement(node)) {
      if (node.type === 'br') {
        lines.push([])
        return
      }
      if (node.type === 'p') {
        walk((node as ReactElement<{ children?: ReactNode }>).props.children)
        return
      }
      append(node)
      return
    }
    if (typeof node === 'string') {
      const parts = node.split('\n')
      parts.forEach((part, index) => {
        if (index > 0) lines.push([])
        if (part) append(part)
      })
    }
  }

  walk(children)

  const rendered = lines
    .filter((line) => line.length > 0)
    .map((line, index) => (
      <div key={index} className="preview-quote-line">
        <div className="preview-quote-line-content">{line}</div>
      </div>
    ))

  if (rendered.length === 0) {
    return (
      <div className="preview-quote-line">
        <div className="preview-quote-line-content">{'\u00A0'}</div>
      </div>
    )
  }

  return rendered
}
