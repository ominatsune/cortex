import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export interface WikiLinkContext {
  linkFrom: number
  queryFrom: number
  to: number
  query: string
}

export function getWikiLinkContext(state: EditorState, pos: number): WikiLinkContext | null {
  const line = state.doc.lineAt(pos)
  const before = state.doc.sliceString(line.from, pos)
  const openIdx = before.lastIndexOf('[[')
  if (openIdx < 0) return null

  const afterOpen = before.slice(openIdx + 2)
  if (afterOpen.includes(']')) return null

  return {
    linkFrom: line.from + openIdx,
    queryFrom: line.from + openIdx + 2,
    to: pos,
    query: afterOpen,
  }
}

export function getCompletedWikiLinkBefore(
  state: EditorState,
  pos: number
): { title: string; from: number; to: number } | null {
  const line = state.doc.lineAt(pos)
  const before = state.doc.sliceString(line.from, pos)
  const match = before.match(/\[\[([^\]]+)\]\]$/)
  if (!match || match.index === undefined) return null
  const title = match[1].trim()
  if (!title) return null
  const from = line.from + match.index
  return { title, from, to: pos }
}

export function completeWikiLink(view: EditorView, ctx: WikiLinkContext, title: string) {
  const trimmed = title.trim()
  if (!trimmed) return
  const insert = `[[${trimmed}]]`
  view.dispatch({
    changes: { from: ctx.linkFrom, to: ctx.to, insert },
    selection: { anchor: ctx.linkFrom + insert.length },
  })
  view.focus()
}

interface WikiLinkExtensionOptions {
  onContextChange: (ctx: WikiLinkContext | null, view: EditorView) => void
  onLinkCompleted: (title: string, view: EditorView) => void
}

export function wikiLinkAutocompleteExtension(options: WikiLinkExtensionOptions) {
  const { onContextChange, onLinkCompleted } = options
  const completedKeys = new Set<string>()

  return EditorView.updateListener.of((update) => {
    if (!update.view.hasFocus && !update.docChanged && !update.selectionSet) return

    const view = update.view
    const pos = view.state.selection.main.head
    const ctx = getWikiLinkContext(view.state, pos)
    onContextChange(ctx, view)

    if (!update.docChanged) return

    const completed = getCompletedWikiLinkBefore(view.state, pos)
    if (!completed) return

    const key = `${completed.from}:${completed.title}`
    if (completedKeys.has(key)) return
    completedKeys.add(key)
    onLinkCompleted(completed.title, view)
  })
}

export function resetWikiLinkCompletionCache() {
  // exported for tests; cache is per-extension instance
}
