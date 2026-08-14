const FILE_TYPE_RE = /^\/\/\s*type\s*=\s*(\w+)\s*\/\/\s*\n?/

export function parseFileType(raw: string): string | null {
  const match = raw.match(FILE_TYPE_RE)
  return match ? match[1].toLowerCase() : null
}

export function stripFileTypeLine(raw: string): string {
  return raw.replace(FILE_TYPE_RE, '')
}

export function withFileTypeLine(type: string, content: string): string {
  const body = stripFileTypeLine(content)
  return `// type = ${type} //\n${body}`
}

export function buildFileTypeLine(type: string): string {
  return `// type = ${type} //`
}
