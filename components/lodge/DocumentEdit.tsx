'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { notify } from '@/lib/toast'
import { callApi, errorMessage } from '@/lib/clientFetch'
import { DegreeOptions } from '@/components/DegreeOptions'

/**
 * Correcting what a document says about itself.
 *
 * THE LIBRARY WAS WRITE-ONCE. A file uploaded as "scan_0042" with the
 * wrong degree floor could only be deleted and uploaded again — which
 * throws away its version history and its place in a curriculum, and
 * means a typo costs a record. Four fields are worth fixing after the
 * fact, and none of them is the file.
 *
 * THE FILE IS NOT EDITABLE HERE, deliberately. Swapping the contents
 * of a document under a name the lodge already trusts is how "the
 * bylaws" quietly become something else. The honest way is already in
 * the app: upload the new version and name what it supersedes, which
 * keeps both and records the succession.
 *
 * Only changed fields are sent, so the audit trail names the field
 * that moved rather than claiming the whole record was rewritten.
 */

const CATEGORIES = ['Degree Materials', 'Minutes', 'Administration', 'Grand Lodge', 'Training', 'Other']

export function DocumentEditButton({
  document: doc,
}: {
  document: {
    id: string
    name: string
    description?: string | null
    category?: string | null
    access_level?: string | null
  }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(doc.name ?? '')
  const [description, setDescription] = useState(doc.description ?? '')
  const [category, setCategory] = useState(doc.category ?? 'Other')
  const [accessLevel, setAccessLevel] = useState(doc.access_level ?? 'all')

  useEffect(() => setMounted(true), [])

  // Reopening after a cancel must not show yesterday's half-typed
  // edit — the dialog opens on what the library currently says.
  const start = () => {
    setName(doc.name ?? '')
    setDescription(doc.description ?? '')
    setCategory(doc.category ?? 'Other')
    setAccessLevel(doc.access_level ?? 'all')
    setError('')
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) setOpen(false) }
    const previous = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.document.body.style.overflow = previous
    }
  }, [open, saving])

  const dirty =
    name.trim() !== (doc.name ?? '') ||
    description.trim() !== (doc.description ?? '') ||
    category !== (doc.category ?? 'Other') ||
    accessLevel !== (doc.access_level ?? 'all')

  const floorMoved = accessLevel !== (doc.access_level ?? 'all')

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('A document needs a name.'); return }
    setSaving(true)
    setError('')
    try {
      await callApi(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        body: { name, description, category, accessLevel },
      })
      setOpen(false)
      notify.saved('Document updated')
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, 'Those changes could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', background: T.bg, border: `1px solid ${T.borderStrong}`, color: T.ink,
    padding: '9px 12px', fontFamily: T.body,
    // 16px, or iOS zooms the page the moment a field is focused.
    fontSize: '16px', outline: 'none', borderRadius: 4, boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.15em', color: T.gold,
    textTransform: 'uppercase' as const, marginBottom: 4, display: 'block',
  }

  const dialog = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${doc.name}`}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(6,10,17,0.78)', zIndex: 310,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
      onClick={() => { if (!saving) setOpen(false) }}
    >
      <form
        onSubmit={save}
        onClick={e => e.stopPropagation()}
        className="lodgeos-dialog-in"
        style={{
          background: T.bgCard, border: `1px solid ${T.borderStrong}`, borderRadius: 8,
          padding: '1.6rem', width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.16em', color: T.gold, textTransform: 'uppercase' }}>
              Edit details
            </div>
            <h2 style={{ fontFamily: T.display, fontSize: '1.1rem', color: T.ink, margin: '4px 0 0' }}>
              {doc.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: T.inkFaint, fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        <div>
          <label style={labelStyle} htmlFor={`doc-name-${doc.id}`}>Name</label>
          <input
            id={`doc-name-${doc.id}`}
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
            maxLength={200}
          />
        </div>

        <div>
          <label style={labelStyle} htmlFor={`doc-desc-${doc.id}`}>Description</label>
          <textarea
            id={`doc-desc-${doc.id}`}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="What it is for. Optional."
            style={{ ...inputStyle, resize: 'vertical' }}
            maxLength={2000}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <label style={labelStyle} htmlFor={`doc-cat-${doc.id}`}>Category</label>
            <select
              id={`doc-cat-${doc.id}`}
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={inputStyle}
            >
              {/* A category typed in by an import stays selectable
                  rather than being silently rewritten to Other. */}
              {(CATEGORIES.includes(category) ? CATEGORIES : [category, ...CATEGORIES]).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <label style={labelStyle} htmlFor={`doc-deg-${doc.id}`}>Open to</label>
            <select
              id={`doc-deg-${doc.id}`}
              value={accessLevel}
              onChange={e => setAccessLevel(e.target.value)}
              style={inputStyle}
            >
              {/* mode="access" leads with "All Brothers" and reads
                  "… and above", because a degree here is a floor —
                  the same component the upload form uses. */}
              <DegreeOptions mode="access" />
            </select>
          </div>
        </div>

        {/* The one field here that changes who may read the document.
            Saying so before the save is cheaper than finding out from
            the audit trail afterwards. */}
        {floorMoved && (
          <div
            style={{
              borderLeft: `3px solid ${T.gold}`, background: T.goldDim,
              padding: '0.6rem 0.8rem', borderRadius: '0 4px 4px 0',
              fontFamily: T.body, fontSize: '0.9rem', color: T.inkFaint, lineHeight: 1.5,
            }}
          >
            {accessLevel === 'all'
              ? 'This will open the document to every brother of the lodge.'
              : 'This changes who may open it. A brother below that degree will no longer see it listed.'}
          </div>
        )}

        {error && (
          <div style={{ color: T.danger, fontFamily: T.body, fontSize: '0.9rem' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="submit"
            className="btn-gold"
            disabled={saving || !dirty}
            style={{ opacity: saving || !dirty ? 0.55 : 1 }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={saving}
            style={{
              background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4,
              color: T.inkFaint, fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', padding: '8px 12px', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          {/* Why the button is inert, rather than leaving him pressing
              it — the same fix the delete confirmation needed. */}
          {!dirty && !saving && (
            <span style={{ fontFamily: T.mono, fontSize: '0.55rem', letterSpacing: '0.08em', color: T.inkFainter, textTransform: 'uppercase' }}>
              Nothing changed yet
            </span>
          )}
        </div>

        <p style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: '0.84rem', color: T.inkFainter, margin: 0 }}>
          This changes what the library says about the document, not the file itself. To replace the
          file, upload the new version and name this one as what it supersedes — that keeps both.
        </p>
      </form>
    </div>
  ) : null

  return (
    <>
      <button
        onClick={start}
        title={`Edit ${doc.name}`}
        aria-label={`Edit ${doc.name}`}
        style={{
          fontFamily: T.mono, fontSize: '0.58rem', color: T.inkFaint,
          background: 'transparent', border: `1px solid ${T.border}`,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Edit
      </button>
      {mounted && dialog ? createPortal(dialog, window.document.body) : null}
    </>
  )
}
