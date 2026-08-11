'use client'
import { useEffect, useState } from 'react'
import { T } from '@/lib/designTokens'
import { formatBytes } from '@/lib/images'

/**
 * The lodge's photographs as a LIST, not as a wall.
 *
 * The first version gave every picture a card with a large preview and
 * three open text fields. Twenty photographs was a page you scrolled
 * for a minute to find the one you wanted to fix — the full picture
 * repeated over and over, taking the space that should have been
 * showing you which photograph each row IS.
 *
 * A row is a line of text: a small thumbnail to recognise it by, its
 * description, and what state it is in. The fields appear when you
 * press Edit and fold away again when you are done, so at rest the
 * whole gallery fits on a screen.
 *
 * THE PICTURE IS STILL ONE TAP AWAY. Tapping the thumbnail opens it
 * full size — which is the actual reason anyone wanted the big preview,
 * and it is better served on demand than by twenty of them at once.
 */

export type ManagedPhoto = {
  id: string
  url: string
  thumb_url: string | null
  caption: string | null
  alt_text: string | null
  taken_on: string | null
  is_published: boolean
  width: number | null
  height: number | null
  bytes: number | null
}

export function GalleryRows({
  photos, busy, removing, onPatch, onMove, onDelete,
}: {
  photos: ManagedPhoto[]
  busy: string | null
  removing: string | null
  onPatch: (id: string, body: Record<string, unknown>, optimistic: Partial<ManagedPhoto>) => void
  onMove: (id: string, direction: -1 | 1) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [enlarged, setEnlarged] = useState<ManagedPhoto | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Escape closes the enlarged view, and the page behind it does not
  // scroll while it is open.
  useEffect(() => {
    if (!enlarged) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEnlarged(null) }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [enlarged])

  const smallLabel: React.CSSProperties = {
    fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.1em',
    color: T.inkFainter, textTransform: 'uppercase', marginBottom: '3px', display: 'block',
  }
  const input: React.CSSProperties = {
    width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink,
    padding: '7px 10px', borderRadius: '5px', fontFamily: T.body,
    fontSize: '16px', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <>
      <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, background: T.bgCard, overflow: 'hidden' }}>
        {photos.map((photo, i) => {
          const open = editing === photo.id
          return (
            <div
              key={photo.id}
              className={removing === photo.id ? 'lodgeos-removing' : undefined}
              style={{
                borderBottom: i === photos.length - 1 ? 'none' : `1px solid ${T.border}`,
                opacity: busy === photo.id ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {/* ------------------------------------------- the row */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.6rem 0.75rem' }}>
                <button
                  onClick={() => setEnlarged(photo)}
                  title="Click to enlarge"
                  aria-label={`Enlarge ${photo.caption || 'this photograph'}`}
                  style={{
                    padding: 0, border: `1px solid ${T.border}`, borderRadius: '4px',
                    background: T.bg, cursor: 'zoom-in', flexShrink: 0, lineHeight: 0,
                    position: 'relative',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Storage URL, not a static local asset */}
                  <img
                    src={photo.thumb_url || photo.url}
                    alt=""
                    style={{
                      width: 52, height: 52, objectFit: 'cover', display: 'block', borderRadius: '3px',
                      filter: photo.is_published ? 'none' : 'grayscale(1) opacity(0.45)',
                    }}
                  />
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: T.body, fontSize: '0.9rem',
                      color: photo.caption ? T.ink : T.inkFainter,
                      fontStyle: photo.caption ? 'normal' : 'italic',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {photo.caption || 'No description'}
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.06em', color: photo.is_published ? T.inkFainter : T.danger, marginTop: 2 }}>
                    {photo.is_published ? 'SHOWING' : 'HIDDEN'}
                    {photo.taken_on ? ` · ${monthOf(photo.taken_on)}` : ''}
                    {photo.width && photo.height ? ` · ${photo.width}×${photo.height}` : ''}
                    {photo.bytes ? ` · ${formatBytes(photo.bytes)}` : ''}
                    {/* Missing alt text is worth saying at rest, not
                        hidden behind Edit — it is the one field nobody
                        thinks to fill in and the only one a blind
                        visitor depends on. */}
                    {!photo.alt_text ? ' · NO ALT TEXT' : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                  <Tiny onClick={() => onMove(photo.id, -1)} disabled={i === 0} label="Move earlier">↑</Tiny>
                  <Tiny onClick={() => onMove(photo.id, 1)} disabled={i === photos.length - 1} label="Move later">↓</Tiny>
                  <Tiny onClick={() => setEditing(open ? null : photo.id)} tone={open ? T.gold : T.inkFaint} label="Edit">
                    {open ? 'Done' : 'Edit'}
                  </Tiny>
                </div>
              </div>

              {/* ------------------------------------ the fields */}
              {open && (
                <div className="lodgeos-stage-in" style={{ padding: '0 0.75rem 0.9rem', borderTop: `1px solid ${T.border}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem', marginTop: '0.8rem' }}>
                    <div>
                      <label style={smallLabel}>Description</label>
                      <input
                        defaultValue={photo.caption ?? ''}
                        placeholder="Installation night, 2025"
                        onBlur={e => e.target.value !== (photo.caption ?? '') &&
                          onPatch(photo.id, { caption: e.target.value }, { caption: e.target.value || null })}
                        style={input}
                      />
                    </div>
                    <div>
                      <label style={smallLabel}>Alt text — for screen readers</label>
                      <input
                        defaultValue={photo.alt_text ?? ''}
                        placeholder="What the photograph shows"
                        onBlur={e => e.target.value !== (photo.alt_text ?? '') &&
                          onPatch(photo.id, { altText: e.target.value }, { alt_text: e.target.value || null })}
                        style={input}
                      />
                    </div>
                    <div>
                      <label style={smallLabel}>Date taken</label>
                      <input
                        type="date"
                        defaultValue={photo.taken_on ?? ''}
                        onBlur={e => e.target.value !== (photo.taken_on ?? '') &&
                          onPatch(photo.id, { takenOn: e.target.value }, { taken_on: e.target.value || null })}
                        style={input}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                    <Tiny
                      onClick={() => onPatch(photo.id, { isPublished: !photo.is_published }, { is_published: !photo.is_published })}
                      tone={photo.is_published ? T.inkFaint : T.success}
                      label={photo.is_published ? 'Hide' : 'Show'}
                    >
                      {photo.is_published ? 'Hide from the site' : 'Show on the site'}
                    </Tiny>

                    {confirmDelete === photo.id ? (
                      <>
                        <Tiny onClick={() => { setConfirmDelete(null); onDelete(photo.id) }} tone={T.danger} label="Confirm delete">
                          Delete for good
                        </Tiny>
                        <Tiny onClick={() => setConfirmDelete(null)} tone={T.inkFaint} label="Keep">Keep it</Tiny>
                      </>
                    ) : (
                      <Tiny onClick={() => setConfirmDelete(photo.id)} tone={T.danger} label="Delete">Delete</Tiny>
                    )}
                  </div>

                  {confirmDelete === photo.id && (
                    <div style={{ fontFamily: T.body, fontSize: '0.86rem', color: T.danger, marginTop: '0.5rem' }}>
                      This removes the file itself. To take it off the site only, hide it — that can
                      be undone.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ----------------------------------------------- enlarged */}
      {enlarged && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={enlarged.caption || 'Photograph'}
          onClick={() => setEnlarged(null)}
          className="lodgeos-dialog-in"
          style={{
            position: 'fixed', inset: 0, zIndex: 350, background: 'rgba(6,10,17,0.94)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setEnlarged(null)}
            aria-label="Close"
            style={{
              position: 'absolute', top: 10, right: 14, background: 'none', border: 'none',
              color: T.gold, fontSize: '2rem', lineHeight: 1, cursor: 'pointer', padding: '8px 12px',
            }}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Storage URL, not a static local asset */}
          <img
            src={enlarged.url}
            alt={enlarged.alt_text || enlarged.caption || 'Lodge photograph'}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 'min(100%, 1100px)', maxHeight: '80vh', objectFit: 'contain', cursor: 'default' }}
          />
          <div style={{ marginTop: '0.9rem', textAlign: 'center', maxWidth: 620 }}>
            {enlarged.caption && (
              <div style={{ fontFamily: T.body, fontSize: '1rem', color: T.ink }}>{enlarged.caption}</div>
            )}
            <div style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.12em', color: T.inkFainter, marginTop: 5 }}>
              {enlarged.is_published ? 'SHOWING ON THE SITE' : 'HIDDEN FROM THE SITE'}
              {enlarged.taken_on ? ` · ${monthOf(enlarged.taken_on)}` : ''}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Tiny({
  children, onClick, tone = T.inkFaint, disabled, label,
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: string
  disabled?: boolean
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '4px',
        color: tone, fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em',
        textTransform: 'uppercase', padding: '6px 9px', whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
      }}
    >
      {children}
    </button>
  )
}

/** "June 2025" — a photograph is placed by month, not by day. */
export function monthOf(date: string): string {
  const d = new Date(date + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
