'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/designTokens'
import { callApi, errorMessage } from '@/lib/clientFetch'
import { notify } from '@/lib/toast'
import { defaultDuties, officeAnchor, isStation } from '@/lib/duties'

/**
 * What every chair in the lodge is responsible for.
 *
 * WRITTEN FOR THE MAN WHO HAS JUST BEEN APPOINTED. A brother made
 * Junior Steward in December currently has no way to find out what he
 * has agreed to do — the lodge knows, in the heads of the men who have
 * done it before, and that is not somewhere he can look.
 *
 * OPEN TO EVERY BROTHER TO READ. Who does what is not officers'
 * business kept from the craft, and a man ought to be able to see what
 * the Tyler is for without asking permission first.
 *
 * THE SHIPPED TEXT IS MARKED AS SHIPPED. Duties differ by jurisdiction
 * and by a lodge's own bylaws, and an application is not an authority
 * on what a Grand Lodge expects — so a description nobody here has
 * approved says so, rather than passing itself off as the lodge's own
 * word.
 */

type Duty = {
  lodgeRole: string
  /** Null when the lodge has not written its own. */
  custom: string | null
  updatedByName: string | null
  holders: string[]
}

export function DutiesBoard({
  tenantId, slug, duties: initial, canEdit, openOffice, showPermissionsLink = true,
}: {
  tenantId: string
  slug: string
  duties: Duty[]
  canEdit: boolean
  /** Off in the portal: a plain member cannot open that page, and a
   *  link to somewhere he will be redirected away from is worse than
   *  no link at all. */
  showPermissionsLink?: boolean
  /** ?office=Senior+Warden — a link straight to one chair. */
  openOffice?: string
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    openOffice ? { [openOffice]: true } : {}
  )

  /**
   * A link that names an office opens it and scrolls to it. Landing at
   * the top of seventeen offices and being expected to find the one you
   * were sent to is not arriving anywhere.
   */
  useEffect(() => {
    if (!openOffice) return
    const el = document.getElementById(officeAnchor(openOffice))
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [openOffice])

  const textFor = (d: Duty) => d.custom ?? defaultDuties(d.lodgeRole)

  const startEdit = (d: Duty) => {
    setEditing(d.lodgeRole)
    // Seeded with whatever is showing, so "edit" means adjusting the
    // words in front of him rather than facing an empty box.
    setDraft(textFor(d))
    setExpanded(e => ({ ...e, [d.lodgeRole]: true }))
    setError('')
  }

  const save = async (office: string, text: string) => {
    setBusy(true)
    setError('')
    try {
      const data = await callApi('/api/duties', {
        method: 'PATCH',
        body: { tenantId, lodgeRole: office, duties: text },
      })
      setRows(rs => rs.map(r =>
        r.lodgeRole === office
          ? { ...r, custom: data.custom ? data.duties : null, updatedByName: data.custom ? 'you' : null }
          : r
      ))
      setEditing(null)
      notify.saved(data.custom ? `${office}'s duties saved` : `${office}'s duties reset to the standard text`)
      router.refresh()
    } catch (e) {
      const message = errorMessage(e, 'Those duties could not be saved.')
      setError(message)
      notify.error(message)
    } finally {
      setBusy(false)
    }
  }

  const card: React.CSSProperties = {
    background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius,
  }

  return (
    <div style={{ minWidth: 0 }}>
      {error && (
        <div style={{ background: T.dangerDim, border: '1px solid rgba(231,76,60,0.3)', color: T.danger, padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem', fontFamily: T.body, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {!canEdit && showPermissionsLink && (
        <div style={{ background: T.infoDim, border: '1px solid rgba(123,184,212,0.3)', color: T.info, padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem', fontFamily: T.body, fontSize: '0.9rem' }}>
          Anyone may read these. Changing them is for an admin, the Worshipful Master or the
          Senior Warden.
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {rows.map(d => {
          const open = !!expanded[d.lodgeRole]
          const isEditing = editing === d.lodgeRole
          const text = textFor(d)
          return (
            <div key={d.lodgeRole} id={officeAnchor(d.lodgeRole)} style={card}>
              <button
                onClick={() => setExpanded(e => ({ ...e, [d.lodgeRole]: !open }))}
                aria-expanded={open}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                  padding: '0.9rem 1rem', cursor: 'pointer',
                  display: 'flex', gap: '0.75rem', alignItems: 'center',
                }}
              >
                <span style={{ color: T.gold, fontFamily: T.mono, fontSize: '11px', width: 12, flexShrink: 0 }}>
                  {open ? '▾' : '▸'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: T.display, fontSize: '0.98rem', color: T.ink }}>
                    {d.lodgeRole}
                  </span>
                  <span style={{ display: 'block', fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.06em', color: d.holders.length ? T.gold : T.inkFainter, marginTop: 2 }}>
                    {d.holders.length ? d.holders.join(', ').toUpperCase() : 'VACANT'}
                    {!isStation(d.lodgeRole) ? ' · NOT SEATED IN THE LODGE ROOM' : ''}
                    {d.custom ? ' · THIS LODGE’S OWN WORDING' : ''}
                  </span>
                </span>
              </button>

              {open && (
                <div className="lodgeos-stage-in" style={{ padding: '0 1rem 1rem', borderTop: `1px solid ${T.border}` }}>
                  {isEditing ? (
                    <>
                      <textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        rows={9}
                        disabled={busy}
                        style={{
                          width: '100%', marginTop: '0.9rem', background: T.bg,
                          border: `1px solid ${T.borderStrong}`, color: T.ink, padding: '11px 13px',
                          borderRadius: '6px', fontFamily: T.body, fontSize: '16px',
                          lineHeight: 1.6, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.7rem' }}>
                        <button
                          onClick={() => save(d.lodgeRole, draft)}
                          disabled={busy}
                          style={{
                            background: T.gold, color: T.bg, border: 'none', padding: '10px 22px',
                            borderRadius: '6px', fontFamily: T.display, fontSize: '0.82rem', fontWeight: 700,
                            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                          }}
                        >
                          {busy ? 'Saving…' : 'Save duties'}
                        </button>
                        <Small onClick={() => setEditing(null)} disabled={busy}>Cancel</Small>
                        {/* Clearing the box is the reset, and it says so
                            rather than leaving an officer to guess that
                            an empty field means "use the standard one". */}
                        {d.custom && (
                          <Small onClick={() => save(d.lodgeRole, '')} disabled={busy} tone={T.danger}>
                            Back to the standard text
                          </Small>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontFamily: T.body, fontSize: '0.98rem', color: T.inkFaint, lineHeight: 1.7, margin: '0.9rem 0 0', whiteSpace: 'pre-wrap' }}>
                        {text || 'Nothing has been written for this office yet.'}
                      </p>

                      <div style={{ fontFamily: T.body, fontSize: '0.82rem', color: T.inkFainter, marginTop: '0.7rem', fontStyle: 'italic' }}>
                        {d.custom
                          ? `Written by this lodge${d.updatedByName ? ` — last changed by ${d.updatedByName}` : ''}.`
                          : 'A general description, not this lodge’s own wording. Duties differ by jurisdiction and by bylaw — edit it to match what your lodge actually expects.'}
                      </div>

                      {canEdit && (
                        <div style={{ marginTop: '0.7rem' }}>
                          <Small onClick={() => startEdit(d)}>Edit these duties</Small>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showPermissionsLink && (
        <div style={{ marginTop: '1.5rem', fontFamily: T.body, fontSize: '0.86rem', color: T.inkFainter }}>
          Who sits where is set on each brother&rsquo;s profile, and what each chair can reach in the
          app is on the{' '}
          <Link href={`/lodge/${slug}/permissions`} style={{ color: T.gold }}>Permissions page</Link>.
        </div>
      )}
    </div>
  )
}

function Small({
  children, onClick, disabled, tone = T.inkFaint,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '4px',
        color: tone, fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em',
        textTransform: 'uppercase', padding: '7px 11px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}
