import type { ReactNode } from 'react'

interface ActionRowProps {
  left?: ReactNode
  center?: ReactNode
  right?: ReactNode
  /** Contact/Event bodies inset 32px instead of Notes/Diary's 20px — set
   *  this to match the row's left/right padding to the canvas below it. */
  wide?: boolean
}

/** The header bar above the center panel — always rendered, even with
 *  nothing open, so the layout never jumps as documents open/close.
 *  Three flex columns: left/right share equal width so whatever's in
 *  `center` lands in the true middle of the panel. */
export default function ActionRow({ left, center, right, wide }: ActionRowProps) {
  return (
    <div className={`action-row${wide ? ' action-row-wide' : ''}`}>
      <div className="action-row-left">{left}</div>
      <div className="action-row-center">{center}</div>
      <div className="action-row-right">{right}</div>
    </div>
  )
}
