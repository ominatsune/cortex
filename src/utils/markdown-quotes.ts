/** Continues blockquote lines without a leading `>` (CommonMark lazy continuation). */
export function normalizeLazyBlockquotes(markdown: string): string {
  const lines = normalizeLineEndings(markdown).split('\n')
  let inQuote = false
  const out: string[] = []

  for (const line of lines) {
    if (/^>\s?/.test(line)) {
      inQuote = true
      const content = line.replace(/^>\s?/, '')
      out.push(`> ${content}`)
      continue
    }

    if (inQuote && line.trim() === '') {
      inQuote = false
      out.push(line)
      continue
    }

    if (inQuote) {
      out.push(`> ${line}`)
      continue
    }

    inQuote = false
    out.push(line)
  }

  return out.join('\n')
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export type MarkdownPreviewSegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'quote'; lines: string[] }

/** Split markdown into quote runs and non-quote runs for read-mode rendering. */
export function splitMarkdownQuoteSegments(markdown: string): MarkdownPreviewSegment[] {
  const lines = normalizeLineEndings(markdown).split('\n')
  const segments: MarkdownPreviewSegment[] = []
  let mdLines: string[] = []
  let quoteLines: string[] = []
  let fenceOpen: string | null = null
  let inQuote = false

  const flushMd = () => {
    if (mdLines.length) {
      segments.push({ kind: 'markdown', text: mdLines.join('\n') })
      mdLines = []
    }
  }

  const flushQuote = () => {
    if (quoteLines.length) {
      segments.push({ kind: 'quote', lines: [...quoteLines] })
      quoteLines = []
    }
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fenceOpen === null) {
        fenceOpen = marker
      } else if (line.startsWith(fenceOpen)) {
        fenceOpen = null
      }
      flushQuote()
      inQuote = false
      mdLines.push(line)
      continue
    }

    if (fenceOpen !== null) {
      mdLines.push(line)
      continue
    }

    if (/^>\s?/.test(line)) {
      flushMd()
      inQuote = true
      quoteLines.push(line.replace(/^>\s?/, ''))
      continue
    }

    if (inQuote && line.trim() === '') {
      flushQuote()
      inQuote = false
      mdLines.push(line)
      continue
    }

    if (inQuote) {
      quoteLines.push(line)
      continue
    }

    flushQuote()
    inQuote = false
    mdLines.push(line)
  }

  flushQuote()
  flushMd()
  return segments
}

export function computeLazyQuoteLineNumbers(lines: string[]): Set<number> {
  const quoteLines = new Set<number>()
  let inQuote = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    if (/^>\s?/.test(line)) {
      inQuote = true
      quoteLines.add(lineNum)
      continue
    }

    if (inQuote && line.trim() === '') {
      inQuote = false
      continue
    }

    if (inQuote) {
      quoteLines.add(lineNum)
      continue
    }

    inQuote = false
  }

  return quoteLines
}
