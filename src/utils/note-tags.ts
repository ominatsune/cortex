import { extractTagsFromContent, stripTagsBlock, withTagsBlock } from '@cortex/core'

export { stripTagsBlock, withTagsBlock }

export function getNoteTags(content: string): string[] {
  return extractTagsFromContent(content)
}

export function setNoteTags(body: string, tags: string[]): string {
  return withTagsBlock(body, tags)
}
