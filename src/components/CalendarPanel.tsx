import { useState, useEffect, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, addDays, subDays,
  startOfWeek, endOfWeek, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2, BookOpen, FileText, X } from 'lucide-react'
import { resolveDiaryPath } from '@cortex/core'
import type { CalendarEvent, Contact } from '../types'
import ConfirmDialog from './ConfirmDialog'
import EventLinkSection from './EventLinkSection'
import ContactPickerField from './ContactPickerField'
import './CalendarPanel.css'

interface NoteOption {
  name: string
  path: string
}

/** Renders "with Mina" / "with Richard Taylor, and Simon" / "with Richard
 *  Taylor, Thomas, and Simon Jackson" — each name a clickable link to that
 *  contact, styled the same orange/flamingo as @mention links elsewhere. */
function ContactNameList({
  contacts,
  onOpenContact,
}: {
  contacts: Contact[]
  onOpenContact?: (contact: Contact) => void
}) {
  return (
    <>
      with{' '}
      {contacts.map((c, i) => (
        <span key={c.id}>
          {i > 0 && (i === contacts.length - 1 ? ', and ' : ', ')}
          <span
            className="cal-event-contact-link"
            onClick={(e) => { e.stopPropagation(); onOpenContact?.(c) }}
          >
            {c.name}
          </span>
        </span>
      ))}
    </>
  )
}

interface CalendarPanelProps {
  onError: (msg: string) => void
  onRefresh?: () => void
  onCloseDiaryEntry?: (dateStr: string) => void
  focusEvent?: CalendarEvent | null
  onClearFocusEvent?: () => void
  onOpenDiaryEntry?: (dateStr: string) => void
  onOpenEvent?: (event: CalendarEvent) => void
  onOpenContact?: (contact: Contact) => void
  diaryRefreshKey?: number
  fileRefreshKey?: number
}

