const TASK_LINE_RE = /^(\s*)- \[([ x])\] /gm

export function toggleTaskAtIndex(content: string, taskIndex: number): string {
  let match: RegExpExecArray | null
  let i = 0
  let lastIndex = 0
  const parts: string[] = []

  TASK_LINE_RE.lastIndex = 0
  while ((match = TASK_LINE_RE.exec(content)) !== null) {
    if (i === taskIndex) {
      parts.push(content.slice(lastIndex, match.index))
      const newMark = match[2] === 'x' ? ' ' : 'x'
      parts.push(`${match[1]}- [${newMark}] `)
      lastIndex = match.index + match[0].length
      parts.push(content.slice(lastIndex))
      return parts.join('')
    }
    i++
  }

  return content
}

export function taskLineIndentClass(indentLen: number): string {
  if (indentLen >= 4) return 'cm-lp-list-indent-2'
  if (indentLen >= 2) return 'cm-lp-list-indent-1'
  return ''
}
