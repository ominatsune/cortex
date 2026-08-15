import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import { taskLineIndentClass } from '../utils/note-tasks'
import { computeLazyQuoteLineNumbers } from '../utils/markdown-quotes'
import { findContactMentions } from '../utils/contact-mentions'

/** Dispatch to update the set of known contact names used to highlight `@mentions`. */
export const setContactNamesEffect = StateEffect.define<string[]>()

export const contactNamesField = StateField.define<string[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setContactNamesEffect)) return effect.value
    }
    return value
  },
})

interface FenceBlock {
  openFrom: number
  openTo: number
  closeFrom: number
  closeTo: number
  fenceLen: number
  unclosed: boolean
}

class TaskCheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super()
  }

  eq(other: TaskCheckboxWidget): boolean {
    return other.checked === this.checked
  }

  toDOM(): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = 'cm-lp-task-checkbox'
    input.tabIndex = -1
    return input
  }

  ignoreEvent(): boolean {
    return false
  }
}

function cursorInEditZone(
  cursor: number,
  fullFrom: number,
  fullTo: number,
  openLen: number,
  closeLen: number
): boolean {
  const contentFrom = fullFrom + openLen
  const contentTo = fullTo - closeLen
  if (cursor >= fullFrom && cursor < contentFrom) return true
  if (cursor >= contentFrom && cursor <= contentTo) return true
  if (cursor >= contentTo && cursor < fullTo) return true
  return false
}

function cursorOnLine(cursor: number, lineFrom: number, lineTo: number): boolean {
  return cursor >= lineFrom && cursor <= lineTo
}

/** Collects decorations and applies them in sorted order (required by CodeMirror). */
class DecoQueue {
  private items: { from: number; to: number; value: Decoration }[] = []

  add(from: number, to: number, value: Decoration) {
    this.items.push({ from, to, value })
  }

  addHidden(from: number, to: number) {
    if (from < to) this.add(from, to, Decoration.mark({ class: 'cm-lp-hidden' }))
  }

  addSyntax(from: number, to: number, className: string) {
    if (from < to) this.add(from, to, Decoration.mark({ class: className }))
  }

  addPreview(from: number, to: number, className: string) {
    if (from < to) this.add(from, to, Decoration.mark({ class: className }))
  }

  addLineClass(lineFrom: number, className: string) {
    this.add(lineFrom, lineFrom, Decoration.line({ class: className }))
  }

  finish(): DecorationSet {
    this.items.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from
      return a.value.startSide - b.value.startSide
    })
    const builder = new RangeSetBuilder<Decoration>()
    for (const item of this.items) {
      builder.add(item.from, item.to, item.value)
    }
    try {
      return builder.finish()
    } catch {
      return Decoration.none
    }
  }
}

function addHidden(queue: DecoQueue, from: number, to: number) {
  queue.addHidden(from, to)
}

function addSyntax(queue: DecoQueue, from: number, to: number, className: string) {
  queue.addSyntax(from, to, className)
}

function addPreview(queue: DecoQueue, from: number, to: number, className: string) {
  queue.addPreview(from, to, className)
}

function addLineClass(queue: DecoQueue, lineFrom: number, className: string) {
  queue.addLineClass(lineFrom, className)
}

function decorateWrapToken(
  queue: DecoQueue,
  fullFrom: number,
  fullTo: number,
  cursor: number,
  openLen: number,
  closeLen: number,
  openClass: string,
  closeClass: string,
  previewClass: string
) {
  const contentFrom = fullFrom + openLen
  const contentTo = fullTo - closeLen
  const isEmpty = contentTo <= contentFrom

  if (isEmpty) {
    if (cursorInEditZone(cursor, fullFrom, fullTo, openLen, closeLen)) {
      addSyntax(queue, fullFrom, contentFrom, openClass)
      addSyntax(queue, contentTo, fullTo, closeClass)
    } else {
      addHidden(queue, fullFrom, fullTo)
    }
    return
  }

  if (cursorInEditZone(cursor, fullFrom, fullTo, openLen, closeLen)) {
    addSyntax(queue, fullFrom, contentFrom, openClass)
    addSyntax(queue, contentTo, fullTo, closeClass)
  } else {
    addHidden(queue, fullFrom, contentFrom)
    addPreview(queue, contentFrom, contentTo, previewClass)
    addHidden(queue, contentTo, fullTo)
  }
}

