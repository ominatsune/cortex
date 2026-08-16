import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { FileText, BookOpen, Hash } from 'lucide-react'
import type { CalendarEvent, Contact, EditorMode } from '../types'
import ConfirmDialog from './ConfirmDialog'
import EventLinkSection from './EventLinkSection'
import ContactPickerField from './ContactPickerField'
import ActionRow from './ActionRow'
import ActionButton from './ActionButton'
import ModeToggle from './ModeToggle'
import TagsPopup from './TagsPopup'
import './CalendarEventView.css'

interface NoteOption {
  name: string
  path: string
}

interface CalendarEventViewProps {
  event: CalendarEvent
  canGoBack?: boolean
  onNavBack?: () => void
  onClose?: () => void
  onOpenContact: (contact: Contact) => void
  onOpenNote: (path: string, name: string) => void
  onOpenDiaryEntry: (dateStr: string) => void
  onError: (msg: string) => void
  onRefresh: () => void
  onEventDeleted: () => void
}

export default function CalendarEventView({
  event: initialEvent,
  canGoBack,
  onNavBack,
  onClose,
  onOpenContact,
  onOpenNote,
  onOpenDiaryEntry,
  onError,
  onRefresh,
  onEventDeleted,
}: CalendarEventViewProps) {
  const [event, setEvent] = useState(initialEvent)
  const [mode, setMode] = useState<EditorMode>('read')
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [allNotes, setAllNotes] = useState<NoteOption[]>([])
  const [allDiaryDates, setAllDiaryDates] = useState<string[]>([])
  const [pickNote, setPickNote] = useState('')
  const [pickDiary, setPickDiary] = useState('')
  const [pendingDelete, setPendingDelete] = useState(false)
  const [showTagsPopup, setShowTagsPopup] = useState(false)

  // Always land on Read mode for an event you're opening/switching to, so
  // there's no chance of an accidental edit before you've actually asked
  // for one.
  useEffect(() => {
    setEvent(initialEvent)
    setMode('read')
  }, [initialEvent])

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
  const eventTags = event.tags ?? []

  const linkedContacts = useMemo(
    () => contactIds.map((id) => allContacts.find((c) => c.id === id)).filter((c): c is Contact => !!c),
    [contactIds, allContacts]
  )
  const linkedNotes = useMemo(
    () => notePaths.map((p) => allNotes.find((n) => n.path === p) ?? { path: p, name: p }),
    [notePaths, allNotes]
  )

  const availableNotes = allNotes.filter((n) => !notePaths.includes(n.path))
  const availableDiaryDates = allDiaryDates.filter((d) => !diaryDates.includes(d))

  const applyUpdate = async (updates: Partial<CalendarEvent>) => {
    try {
      const updated = await window.cortex.calendar.updateEvent(event.id, updates)
      if (updated) {
        setEvent(updated)
        onRefresh()
      } else {
        onError('Failed to update event')
      }
    } catch {
      onError('Failed to update event')
    }
  }

  const addContact = (contact: Contact) => {
    setAllContacts((prev) => (prev.some((c) => c.id === contact.id) ? prev : [...prev, contact]))
    void applyUpdate({ contactIds: [...contactIds, contact.id] })
  }
  const removeContact = (id: string) => void applyUpdate({ contactIds: contactIds.filter((c) => c !== id) })
  const createContact = async (name: string): Promise<Contact | null> => {
    try {
      const created = await window.cortex.contacts.create({ name, tags: [] })
      addContact(created)
      return created
    } catch {
      onError('Failed to create contact')
      return null
    }
  }

  const addNote = () => {
    if (!pickNote) return
    void applyUpdate({ notePaths: [...notePaths, pickNote] })
    setPickNote('')
  }
  const removeNote = (path: string) => void applyUpdate({ notePaths: notePaths.filter((p) => p !== path) })

  const addDiary = () => {
    if (!pickDiary) return
    void applyUpdate({ diaryDates: [...diaryDates, pickDiary].sort((a, b) => b.localeCompare(a)) })
    setPickDiary('')
  }
  const removeDiary = (date: string) => void applyUpdate({ diaryDates: diaryDates.filter((d) => d !== date) })

  const applyTags = (tags: string[]) => {
    void applyUpdate({ tags })
    setShowTagsPopup(false)
  }

  const confirmDelete = async () => {
    setPendingDelete(false)
    try {
      await window.cortex.calendar.deleteEvent(event.id)
      onRefresh()
      onEventDeleted()
    } catch {
      onError('Failed to delete event')
    }
  }

  const eventDateLabel = format(parseISO(event.start), "EEEE '-' do MMMM, yyyy")

  return (
    <main className="center-panel">
      <ActionRow
        left={<span className="center-title">{eventDateLabel}</span>}
        center={
          <>
            <ActionButton main="GO" sub="BACK" disabled={!canGoBack} onClick={() => onNavBack?.()} />
            <ModeToggle mode={mode} onChange={setMode} />
            <span className="action-row-ghost" aria-hidden="true">
              <ActionButton main="GO" sub="BACK" disabled onClick={() => {}} />
            </span>
          </>
        }
        right={
          <>
            {onClose && <ActionButton main="CLOSE" sub="EVENT" onClick={onClose} />}
            <ActionButton main="DELETE" sub="EVENT" variant="danger" onClick={() => setPendingDelete(true)} />
          </>
        }
      />

      <div className="event-view-outer">
      <div className="event-view-body">
        <h1 className="event-view-title">{event.title}</h1>
        <div className="event-view-time">
          {event.allDay ? 'All day' : `${format(parseISO(event.start), 'h:mm a')} – ${format(parseISO(event.end), 'h:mm a')}`}
          {event.location && <span className="event-view-loc"> · {event.location}</span>}
        </div>

        <ContactPickerField
          label="Contacts"
          linkedContacts={linkedContacts}
          allContacts={allContacts}
          onAdd={addContact}
          onRemove={removeContact}
          onCreate={createContact}
          onChipClick={onOpenContact}
          readOnly={mode === 'read'}
        />

        <EventLinkSection
          title="Notes"
          icon={FileText}
          chips={linkedNotes.map((n) => ({ key: n.path, label: n.name }))}
          available={availableNotes.map((n) => ({ value: n.path, label: n.name }))}
          picked={pickNote}
          onPickedChange={setPickNote}
          onAdd={addNote}
          onRemove={removeNote}
          onChipClick={(path) => {
            const note = linkedNotes.find((n) => n.path === path)
            if (note) onOpenNote(note.path, note.name)
          }}
          emptyLabel="No notes linked"
          addPlaceholder="Add a note…"
          readOnly={mode === 'read'}
        />

        <EventLinkSection
          title="Diary entries"
          icon={BookOpen}
          chips={diaryDates.map((d) => ({ key: d, label: d }))}
          available={availableDiaryDates.map((d) => ({ value: d, label: d }))}
          picked={pickDiary}
          onPickedChange={setPickDiary}
          onAdd={addDiary}
          onRemove={removeDiary}
          onChipClick={(d) => onOpenDiaryEntry(d)}
          emptyLabel="No diary entries linked"
          addPlaceholder="Add a diary entry…"
          readOnly={mode === 'read'}
        />

        <div className="event-link-section">
          <h3 className="event-link-title"><Hash size={13} /> Tags</h3>
          <div className="event-link-chips">
            {eventTags.map((tag) => (
              <span key={tag} className="event-link-chip static">#{tag}</span>
            ))}
            {eventTags.length === 0 && <span className="event-link-empty">No tags</span>}
          </div>
          {mode === 'edit' && (
            <button type="button" className="toolbar-btn event-link-manage-tags" onClick={() => setShowTagsPopup(true)}>
              <Hash size={13} /> Manage tags
            </button>
          )}
        </div>
      </div>
      </div>

      {showTagsPopup && (
        <TagsPopup tags={eventTags} onApply={applyTags} onClose={() => setShowTagsPopup(false)} />
      )}

      <ConfirmDialog
        open={pendingDelete}
        title="Delete event"
        message={`Are you sure you want to delete "${event.title}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </main>
  )
}