export default function CalendarPanel({ onError, onRefresh, onCloseDiaryEntry, focusEvent, onClearFocusEvent, onOpenDiaryEntry, onOpenEvent, onOpenContact, diaryRefreshKey, fileRefreshKey }: CalendarPanelProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [formDate, setFormDate] = useState(new Date())
  const [form, setForm] = useState({ title: '', start: '09:00', end: '10:00', allDay: false, location: '', notes: '' })
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [withContacts, setWithContacts] = useState<Contact[]>([])
  const [allNotesList, setAllNotesList] = useState<NoteOption[]>([])
  const [allDiaryList, setAllDiaryList] = useState<string[]>([])
  const [withNotes, setWithNotes] = useState<NoteOption[]>([])
  const [withDiaryDates, setWithDiaryDates] = useState<string[]>([])
  const [pickNote, setPickNote] = useState('')
  const [pickDiaryDate, setPickDiaryDate] = useState('')
  const [formTags, setFormTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null)
  const [pendingDiaryDelete, setPendingDiaryDelete] = useState<string | null>(null)
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    const start = startOfMonth(currentMonth).toISOString()
    const end = endOfMonth(currentMonth).toISOString()
    try {
      const data = await window.cortex.calendar.listEvents(start, end)
      setEvents(data)
    } catch {
      onError('Failed to load calendar events')
    }
  }, [currentMonth, onError])

  const loadDiaryDates = useCallback(async () => {
    try {
      const dates = await window.cortex.storage.listDiaryDates()
      setDiaryDates(new Set(dates))
    } catch {
      // diary dates are best-effort
    }
  }, [])

  useEffect(() => {
    loadEvents()
    loadDiaryDates()
  }, [loadEvents, loadDiaryDates])

  const loadLinkingData = useCallback(() => {
    Promise.all([
      window.cortex.contacts.list(),
      window.cortex.storage.listFiles('notes'),
      window.cortex.storage.listDiaryDates(),
    ]).then(([contacts, notes, dates]) => {
      setAllContacts(contacts)
      setAllNotesList(notes)
      setAllDiaryList([...dates].sort((a, b) => b.localeCompare(a)))
    }).catch(() => {
      // linking data is best-effort in the create-event form
    })
  }, [])

  useEffect(() => {
    loadLinkingData()
  }, [loadLinkingData])

  // Re-fetch diary dates immediately when a new diary entry is opened/created
  useEffect(() => {
    if (diaryRefreshKey === undefined) return
    loadDiaryDates()
  }, [diaryRefreshKey, loadDiaryDates])

  // Re-sync diary dates, events, and contacts/notes/diary-links when any file
  // changes (covers deletion from the file browser, edits/deletes made from
  // the center-panel event view, and contacts created on the fly from an
  // existing event's "With" field — otherwise the day-card's "with" list
  // silently drops a just-created contact it doesn't know about yet).
  useEffect(() => {
    if (fileRefreshKey === undefined) return
    loadDiaryDates()
    loadEvents()
    loadLinkingData()
  }, [fileRefreshKey, loadDiaryDates, loadEvents, loadLinkingData])

  useEffect(() => {
    if (!focusEvent) return
    const date = parseISO(focusEvent.start)
    setCurrentMonth(startOfMonth(date))
    setSelectedDate(date)
    setHighlightedEventId(focusEvent.id)
    onClearFocusEvent?.()
  }, [focusEvent, onClearFocusEvent])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const dayEvents = (day: Date) =>
    events
      .filter((e) => isSameDay(parseISO(e.start), day))
      .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())

  const selectedEvents = dayEvents(selectedDate)
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const selectedHasDiary = diaryDates.has(selectedDateStr)

  const handleCreate = async () => {
    if (!form.title.trim()) return
    const dateStr = format(formDate, 'yyyy-MM-dd')
    const start = form.allDay
      ? new Date(dateStr + 'T00:00:00').toISOString()
      : new Date(dateStr + 'T' + form.start + ':00').toISOString()
    const end = form.allDay
      ? new Date(dateStr + 'T23:59:59').toISOString()
      : new Date(dateStr + 'T' + form.end + ':00').toISOString()
    try {
      await window.cortex.calendar.createEvent({
        title: form.title.trim(),
        start,
        end,
        allDay: form.allDay,
        location: form.location || undefined,
        notes: form.notes || undefined,
        contactIds: withContacts.length > 0 ? withContacts.map((c) => c.id) : undefined,
        notePaths: withNotes.length > 0 ? withNotes.map((n) => n.path) : undefined,
        diaryDates: withDiaryDates.length > 0 ? withDiaryDates : undefined,
        tags: formTags.length > 0 ? formTags : undefined,
      })
      setShowForm(false)
      setForm({ title: '', start: '09:00', end: '10:00', allDay: false, location: '', notes: '' })
      setWithContacts([])
      setWithNotes([])
      setWithDiaryDates([])
      setFormTags([])
      setTagInput('')
      loadEvents()
    } catch {
      onError('Failed to create event')
    }
  }

  const addWithNote = (note: NoteOption) => setWithNotes((prev) => [...prev, note])
  const removeWithNote = (path: string) => setWithNotes((prev) => prev.filter((n) => n.path !== path))

  const addWithDiaryDate = (date: string) =>
    setWithDiaryDates((prev) => [...prev, date].sort((a, b) => b.localeCompare(a)))
  const removeWithDiaryDate = (date: string) => setWithDiaryDates((prev) => prev.filter((d) => d !== date))

  const addFormTag = (raw: string) => {
    const tag = raw.toLowerCase().replace(/^#/, '').trim()
    if (!tag || formTags.includes(tag)) return
    setFormTags((prev) => [...prev, tag].sort())
    setTagInput('')
  }
  const removeFormTag = (tag: string) => setFormTags((prev) => prev.filter((t) => t !== tag))

  const addWithContact = (contact: Contact) => {
    setWithContacts((prev) => [...prev, contact])
  }

  const removeWithContact = (id: string) => {
    setWithContacts((prev) => prev.filter((c) => c.id !== id))
  }

  const createWithContact = async (name: string): Promise<Contact | null> => {
    try {
      const created = await window.cortex.contacts.create({ name, tags: [] })
      setAllContacts((prev) => [...prev, created])
      addWithContact(created)
      return created
    } catch {
      onError('Failed to create contact')
      return null
    }
  }

  const requestDelete = (evt: CalendarEvent) => {
    setPendingDelete(evt)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await window.cortex.calendar.deleteEvent(pendingDelete.id)
      loadEvents()
    } catch {
      onError('Failed to delete event')
    } finally {
      setPendingDelete(null)
    }
  }

  const handleAddDiaryEntry = async () => {
    try {
      await window.cortex.storage.openDiaryEntry(selectedDateStr)
      setDiaryDates((prev) => new Set(prev).add(selectedDateStr))
      onRefresh?.()
      onOpenDiaryEntry?.(selectedDateStr)
    } catch {
      onError('Failed to create diary entry')
    }
  }

  const confirmDiaryDelete = async () => {
    if (!pendingDiaryDelete) return
    try {
      // Close the file first so CenterPanel doesn't auto-save it back to disk
      onCloseDiaryEntry?.(pendingDiaryDelete)
      const relativePath = resolveDiaryPath(pendingDiaryDelete)
      await window.cortex.storage.deleteFile(relativePath)
      setDiaryDates((prev) => {
        const next = new Set(prev)
        next.delete(pendingDiaryDelete)
        return next
      })
      // Refresh file browser so the entry disappears from the left panel too
      onRefresh?.()
    } catch {
      onError('Failed to delete diary entry')
    } finally {
      setPendingDiaryDelete(null)
    }
  }

  return (
    <div className="calendar-panel-content">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft size={16} />
          </button>
          <span className="calendar-month">{format(currentMonth, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
        {days.map((day) => {
          const evts = dayEvents(day)
          const isSelected = isSameDay(day, selectedDate)
          const dateStr = format(day, 'yyyy-MM-dd')
          const hasDiary = diaryDates.has(dateStr)
          return (
            <button
              key={day.toISOString()}
              className={`cal-day ${!isSameMonth(day, currentMonth) ? 'other-month' : ''} ${isToday(day) ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedDate(day)}
            >
              <span className="cal-day-num">{format(day, 'd')}</span>
              <span className="cal-day-indicators">
                {hasDiary && <span className="cal-diary-dot" title="Diary entry" />}
                {evts.length > 0 && evts.slice(0, 2).map((e) => (
                  <span key={e.id} className="cal-dot" />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="calendar-events">
        <div className="calendar-events-header">
          <span>{format(selectedDate, 'EEEE, MMM do')}</span>
          <button className="cal-add-btn" onClick={() => { setFormDate(selectedDate); setShowForm(true) }}>
            <Plus size={14} />
          </button>
        </div>

        {selectedHasDiary && (
          <div className="cal-diary-entry">
            <BookOpen size={13} className="cal-diary-icon" />
            <span
              className="cal-diary-label"
              onClick={() => onOpenDiaryEntry?.(selectedDateStr)}
              title="Open diary entry"
            >
              Diary — {selectedDateStr}
            </span>
            <button
              className="cal-diary-delete"
              onClick={(e) => { e.stopPropagation(); setPendingDiaryDelete(selectedDateStr) }}
              title="Delete diary entry"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}

        {!selectedHasDiary && (
          <button type="button" className="cal-diary-add" onClick={handleAddDiaryEntry}>
            <BookOpen size={13} />
            Add diary entry
          </button>
        )}

        {selectedEvents.map((evt) => {
          const linkedContacts = (evt.contactIds ?? [])
            .map((id) => allContacts.find((c) => c.id === id))
            .filter((c): c is Contact => !!c)
          const fileLinkCount = (evt.notePaths?.length ?? 0) + (evt.diaryDates?.length ?? 0)
          return (
            <div
              key={evt.id}
              className={`cal-event ${highlightedEventId === evt.id ? 'cal-event-focused' : ''}`}
              onClick={() => onOpenEvent?.(evt)}
              role="button"
              tabIndex={0}
            >
              <div className="cal-event-title">{evt.title}</div>
              <div className="cal-event-time">
                {evt.allDay ? 'ALL DAY' : `${format(parseISO(evt.start), 'h:mm a')} - ${format(parseISO(evt.end), 'h:mm a')}`}
              </div>
              {evt.location && <div className="cal-event-loc">{evt.location}</div>}
              {linkedContacts.length > 0 && (
                <div className="cal-event-contacts">
                  <ContactNameList contacts={linkedContacts} onOpenContact={onOpenContact} />
                </div>
              )}
              {fileLinkCount > 0 && (
                <div className="cal-event-link-count">
                  {fileLinkCount} linked file{fileLinkCount !== 1 ? 's' : ''}
                </div>
              )}
              {(evt.tags?.length ?? 0) > 0 && (
                <div className="cal-event-tags">
                  {evt.tags!.map((t) => `#${t}`).join(' ')}
                </div>
              )}
              <button
                className="cal-event-delete"
                onClick={(e) => { e.stopPropagation(); requestDelete(evt) }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
        {selectedEvents.length === 0 && (
          <div className="cal-no-events">No events</div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="event-form-header">
              <h2>New Event</h2>
              <div className="event-form-date-nav">
                <button type="button" onClick={() => setFormDate((d) => subDays(d, 1))} aria-label="Previous day">
                  <ChevronLeft size={14} />
                </button>
                <span>{format(formDate, 'yyyy-MM-dd')}</span>
                <button type="button" onClick={() => setFormDate((d) => addDays(d, 1))} aria-label="Next day">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Time</label>
                <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} disabled={form.allDay} />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} disabled={form.allDay} />
              </div>
            </div>
            <div className="form-group form-group-checkbox">
              <label>
                <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
                All Day
              </label>
            </div>
            <div className="form-group">
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <ContactPickerField
              label="With"
              linkedContacts={withContacts}
              allContacts={allContacts}
              onAdd={addWithContact}
              onRemove={removeWithContact}
              onCreate={createWithContact}
            />

            <EventLinkSection
              title="Notes"
              icon={FileText}
              chips={withNotes.map((n) => ({ key: n.path, label: n.name }))}
              available={allNotesList
                .filter((n) => !withNotes.some((w) => w.path === n.path))
                .map((n) => ({ value: n.path, label: n.name }))}
              picked={pickNote}
              onPickedChange={setPickNote}
              onAdd={() => {
                const note = allNotesList.find((n) => n.path === pickNote)
                if (note) { addWithNote(note); setPickNote('') }
              }}
              onRemove={removeWithNote}
              emptyLabel="No notes linked"
              addPlaceholder="Add a note…"
            />

            <EventLinkSection
              title="Diary entries"
              icon={BookOpen}
              chips={withDiaryDates.map((d) => ({ key: d, label: d }))}
              available={allDiaryList
                .filter((d) => !withDiaryDates.includes(d))
                .map((d) => ({ value: d, label: d }))}
              picked={pickDiaryDate}
              onPickedChange={setPickDiaryDate}
              onAdd={() => {
                if (pickDiaryDate) { addWithDiaryDate(pickDiaryDate); setPickDiaryDate('') }
              }}
              onRemove={removeWithDiaryDate}
              emptyLabel="No diary entries linked"
              addPlaceholder="Add a diary entry…"
            />

            <div className="form-group event-form-tags">
              <label>Tags</label>
              {formTags.length > 0 && (
                <div className="event-form-tags-chips">
                  {formTags.map((tag) => (
                    <span key={tag} className="event-form-tag-chip">
                      #{tag}
                      <button type="button" onClick={() => removeFormTag(tag)} aria-label={`Remove ${tag}`}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                value={tagInput}
                placeholder="Add tag…"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (tagInput.trim()) addFormTag(tagInput)
                  }
                }}
                onBlur={() => { if (tagInput.trim()) addFormTag(tagInput) }}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.title.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete event"
        message={`Are you sure you want to delete "${pendingDelete?.title}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={!!pendingDiaryDelete}
        title="Delete diary entry"
        message={`Delete the diary entry for ${pendingDiaryDelete}? This cannot be undone.`}
        onConfirm={confirmDiaryDelete}
        onCancel={() => setPendingDiaryDelete(null)}
      />

    </div>
  )
}
