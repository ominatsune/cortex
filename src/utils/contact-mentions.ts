export interface ContactMentionMatch {
  /** Index of the `@` character */
  start: number
  /** Index just past the matched name */
  end: number
  /** The contact name as stored (not as typed — casing may differ) */
  name: string
}

/**
 * Find `@Name` mentions in `text` that match a known contact name exactly.
 *
 * There's no closing delimiter for a mention (unlike `[[wiki links]]`), so a
 * mention is only recognized when the text right after `@` exactly matches a
 * known contact name. Names are matched longest-first so a multi-word name
 * like "Rich Smith" wins over a shorter contact named "Rich".
 */
export function findContactMentions(text: string, contactNames: string[]): ContactMentionMatch[] {
  const names = Array.from(new Set(contactNames.map((n) => n.trim()).filter(Boolean))).sort(
    (a, b) => b.length - a.length
  )
  if (names.length === 0) return []

  const lowerText = text.toLowerCase()
  const matches: ContactMentionMatch[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] !== '@') {
      i++
      continue
    }
    const precededByBoundary = i === 0 || /\s/.test(text[i - 1])
    if (!precededByBoundary) {
      i++
      continue
    }
    let matched = false
    for (const name of names) {
      const lowerName = name.toLowerCase()
      const end = i + 1 + lowerName.length
      if (lowerText.slice(i + 1, end) !== lowerName) continue
      const nextChar = text[end]
      if (nextChar !== undefined && /\w/.test(nextChar)) continue
      matches.push({ start: i, end, name })
      i = end
      matched = true
      break
    }
    if (!matched) i++
  }
  return matches
}

/** Resolve a mentioned name to its contact, matching case-insensitively. */
export function resolveContactMentionName<T extends { name: string }>(
  name: string,
  contacts: T[]
): T | null {
  const target = name.trim().toLowerCase()
  return contacts.find((c) => c.name.trim().toLowerCase() === target) ?? null
}
