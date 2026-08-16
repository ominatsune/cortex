import type { EditorView } from '@codemirror/view'
import { Transaction } from '@codemirror/state'
import type { MarkdownAction } from './markdown'

const WRAP_INSERTS: Partial<Record<MarkdownAction, { open: string; close: string }>> = {
  bold: { open: '**', close: '**' },
  italic: { open: '*', close: '*' },
  strikethrough: { open: '~~', close: '~~' },
  underline: { open: '++', close: '++' },
  code: { open: '`', close: '`' },
  link: { open: '[', close: ']()' },
  image: { open: '![', close: ']()' },
  wiki: { open: '[[', close: ']]' },
  codeblock: { open: '```\n', close: '\n```' },
}

const LINE_TOGGLES: Partial<Record<MarkdownAction, { prefix: string; strip: RegExp }>> = {
  h1: { prefix: '# ', strip: /^#{1,6}\s*/ },
  h2: { prefix: '## ', strip: /^#{1,6}\s*/ },
  h3: { prefix: '### ', strip: /^#{1,6}\s*/ },
  h4: { prefix: '#### ', strip: /^#{1,6}\s*/ },
  h5: { prefix: '##### ', strip: /^#{1,6}\s*/ },
  h6: { prefix: '###### ', strip: /^#{1,6}\s*/ },
  quote: { prefix: '> ', strip: /^>\s*/ },
  ul: { prefix: '- ', strip: /^(\s*)[-*+]\s*/ },
  ol: { prefix: '1. ', strip: /^(\s*)\d+\.\s*/ },
  task: { prefix: '- [ ] ', strip: /^(\s*)- \[[ x]\]\s*/ },
}

const INSERT_ACTIONS: Partial<Record<MarkdownAction, string>> = {
  hr: '\n---\n',
  table: '\n| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n',
}

export class MarkdownToggleController {
  private onChange?: (active: Set<MarkdownAction>) => void

  constructor(onChange?: (active: Set<MarkdownAction>) => void) {
    this.onChange = onChange
  }

  getActive(): Set<MarkdownAction> {
    return new Set()
  }

  isActive(_action: MarkdownAction): boolean {
    return false
  }

  toggle(view: EditorView, action: MarkdownAction): void {
    if (action in INSERT_ACTIONS) {
      this.insertAtCursor(view, INSERT_ACTIONS[action]!)
      return
    }

    if (action in LINE_TOGGLES) {
      this.toggleLinePrefix(view, action)
      return
    }

    if (action in WRAP_INSERTS) {
      this.insertWrap(view, action)
    }
  }

  private notify(): void {
    this.onChange?.(new Set())
  }

  private insertAtCursor(view: EditorView, text: string): void {
    const pos = view.state.selection.main.from
    view.dispatch({
      changes: { from: pos, to: pos, insert: text },
      selection: { anchor: pos + text.length },
    })
    view.focus()
    this.notify()
  }

  private insertWrap(view: EditorView, action: MarkdownAction): void {
    const cfg = WRAP_INSERTS[action]
    if (!cfg) return

    const { from, to } = view.state.selection.main
    const selected = from !== to ? view.state.sliceDoc(from, to) : ''

    if (selected) {
      const insert = cfg.open + selected + cfg.close
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
        annotations:
          action === 'codeblock' ? Transaction.userEvent.of('fence.toggle') : undefined,
      })
    } else {
      const insert = cfg.open + cfg.close
      view.dispatch({
        changes: { from, to: from, insert },
        selection: { anchor: from + cfg.open.length },
        annotations:
          action === 'codeblock' ? Transaction.userEvent.of('fence.toggle') : undefined,
      })
    }

    view.focus()
    this.notify()
  }

  private toggleLinePrefix(view: EditorView, action: MarkdownAction): void {
    const cfg = LINE_TOGGLES[action]
    if (!cfg) return

    const { state } = view
    const sel = state.selection.main
    const startLine = state.doc.lineAt(sel.from)
    const endLine = state.doc.lineAt(sel.to)

    const lines = []
    for (let n = startLine.number; n <= endLine.number; n++) {
      lines.push(state.doc.line(n))
    }

    const stripGeneric = (text: string): string =>
      text
        .replace(/^(\s*)/, '')
        .replace(/^#{1,6}\s*/, '')
        .replace(/^>\s*/, '')
        .replace(/^[-*+]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/^- \[[ x]\]\s*/, '')

    const hasExactPrefix = (text: string, indent: string): boolean =>
      text.slice(indent.length).startsWith(cfg.prefix)

    // Notion/Google-Docs-style toggle semantics: only treat this as "turn it
    // off" when every selected line already has exactly this prefix (e.g. all
    // already H2). Otherwise — nothing selected has it, or lines are at mixed
    // or different levels — apply this prefix to every line, converting them
    // all to the same level rather than stripping based on "has *a* heading."
    const allAlreadyThisPrefix = lines.every((line) => {
      const indent = line.text.match(/^(\s*)/)?.[1] ?? ''
      return hasExactPrefix(line.text, indent)
    })

    const changes = lines.map((line) => {
      const text = line.text
      const indent = text.match(/^(\s*)/)?.[1] ?? ''
      if (allAlreadyThisPrefix) {
        const m = text.match(cfg.strip)
        const stripped = m
          ? m[1] !== undefined
            ? m[1] + text.slice(m[0].length)
            : text.slice(m[0].length)
          : text
        return { from: line.from, to: line.to, insert: stripped }
      }
      const stripped = stripGeneric(text)
      return { from: line.from, to: line.to, insert: indent + cfg.prefix + stripped }
    })

    // Map the original selection through the edit so it stays put — clicking
    // another heading level right after keeps the same lines selected instead
    // of collapsing to a single cursor.
    const changeSet = state.changes(changes)
    const newAnchor = changeSet.mapPos(sel.anchor)
    const newHead = changeSet.mapPos(sel.head)

    view.dispatch({
      changes,
      selection: { anchor: newAnchor, head: newHead },
    })

    view.focus()
    this.notify()
  }
}

export const MARKDOWN_KEYBINDS: { key: string; action: MarkdownAction }[] = [
  { key: 'Mod-b', action: 'bold' },
  { key: 'Mod-i', action: 'italic' },
  { key: 'Mod-Shift-x', action: 'strikethrough' },
  { key: 'Mod-u', action: 'underline' },
  { key: 'Mod-e', action: 'code' },
  { key: 'Mod-k', action: 'link' },
  { key: 'Mod-Shift-h', action: 'h1' },
  { key: 'Mod-Shift-8', action: 'quote' },
  { key: 'Mod-[', action: 'wiki' },
]
