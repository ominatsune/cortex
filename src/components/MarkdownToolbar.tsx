import {
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  Bold, Italic, Strikethrough, Underline, Code, Quote, List, ListOrdered,
  CheckSquare, Link, Image, Minus, Table, FileCode, Braces,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { MarkdownAction } from '../utils/markdown'
import './MarkdownToolbar.css'

interface MarkdownToolbarProps {
  onAction: (action: MarkdownAction) => void
  activeActions?: MarkdownAction[]
  disabled?: boolean
  /** Extra buttons hugging the right edge alongside the Image action —
   *  Attachment/PDF export aren't MarkdownActions (no toggleable markdown
   *  syntax), so they're passed in as ready-made JSX rather than living in
   *  TOOL_GROUPS. */
  trailingContent?: ReactNode
  /** Rendered immediately to the left of the Image button — the Tags
   *  ("Manage tags") action, which like Attachment/PDF isn't a MarkdownAction. */
  beforeImage?: ReactNode
}

type ToolAction = { action: MarkdownAction; icon: typeof Bold; title: string; shortcut?: string }

const TOOL_GROUPS: { actions: ToolAction[] }[] = [
  {
    actions: [
      { action: 'h1', icon: Heading1, title: 'Heading 1', shortcut: '⌘⇧H' },
      { action: 'h2', icon: Heading2, title: 'Heading 2' },
      { action: 'h3', icon: Heading3, title: 'Heading 3' },
      { action: 'h4', icon: Heading4, title: 'Heading 4' },
      { action: 'h5', icon: Heading5, title: 'Heading 5' },
      { action: 'h6', icon: Heading6, title: 'Heading 6' },
    ],
  },
  {
    actions: [
      { action: 'bold', icon: Bold, title: 'Bold', shortcut: '⌘B' },
      { action: 'italic', icon: Italic, title: 'Italic', shortcut: '⌘I' },
      { action: 'strikethrough', icon: Strikethrough, title: 'Strikethrough', shortcut: '⌘⇧X' },
      { action: 'underline', icon: Underline, title: 'Underline', shortcut: '⌘U' },
      { action: 'code', icon: Code, title: 'Inline code', shortcut: '⌘E' },
      { action: 'codeblock', icon: FileCode, title: 'Code block' },
    ],
  },
  {
    actions: [
      { action: 'quote', icon: Quote, title: 'Blockquote', shortcut: '⌘⇧8' },
      { action: 'ul', icon: List, title: 'Bullet list' },
      { action: 'ol', icon: ListOrdered, title: 'Numbered list' },
      { action: 'task', icon: CheckSquare, title: 'Task list' },
    ],
  },
  {
    actions: [
      { action: 'link', icon: Link, title: 'Link', shortcut: '⌘K' },
      { action: 'wiki', icon: Braces, title: 'Wiki link', shortcut: '⌘[' },
      { action: 'hr', icon: Minus, title: 'Horizontal rule' },
      { action: 'table', icon: Table, title: 'Table' },
    ],
  },
]

const IMAGE_ACTION: ToolAction = { action: 'image', icon: Image, title: 'Image' }

export default function MarkdownToolbar({ onAction, activeActions = [], disabled, trailingContent, beforeImage }: MarkdownToolbarProps) {
  const activeSet = new Set(activeActions)

  const renderButton = ({ action, icon: Icon, title, shortcut }: ToolAction) => (
    <button
      key={action}
      className={`md-toolbar-btn ${activeSet.has(action) ? 'active' : ''}`}
      title={shortcut ? `${title} (${shortcut})` : title}
      disabled={disabled}
      onClick={() => onAction(action)}
    >
      <Icon size={15} />
    </button>
  )

  return (
    <div className="md-toolbar">
      {TOOL_GROUPS.map((group, gi) => (
        <div key={gi} className="md-toolbar-group">
          {group.actions.map(renderButton)}
        </div>
      ))}
      <div className="md-toolbar-group md-toolbar-right">
        {beforeImage}
        {renderButton(IMAGE_ACTION)}
        {trailingContent}
      </div>
    </div>
  )
}
