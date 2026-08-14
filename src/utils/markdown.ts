export { attachmentMarkdown } from '@cortex/core'

export type MarkdownAction =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'bold' | 'italic' | 'strikethrough' | 'code' | 'codeblock'
  | 'quote' | 'ul' | 'ol' | 'task' | 'link' | 'image' | 'wiki' | 'hr' | 'table'

export { MarkdownToggleController, MARKDOWN_KEYBINDS } from './markdown-toggles'
