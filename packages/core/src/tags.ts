const TAGS_BLOCK_RE = /\n<!--\s*cortex-tags:([\s\S]*?)\s*-->\s*$/

function parseLegacyFrontmatterTags(raw: string): { body: string; tags: string[] } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return { body: raw, tags: [] }
  const fm = match[1]
  // [ \t]* (not \s*) — \s matches newlines too, which let an empty
  // "tags:" line swallow the following frontmatter line (e.g. "created:
  // ...") as if it were the tag value.
  const tagsLine = fm.match(/^tags:[ \t]*(.+)$/m)
  const tags = tagsLine
    ? tagsLine[1].split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    : []
  return { body: raw.slice(match[0].length), tags }
}

export function parseTagsBlock(raw: string): string[] {
  const match = raw.match(TAGS_BLOCK_RE)
  if (!match) return []
  return match[1]
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

/** Split note content into editable body and trailing tags block. */
export function stripTagsBlock(content: string): { body: string; tags: string[] } {
  const { body: withoutLegacy, tags: legacyTags } = parseLegacyFrontmatterTags(content)
  const match = withoutLegacy.match(TAGS_BLOCK_RE)
  if (!match) {
    const inlineTags = extractInlineTags(withoutLegacy)
    const tags = [...new Set([...legacyTags, ...inlineTags])].sort()
    return { body: withoutLegacy, tags }
  }
  const body = withoutLegacy.slice(0, match.index).replace(/\n$/, '')
  const blockTags = parseTagsBlock(withoutLegacy)
  const inlineTags = extractInlineTags(body)
  const tags = [...new Set([...legacyTags, ...blockTags, ...inlineTags])].sort()
  return { body, tags }
}

export function withTagsBlock(body: string, tags: string[]): string {
  const cleaned = body.replace(TAGS_BLOCK_RE, '').replace(/\n$/, '')
  const normalized = [...new Set(tags.map((t) => t.toLowerCase().replace(/^#/, '').trim()).filter(Boolean))].sort()
  if (normalized.length === 0) return cleaned ? `${cleaned}\n` : ''
  return `${cleaned}\n\n<!-- cortex-tags:${normalized.join(',')} -->\n`
}

function extractInlineTags(content: string): string[] {
  const tags = new Set<string>()
  const hashTags = content.match(/(?:^|\s)#([a-zA-Z][\w-]*)/g)
  hashTags?.forEach((match) => {
    const tag = match.trim().replace(/^#/, '').toLowerCase()
    if (tag) tags.add(tag)
  })
  return Array.from(tags).sort()
}

export function extractTagsFromContent(content: string): string[] {
  const { tags } = stripTagsBlock(content)
  return tags
}
