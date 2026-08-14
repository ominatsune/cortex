import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export interface ContactMentionContext {
  /** Position of the `@` character */
  atFrom: number
  /** Position where the query text starts (atFrom + 1) */
  queryFrom: number
  /** Current cursor position */
  to: number
  /** Text typed after `@` */
  query: string
}

/**
 * Detect `@query` context at the cursor position.
 *
 * Rules:
 * - `@` must be preceded by a space, newline, or be at the start of a line.
 * - `@` must NOT be preceded by a non-space character (e.g. "mike@" → no trigger).
 * - Once triggered, the query continues until a space, newline, or `@` is hit.
 */
export function getContactMentionContext(
  state: EditorState,
  pos: number
): ContactMentionContext | null {
  const line = state.doc.lineAt(pos)
  const before = state.doc.sliceString(line.from, pos)

  const atIdx = before.lastIndexOf('@')
  if (atIdx < 0) return null

  // Check the character immediately before @
  if (atIdx > 0) {
    const charBefore = before[atIdx - 1]
    if (charBefore !== ' ' && charBefore !== '\t') return null
  }

  const afterAt = before.slice(atIdx + 1)
  // If the query contains a space it means the mention already ended
  if (afterAt.includes(' ') || afterAt.includes('\t')) return null

  return {
    atFrom: line.from + atIdx,
    queryFrom: line.from + atIdx + 1,
    to: pos,
    query: afterAt,
  }
}

export function completeContactMention(
  view: EditorView,
  ctx: ContactMentionContext,
  contactName: string
) {
  const trimmed = contactName.trim()
  if (!trimmed) return
  const insert = `@${trimmed}`
  view.dispatch({
    changes: { from: ctx.atFrom, to: ctx.to, insert },
    selection: { anchor: ctx.atFrom + insert.length },
  })
  view.focus()
}

interface ContactAutocompleteOptions {
  onContextChange: (ctx: ContactMentionContext | null, view: EditorView) => void
}

export function contactAutocompleteExtension(options: ContactAutocompleteOptions) {
  const { onContextChange } = options

  return EditorView.updateListener.of((update) => {
    if (!update.view.hasFocus && !update.docChanged && !update.selectionSet) return

    const view = update.view
    const pos = view.state.selection.main.head
    const ctx = getContactMentionContext(view.state, pos)
    onContextChange(ctx, view)
  })
}
