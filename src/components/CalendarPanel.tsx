import { useState, useEffect, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths,
  startOfWeek, endOfWeek, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2, BookOpen } from 'lucide-react'
import { resolveDiaryPath } from '@cortex/core'
import type { CalendarEvent } from '../types'
import ConfirmDialog from './ConfirmDialog'
import './CalendarPanel.css'

interface CalendarPanelProps {
  onError: (msg: string) => void
  onRefresh?: () => void
  onCloseDiaryEntry?: (dateStr: string) => void
  focusEvent?: CalendarEvent | null
  onClearFocusEvent?: () => void
  onOpenDiaryEntry?: (dateStr: string) => void
  diaryRefreshKey?: number
  fileRefreshKey?: number
}

export default function CalendarPanel({ onError, onRefresh, onCloseDiaryEntry, focusEvent, onClearFocusEvent, onOpenDiaryEntry, diaryRefreshKey, fileRefreshKey }: CalendarPanelProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', start: '09:00', end: '10:00', allDay: false, location: '', notes: '' })
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

  // Re-fetch diary dates immediately when a new diary entry is opened/created
  useEffect(() => {
    if (diaryRefreshKey === undefined) return
    loadDiaryDates()
  }, [diaryRefreshKey, loadDiaryDates])

  // Re-sync diary dates when any file changes (covers deletion from file browser)
  useEffect(() => {
    if (fileRefreshKey === undefined) return
    loadDiaryDates()
  }, [fileRefreshKey, loadDiaryDates])

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
    events.filter((e) => isSameDay(parseISO(e.start), day))

  const selectedEvents = dayEvents(selectedDate)
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const selectedHasDiary = diaryDates.has(selectedDateStr)

  const handleCreate = async () => {
    if (!form.title.trim()) return
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
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
      })
      setShowForm(false)
      setForm({ title: '', start: '09:00', end: '10:00', allDay: false, location: '', notes: '' })
      loadEvents()
    } catch {
      onError('Failed to create event')
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
          <span>{format(selectedDate, 'EEEE, MMM d')}</span>
          <button className="cal-add-btn" onClick={() => setShowForm(true)}>
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

        {selectedEvents.map((evt) => (
          <div
            key={evt.id}
            className={`cal-event ${highlightedEventId === evt.id ? 'cal-event-focused' : ''}`}
          >
            <div className="cal-event-title">{evt.title}</div>
            <div className="cal-event-time">
              {evt.allDay ? 'All day' : format(parseISO(evt.start), 'h:mm a')}
            </div>
            {evt.location && <div className="cal-event-loc">{evt.location}</div>}
            <button className="cal-event-delete" onClick={() => requestDelete(evt)}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {selectedEvents.length === 0 && !selectedHasDiary && (
          <div className="cal-no-events">No events</div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Event</h2>
            <div className="form-group">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start</label>
                <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} disabled={form.allDay} />
              </div>
              <div className="form-group">
                <label>End</label>
                <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} disabled={form.allDay} />
              </div>
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
                {' '}All day
              </label>
            </div>
            <div className="form-group">
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
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
