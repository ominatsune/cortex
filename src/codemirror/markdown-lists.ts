import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'

const TASK_RE = /^(\s*)- \[([ x])\] (.*)$/
const UL_RE = /^(\s*)([-*+]) (.*)$/
const OL_RE = /^(\s*)(\d+)\. (.*)$/

function continueListOnEnter(view: EditorView): boolean {
  const { state } = view
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  const text = line.text

  const task = text.match(TASK_RE)
  if (task) {
    const indent = task[1]
    const content = task[3]
    if (content.trim() === '') {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: indent },
        selection: { anchor: line.from + indent.length },
      })
      return true
    }
    const insert = `\n${indent}- [ ] `
    view.dispatch({
      changes: { from: line.to, insert },
      selection: { anchor: line.to + insert.length },
    })
    return true
  }

  const ul = text.match(UL_RE)
  if (ul) {
    const indent = ul[1]
    const marker = ul[2]
    const content = ul[3]
    if (content.trim() === '') {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: indent },
        selection: { anchor: line.from + indent.length },
      })
      return true
    }
    const insert = `\n${indent}${marker} `
    view.dispatch({
      changes: { from: line.to, insert },
      selection: { anchor: line.to + insert.length },
    })
    return true
  }

  const ol = text.match(OL_RE)
  if (ol) {
    const indent = ol[1]
    const num = parseInt(ol[2], 10)
    const content = ol[3]
    if (content.trim() === '') {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: indent },
        selection: { anchor: line.from + indent.length },
      })
      return true
    }
    const insert = `\n${indent}${num + 1}. `
    view.dispatch({
      changes: { from: line.to, insert },
      selection: { anchor: line.to + insert.length },
    })
    return true
  }

  return false
}

export function listContinuationExtension() {
  return Prec.high(
    keymap.of([
      {
        key: 'Enter',
        run: continueListOnEnter,
      },
    ])
  )
}