function findFenceBlocks(doc: EditorView['state']['doc']): FenceBlock[] {
  const blocks: FenceBlock[] = []
  const fenceRe = /^(`{3,}|~{3,})(.*)$/
  let i = 1
  while (i <= doc.lines) {
    const openLine = doc.line(i)
    const openMatch = openLine.text.match(fenceRe)
    if (!openMatch) {
      i++
      continue
    }
    const fence = openMatch[1]
    const fenceLen = fence.length
    let j = i + 1
    let closeLine = openLine
    while (j <= doc.lines) {
      const line = doc.line(j)
      if (line.text.startsWith(fence)) {
        closeLine = line
        break
      }
      j++
    }
    if (closeLine.number !== openLine.number) {
      blocks.push({
        openFrom: openLine.from,
        openTo: openLine.to,
        closeFrom: closeLine.from,
        closeTo: closeLine.to,
        fenceLen,
        unclosed: false,
      })
      i = closeLine.number + 1
    } else {
      blocks.push({
        openFrom: openLine.from,
        openTo: openLine.to,
        closeFrom: doc.length,
        closeTo: doc.length,
        fenceLen,
        unclosed: true,
      })
      i++
    }
  }
  return blocks
}

function cursorInFenceEditZone(cursor: number, block: FenceBlock, doc: EditorView['state']['doc']): boolean {
  const openLine = doc.lineAt(block.openFrom)

  if (block.unclosed) {
    return cursor >= block.openFrom
  }

  const closeLine = doc.lineAt(block.closeFrom)

  if (openLine.number === closeLine.number) {
    const fenceEnd = block.openFrom + block.fenceLen
    return cursor >= block.openFrom && cursor < fenceEnd
  }

  if (cursor >= block.openFrom && cursor <= block.openTo) {
    return cursor < block.openFrom + block.fenceLen
  }

  if (cursor >= block.closeFrom && cursor <= block.closeTo) {
    return cursor < block.closeFrom + block.fenceLen
  }

  if (cursor > block.openTo && cursor < block.closeFrom) return true

  return false
}

function decorateFenceBlock(
  queue: DecoQueue,
  block: FenceBlock,
  cursor: number,
  doc: EditorView['state']['doc']
) {
  const editing = cursorInFenceEditZone(cursor, block, doc)
  const openLine = doc.lineAt(block.openFrom)

  if (editing) {
    addSyntax(queue, block.openFrom, block.openFrom + block.fenceLen, 'cm-syn-code')
    if (!block.unclosed) {
      const closeLine = doc.lineAt(block.closeFrom)
      if (closeLine.number !== openLine.number) {
        addSyntax(queue, block.closeFrom, block.closeFrom + block.fenceLen, 'cm-syn-code')
      }
    } else {
      let pos = openLine.to + 1
      while (pos <= doc.length) {
        const line = doc.lineAt(pos)
        addLineClass(queue, line.from, 'cm-lp-codeblock-line')
        pos = line.to + 1
      }
    }
    return
  }

  addHidden(queue, block.openFrom, openLine.to + 1)

  const contentEnd = block.unclosed ? doc.length : block.closeFrom
  let pos = openLine.to + 1
  while (pos < contentEnd) {
    const line = doc.lineAt(pos)
    addLineClass(queue, line.from, 'cm-lp-codeblock-line')
    pos = line.to + 1
  }

  if (!block.unclosed) {
    const closeLine = doc.lineAt(block.closeFrom)
    if (closeLine.number !== openLine.number) {
      addHidden(queue, closeLine.from, closeLine.to + 1)
    }
  }
}

function decorateLine(
  queue: DecoQueue,
  text: string,
  base: number,
  lineEnd: number,
  cursor: number,
  skipRanges: [number, number][],
  lazyQuote: boolean,
  contactNames: string[]
) {
  function inSkipped(from: number, to: number) {
    return skipRanges.some(([s, e]) => from < e && to > s)
  }

  if (inSkipped(base, lineEnd + 1)) return

  if (/^(`{3,}|~{3,})/.test(text)) return

  const onLine = cursorOnLine(cursor, base, lineEnd)
  let lineText = text
  let lineFrom = base

  const headingMatch = lineText.match(/^(#{1,6})\s(.*)$/)
  if (headingMatch) {
    const prefixLen = headingMatch[1].length + 1
    const level = headingMatch[1].length
    if (onLine) {
      addSyntax(queue, lineFrom, lineFrom + prefixLen, `cm-syn-heading cm-syn-h${level}`)
    } else {
      addHidden(queue, lineFrom, lineFrom + prefixLen)
      addPreview(queue, lineFrom + prefixLen, lineEnd, `cm-lp-heading cm-lp-h${level}`)
    }
    lineText = headingMatch[2]
    lineFrom += prefixLen
  } else {
    const quoteMatch = lineText.match(/^(>\s?)(.*)$/)
    if (quoteMatch) {
      const prefixLen = quoteMatch[1].length
      if (onLine) {
        addSyntax(queue, lineFrom, lineFrom + prefixLen, 'cm-syn-quote')
      } else {
        addLineClass(queue, base, 'cm-lp-quote-line')
        addHidden(queue, lineFrom, lineFrom + prefixLen)
        addPreview(queue, lineFrom + prefixLen, lineEnd, 'cm-lp-quote-content')
      }
      lineText = quoteMatch[2]
      lineFrom += prefixLen
    } else if (lazyQuote) {
      if (!onLine) {
        addLineClass(queue, base, 'cm-lp-quote-line')
        addPreview(queue, lineFrom, lineEnd, 'cm-lp-quote-content')
      }
    } else {
      const taskMatch = lineText.match(/^(\s*)(- \[([ x])\] )(.*)$/)
      if (taskMatch) {
        const indentLen = taskMatch[1].length
        const markerLen = taskMatch[2].length
        const fullPrefixLen = indentLen + markerLen
        const checked = taskMatch[3] === 'x'
        if (onLine) {
          addSyntax(queue, lineFrom, lineFrom + fullPrefixLen, 'cm-syn-list')
        } else {
          const indentClass = taskLineIndentClass(indentLen)
          if (indentClass) addLineClass(queue, base, indentClass)
          addHidden(queue, lineFrom, lineFrom + fullPrefixLen)
          queue.add(
            lineFrom + fullPrefixLen,
            lineFrom + fullPrefixLen,
            Decoration.widget({
              widget: new TaskCheckboxWidget(checked),
              side: -1,
            })
          )
          addPreview(queue, lineFrom + fullPrefixLen, lineEnd, 'cm-lp-task-content')
        }
        lineText = taskMatch[4]
        lineFrom += fullPrefixLen
      } else {
        const ulMatch = lineText.match(/^(\s*)([-*+]) (.*)$/)
        if (ulMatch) {
          const indentLen = ulMatch[1].length
          const markerLen = ulMatch[2].length + 1
          const fullPrefixLen = indentLen + markerLen
          if (onLine) {
            addSyntax(queue, lineFrom, lineFrom + fullPrefixLen, 'cm-syn-list')
          } else {
            const indentClass = taskLineIndentClass(indentLen)
            if (indentClass) addLineClass(queue, base, indentClass)
            addHidden(queue, lineFrom, lineFrom + fullPrefixLen)
            addPreview(queue, lineFrom + fullPrefixLen, lineEnd, 'cm-lp-ul-content')
          }
          lineText = ulMatch[3]
          lineFrom += fullPrefixLen
        } else {
          const olMatch = lineText.match(/^(\s*)(\d+\. )(.*)$/)
          if (olMatch) {
            const indentLen = olMatch[1].length
            const markerLen = olMatch[2].length
            const fullPrefixLen = indentLen + markerLen
            if (onLine) {
              addSyntax(queue, lineFrom, lineFrom + fullPrefixLen, 'cm-syn-list')
            } else {
              const indentClass = taskLineIndentClass(indentLen)
              if (indentClass) addLineClass(queue, base, indentClass)
              addPreview(queue, lineFrom + indentLen, lineFrom + fullPrefixLen, 'cm-lp-ol-marker')
              addPreview(queue, lineFrom + fullPrefixLen, lineEnd, 'cm-lp-ol-content')
            }
            lineText = olMatch[3]
            lineFrom += fullPrefixLen
          }
        }
      }
    }
  }

  const local = lineText
  const used: [number, number][] = []

  function free(start: number, end: number) {
    return !used.some(([s, e]) => start < e && end > s)
  }

  function markUsed(start: number, end: number) {
    used.push([start, end])
  }

  function decorateLinkOrImage(fullFrom: number, match: string, isImage: boolean) {
    const bracketCloseIdx = match.indexOf(']')
    if (bracketCloseIdx < 0) return
    const textStart = fullFrom + (isImage ? 2 : 1)
    const textEnd = fullFrom + bracketCloseIdx
    const fullTo = fullFrom + match.length
    const parenStart = fullFrom + match.lastIndexOf('(')
    const label = match.slice(isImage ? 2 : 1, bracketCloseIdx)
    const isEmpty = label.length === 0

    if (cursor >= fullFrom && cursor < fullTo) {
      if (isImage) addSyntax(queue, fullFrom, fullFrom + 2, 'cm-syn-image')
      addSyntax(queue, textStart, textEnd, isImage ? 'cm-syn-image' : 'cm-syn-link')
      if (textEnd < fullTo) {
        addSyntax(queue, textEnd, textEnd + 1, isImage ? 'cm-syn-image' : 'cm-syn-link')
      }
      if (parenStart >= 0 && parenStart > textEnd + 1) {
        addSyntax(queue, parenStart, fullTo, 'cm-syn-link')
      }
    } else if (isEmpty) {
      addHidden(queue, fullFrom, fullTo)
    } else {
      addHidden(queue, fullFrom, textStart)
      addPreview(queue, textStart, textEnd, 'cm-lp-link')
      addHidden(queue, textEnd, fullTo)
    }
  }

  const imageRe = /!\[([^\]]*)\]\(([^)]*)\)/g
  let imgMatch: RegExpExecArray | null
  while ((imgMatch = imageRe.exec(local)) !== null) {
    const start = imgMatch.index
    const end = start + imgMatch[0].length
    if (!free(start, end)) continue
    markUsed(start, end)
    decorateLinkOrImage(lineFrom + start, imgMatch[0], true)
  }

  const linkRe = /(?<!!)\[([^\]]*)\]\(([^)]*)\)/g
  let linkMatch: RegExpExecArray | null
  while ((linkMatch = linkRe.exec(local)) !== null) {
    const start = linkMatch.index
    const end = start + linkMatch[0].length
    if (!free(start, end)) continue
    markUsed(start, end)
    decorateLinkOrImage(lineFrom + start, linkMatch[0], false)
  }

  const wikiRe = /\[\[([^\]]*)\]\]/g
  let wikiMatch: RegExpExecArray | null
  while ((wikiMatch = wikiRe.exec(local)) !== null) {
    const start = wikiMatch.index
    const end = start + wikiMatch[0].length
    if (!free(start, end)) continue
    markUsed(start, end)
    const fullFrom = lineFrom + start
    const fullTo = lineFrom + end
    const isEmpty = wikiMatch[1].length === 0

    if (cursor >= fullFrom && cursor < fullTo) {
      addSyntax(queue, fullFrom, fullFrom + 2, 'cm-syn-link')
      addSyntax(queue, fullTo - 2, fullTo, 'cm-syn-link')
    } else if (isEmpty) {
      addHidden(queue, fullFrom, fullTo)
    } else {
      addHidden(queue, fullFrom, fullFrom + 2)
      addPreview(queue, fullFrom + 2, fullTo - 2, 'cm-lp-link cm-lp-wiki')
      addHidden(queue, fullTo - 2, fullTo)
    }
  }

  if (contactNames.length > 0) {
    for (const mention of findContactMentions(local, contactNames)) {
      const { start, end } = mention
      if (!free(start, end)) continue
      markUsed(start, end)
      addPreview(queue, lineFrom + start, lineFrom + end, 'cm-lp-contact')
    }
  }

  const wrapPatterns: {
    re: RegExp
    openLen: number
    closeLen: number
    openClass: string
    closeClass: string
    previewClass: string
  }[] = [
    { re: /\*\*\*(.+?)\*\*\*/g, openLen: 3, closeLen: 3, openClass: 'cm-syn-bold', closeClass: 'cm-syn-bold', previewClass: 'cm-lp-bold cm-lp-italic' },
    { re: /\*\*(.+?)\*\*/g, openLen: 2, closeLen: 2, openClass: 'cm-syn-bold', closeClass: 'cm-syn-bold', previewClass: 'cm-lp-bold' },
    { re: /~~(.+?)~~/g, openLen: 2, closeLen: 2, openClass: 'cm-syn-strike', closeClass: 'cm-syn-strike', previewClass: 'cm-lp-strike' },
    { re: /`([^`\n]+)`/g, openLen: 1, closeLen: 1, openClass: 'cm-syn-code', closeClass: 'cm-syn-code', previewClass: 'cm-lp-code' },
    { re: /(?<!\*)\*([^*\n]+?)\*(?!\*)/g, openLen: 1, closeLen: 1, openClass: 'cm-syn-italic', closeClass: 'cm-syn-italic', previewClass: 'cm-lp-italic' },
  ]

  for (const pat of wrapPatterns) {
    pat.re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pat.re.exec(local)) !== null) {
      const start = m.index
      const end = m.index + m[0].length
      if (!free(start, end)) continue
      markUsed(start, end)
      decorateWrapToken(
        queue,
        lineFrom + start,
        lineFrom + end,
        cursor,
        pat.openLen,
        pat.closeLen,
        pat.openClass,
        pat.closeClass,
        pat.previewClass
      )
    }
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const queue = new DecoQueue()
  const cursor = view.state.selection.main.head
  const doc = view.state.doc
  const contactNames = view.state.field(contactNamesField, false) ?? []

  const fenceBlocks = findFenceBlocks(doc)
  const skipRanges: [number, number][] = fenceBlocks.map((b) => [
    b.openFrom,
    b.unclosed ? doc.length : b.closeTo + 1,
  ])

  const lineTexts: string[] = []
  for (let i = 1; i <= doc.lines; i++) lineTexts.push(doc.line(i).text)
  const lazyQuoteLines = computeLazyQuoteLineNumbers(lineTexts)

  for (const block of fenceBlocks) {
    decorateFenceBlock(queue, block, cursor, doc)
  }

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      decorateLine(
        queue,
        line.text,
        line.from,
        line.to,
        cursor,
        skipRanges,
        lazyQuoteLines.has(line.number),
        contactNames
      )
      pos = line.to + 1
    }
  }

  return queue.finish()
}

class LivePreviewPlugin {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view)
  }

  update(update: ViewUpdate) {
    const contactNamesChanged = update.transactions.some((tr) =>
      tr.effects.some((effect) => effect.is(setContactNamesEffect))
    )
    if (update.docChanged || update.selectionSet || update.viewportChanged || contactNamesChanged) {
      this.decorations = buildDecorations(update.view)
    }
  }
}

export function livePreviewExtension() {
  return [
    contactNamesField,
    ViewPlugin.fromClass(LivePreviewPlugin, {
      decorations: (v) => v.decorations,
    }),
  ]
}

function toggleTaskCheckbox(view: EditorView, lineFrom: number): boolean {
  const line = view.state.doc.lineAt(lineFrom)
  const match = line.text.match(/^(\s*)- \[([ x])\] /)
  if (!match) return false
  const checked = match[2] === 'x'
  const markPos = line.from + match[1].length + 3
  view.dispatch({
    changes: { from: markPos, to: markPos + 1, insert: checked ? ' ' : 'x' },
  })
  view.focus()
  return true
}

export function wikiLinkClickExtension(onWikiLinkClick: (title: string) => void) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!(event.target instanceof HTMLElement)) return false

      if (event.target instanceof HTMLInputElement && event.target.classList.contains('cm-lp-task-checkbox')) {
        event.preventDefault()
        const pos = view.posAtDOM(event.target)
        toggleTaskCheckbox(view, pos)
        return true
      }

      const wikiEl = event.target.closest('.cm-lp-wiki')
      if (!wikiEl) return false
      event.preventDefault()
      const title = wikiEl.textContent?.trim()
      if (title) {
        onWikiLinkClick(title)
        view.focus()
      }
      return true
    },
  })
}

export function contactMentionClickExtension(onContactClick: (name: string) => void) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!(event.target instanceof HTMLElement)) return false

      const mentionEl = event.target.closest('.cm-lp-contact')
      if (!mentionEl) return false
      event.preventDefault()
      const text = mentionEl.textContent?.trim() ?? ''
      const name = text.startsWith('@') ? text.slice(1).trim() : text
      if (name) {
        onContactClick(name)
        view.focus()
      }
      return true
    },
  })
}
