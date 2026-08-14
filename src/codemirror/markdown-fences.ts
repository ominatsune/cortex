import { EditorView } from '@codemirror/view'
import { Transaction } from '@codemirror/state'

const FENCE_ONLY_LINE_RE = /^(`{3,}|~{3,})$/

function maybeOpenFenceBlock(
  view: EditorView,
  update: { transactions: readonly Transaction[] }
) {
  if (!update.transactions.some((tr) => tr.docChanged && tr.isUserEvent('input.type'))) return
  if (
    update.transactions.some(
      (tr) => tr.isUserEvent('fence.autoNewline') || tr.isUserEvent('fence.toggle')
    )
  ) {
    return
  }

  for (const tr of update.transactions) {
    if (!tr.docChanged) continue
    tr.changes.iterChanges((_fromA, _toA, fromB, _toB, inserted) => {
      if (!inserted.toString().includes('`') && !inserted.toString().includes('~')) return
      const line = tr.newDoc.lineAt(fromB)
      const fenceMatch = line.text.match(FENCE_ONLY_LINE_RE)
      if (!fenceMatch) return
      if (fromB !== line.to) return

      const fence = fenceMatch[1]
      view.dispatch({
        changes: { from: line.to, insert: `\n\n${fence}` },
        selection: { anchor: line.to + 1 },
        annotations: Transaction.userEvent.of('fence.autoNewline'),
      })
    })
  }
}

export function fenceEditorExtension() {
  return EditorView.updateListener.of((update) => {
    maybeOpenFenceBlock(update.view, update)
  })
}
