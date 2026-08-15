import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Users, FileText, BookOpen, X, Trash2, Plus } from 'lucide-react'
import type { CalendarEvent, Contact } from '../types'
import './EventDetailModal.css'

interface NoteOption {
  name: string
  path: string
}

interface EventDetailModalProps {
  event: CalendarEvent
  onClose: () => void
  onUpdate: (updates: Partial<CalendarEvent>) => void
  onDelete: () => void
  onOpenContact: (contact: Contact) => void
  onOpenNote: (path: string, name: string) => void
  onOpenDiaryEntry: (dateStr: string) => void
  onError: (msg: string) => void
}

export default function EventDetailModal({
  event,
  onClose,
  onUpdate,
  onDelete,
  onOpenContact,
  onOpenNote,
  onOpenDiaryEntry,
  onError,
}: EventDetailModalProps) {
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [allNotes, setAllNotes] = useState<NoteOption[]>([])
  const [allDiaryDates, setAllDiaryDates] = useState<string[]>([])
  const [pickContact, setPickContact] = useState('')
  const [pickNote, setPickNote] = useState('')
  const [pickDiary, setPickDiary] = useState('')

  useEffect(() => {
    void Promise.all([
      window.cortex.contacts.list(),
      window.cortex.storage.listFiles('notes'),
      window.cortex.storage.listDiaryDates(),
    ]).then(([contacts, notes, diaryDates]) => {
      setAllContacts(contacts)
      setAllNotes(notes)
      setAllDiaryDates([...diaryDates].sort((a, b) => b.localeCompare(a)))
    }).catch(() => onError('Failed to load contacts/notes/diary for linking'))
  }, [onError])

  const contactIds = event.contactIds ?? []
  const notePaths = event.notePaths ?? []
  const diaryDates = event.diaryDates ?? []

  const linkedContacts = useMemo(
    () => contactIds.map((id) => allContacts.find((c) => c.id === id)).filter((c): c is Contact => !!c),
    [contactIds, allContacts]
  )
  const linkedNotes = useMemo(
    () => notePaths.map((p) => allNotes.find((n) => n.path === p) ?? { path: p, name: p }),
    [notePaths, allNotes]
  )

  const availableContacts = allContacts.filter((c) => !contactIds.includes(c.id))
  const availableNotes = allNotes.filter((n) => !notePaths.includes(n.path))
  const availableDiaryDates = allDiaryDates.filter((d) => !diaryDates.includes(d))

  const addContact = () => {
    if (!pickContact) return
    onUpdate({ contactIds: [...contactIds, pickContact] })
    setPickContact('')
  }
  const removeContact = (id: string) => {
    onUpdate({ contactIds: contactIds.filter((c) => c !== id) })
  }

  const addNote = () => {
    if (!pickNote) return
    onUpdate({ notePaths: [...notePaths, pickNote] })
    setPickNote('')
  }
  const removeNote = (path: string) => {
    onUpdate({ notePaths: notePaths.filter((p) => p !== path) })
  }

  const addDiary = () => {
    if (!pickDiary) return
    onUpdate({ diaryDates: [...diaryDates, pickDiary].sort((a, b) => b.localeCompare(a)) })
    setPickDiary('')
  }
  const removeDiary = (date: string) => {
    onUpdate({ diaryDates: diaryDates.filter((d) => d !== date) })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal event-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-detail-header">
          <h2>{event.title}</h2>
          <button type="button" className="tags-popup-close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="event-detail-time">
          {event.allDay ? 'All day' : `${format(parseISO(event.start), 'h:mm a')} – ${format(parseISO(event.end), 'h:mm a')}`}
          {event.location && <span className="event-detail-loc"> · {event.location}</span>}
        </div>

        <div className="event-link-section">
          <h3 className="event-link-title"><Users size={13} /> Contacts</h3>
          <div className="event-link-chips">
            {linkedContacts.map((c) => (
              <span key={c.id} className="event-link-chip" onClick={() => onOpenContact(c)}>
                {c.name}
                <button type="button" onClick={(e) => { e.stopPropagation(); removeContact(c.id) }} aria-label={`Remove ${c.name}`}>
                  <X size={10} />
                </button>
              </span>
            ))}
            {linkedContacts.length === 0 && <span className="event-link-empty">No contacts linked</span>}
          </div>
          {availableContacts.length > 0 && (
            <div className="event-link-add-row">
              <select value={pickContact} onChange={(e) => setPickContact(e.target.value)}>
                <option value="">Add a contact…</option>
                {availableContacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button type="button" onClick={addContact} disabled={!pickContact}><Plus size={14} /></button>
            </div>
          )}
        </div>

        <div className="event-link-section">
          <h3 className="event-link-title"><FileText size={13} /> Notes</h3>
          <div className="event-link-chips">
            {linkedNotes.map((n) => (
              <span key={n.path} className="event-link-chip" onClick={() => onOpenNote(n.path, n.name)}>
                {n.name}
                <button type="button" onClick={(e) => { e.stopPropagation(); removeNote(n.path) }} aria-label={`Remove ${n.name}`}>
                  <X size={10} />
                </button>
              </span>
            ))}
            {linkedNotes.length === 0 && <span className="event-link-empty">No notes linked</span>}
          </div>
          {availableNotes.length > 0 && (
            <div className="event-link-add-row">
              <select value={pickNote} onChange={(e) => setPickNote(e.target.value)}>
                <option value="">Add a note…</option>
                {availableNotes.map((n) => (
                  <option key={n.path} value={n.path}>{n.name}</option>
                ))}
              </select>
              <button type="button" onClick={addNote} disabled={!pickNote}><Plus size={14} /></button>
            </div>
          )}
        </div>

        <div className="event-link-section">
          <h3 className="event-link-title"><BookOpen size={13} /> Diary entries</h3>
          <div className="event-link-chips">
            {diaryDates.map((d) => (
              <span key={d} className="event-link-chip" onClick={() => onOpenDiaryEntry(d)}>
                {d}
                <button type="button" onClick={(e) => { e.stopPropagation(); removeDiary(d) }} aria-label={`Remove ${d}`}>
                  <X size={10} />
                </button>
              </span>
            ))}
            {diaryDates.length === 0 && <span className="event-link-empty">No diary entries linked</span>}
          </div>
          {availableDiaryDates.length > 0 && (
            <div className="event-link-add-row">
              <select value={pickDiary} onChange={(e) => setPickDiary(e.target.value)}>
                <option value="">Add a diary entry…</option>
                {availableDiaryDates.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button type="button" onClick={addDiary} disabled={!pickDiary}><Plus size={14} /></button>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary event-detail-delete" onClick={onDelete}>
            <Trash2 size={13} /> Delete event
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
