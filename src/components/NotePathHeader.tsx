import { splitNoteHeaderPath } from '../utils/note-meta'
import './NotePathHeader.css'

interface NotePathHeaderProps {
  content: string
  vaultName: string
  noteRelativePath: string | null
  compact?: boolean
}

export default function NotePathHeader({
  content,
  vaultName,
  noteRelativePath,
  compact,
}: NotePathHeaderProps) {
  const { prefix, title } = splitNoteHeaderPath(vaultName, noteRelativePath, content)

  return (
    <div className={`note-path-header ${compact ? 'compact' : ''}`}>
      <span className="note-path-prefix">{prefix}</span>
      <strong className="note-path-title">{title}</strong>
    </div>
  )
}
