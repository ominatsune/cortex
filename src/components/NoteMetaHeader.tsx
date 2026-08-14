import { splitNoteHeaderPath } from '../utils/note-meta'
import './NoteMetaHeader.css'

interface NoteMetaHeaderProps {
  content: string
  vaultPath: string
  noteRelativePath: string | null
}

export default function NoteMetaHeader({ content, vaultPath, noteRelativePath }: NoteMetaHeaderProps) {
  const { prefix, title } = splitNoteHeaderPath(vaultPath, noteRelativePath, content)

  return (
    <div className="note-meta-header">
      <div className="note-meta-path">
        {prefix}
        <strong className="note-meta-title-inline">{title}</strong>
      </div>
    </div>
  )
}
