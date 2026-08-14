export function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { meta, body: match[2] ?? '' }
}

export function buildFrontmatter(meta: Record<string, string | boolean | string[] | undefined>, body = ''): string {
  const lines = Object.entries(meta)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(', ')}`
      if (typeof v === 'boolean') return `${k}: ${v}`
      return `${k}: ${v}`
    })
  return `---\n${lines.join('\n')}\n---\n\n${body.trimStart()}`
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'untitled'
}
