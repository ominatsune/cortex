import { useState, useEffect, useCallback } from 'react'
import { Plus, User, Trash2 } from 'lucide-react'
import { UNTITLED_CONTACT } from '@cortex/core'
import type { Contact } from '../types'
import ConfirmDialog from './ConfirmDialog'
import './ContactsList.css'

interface ContactsListProps {
  selected: Contact | null
  onSelect: (contact: Contact | null) => void
  refreshKey: number
  onRefresh: () => void
  onError: (msg: string) => void
}

function contactCompanyLabel(company: string | undefined): string | null {
  if (!company) return null
  const trimmed = company.trim()
  if (!trimmed || trimmed.toLowerCase() === 'none') return null
  return trimmed
}

export default function ContactsList({
  selected,
  onSelect,
  refreshKey,
  onRefresh,
  onError,
}: ContactsListProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await window.cortex.contacts.list()
      setContacts(data)
    } catch {
      onError('Failed to load contacts')
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const handleCreate = async () => {
    try {
      const contact = await window.cortex.contacts.create({
        name: UNTITLED_CONTACT,
        tags: [],
      })
      onRefresh()
      onSelect(contact)
    } catch {
      onError('Failed to create contact')
    }
  }

  const requestDelete = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDelete(contact)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await window.cortex.contacts.delete(pendingDelete.id)
      if (selected?.id === pendingDelete.id) onSelect(null)
      onRefresh()
    } catch {
      onError('Failed to delete contact')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="contacts-list">
      <div className="contacts-actions">
        <button className="fb-action-btn" onClick={handleCreate}>
          <Plus size={14} /> Contact
        </button>
      </div>
      <div className="contacts-items">
        {contacts.map((c) => {
          const company = contactCompanyLabel(c.company)
          return (
          <button
            key={c.id}
            className={`contact-item ${selected?.id === c.id ? 'active' : ''}`}
            onClick={() => onSelect(c)}
          >
            <User size={14} />
            <div className="contact-info">
              <span className="contact-name">{c.name || UNTITLED_CONTACT}</span>
              {company && <span className="contact-company">{company}</span>}
            </div>
            <span className="tree-delete" onClick={(e) => requestDelete(c, e)} role="button" tabIndex={0}>
              <Trash2 size={12} />
            </span>
          </button>
          )
        })}
        {contacts.length === 0 && (
          <div className="file-browser-empty">No contacts yet</div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete contact"
        message={`Are you sure you want to delete "${pendingDelete?.name}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
