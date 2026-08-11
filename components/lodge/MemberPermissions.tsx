'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { DegreeOptions } from '@/components/DegreeOptions'
import { callApi, errorMessage } from '@/lib/clientFetch'
import { degreeLabel } from '@/lib/degrees'
import {
  CAPABILITIES, CAPABILITY_META, roleLabel, tierGrants, grantedTiers,
  type Capability, type CapabilityOverrides,
} from '@/lib/auth/permissions'
import type { TenantRole } from '@/lib/auth/requireTenantAdmin'

/**
 * What this brother may do, changed here rather than in a spreadsheet
 * of tiers somebody has to remember.
 *
 * THREE THINGS, IN THE ORDER AN OFFICER THINKS OF THEM.
 *
 * His TIER is the rule — eight of them, each a shorthand for a bundle
 * of tools, and right for most men most of the time.
 *
 * His EXCEPTIONS are where a real lodge stops matching the bundle. The
 * Junior Deacon who keeps the document library, the Chaplain who sends
 * the sick-and-distressed notice, the Warden covering the Treasurer's
 * chair until December. Before this the answer to each was to promote
 * the man a whole tier — handing him six things to fix one.
 *
 * His DEGREE is here because it is the other thing that governs what he
 * can reach: documents have a degree floor, and some work is not put in
 * front of a candidate. It has only ever been editable from a dropdown
 * in the roster table, which is not where anyone looks for it.
 *
 * EVERY CONTROL SHOWS WHAT THE TIER WOULD SAY, next to what is actually
 * set. A permissions screen that shows only the answer, and not whether
 * the answer was inherited or chosen, is one nobody dares change.
 */

type Props = {
  tenantId: string
  memberId: string
  memberName: string
  tenantRole: TenantRole
  degree: string | null
  overrides: CapabilityOverrides
  /** Admin, Secretary or Grand Master — the fixed tier that may set
   *  tiers and exceptions. Not itself delegable; see the API route. */
  canSetPermissions: boolean
  /** The 'roster' capability, which IS delegable. */
  canEditDegree: boolean
  /** Nobody edits his own — there would be no one left to undo it. */
  isSelf: boolean
  /** A platform administrator's access does not come from this lodge,
   *  so nothing set here changes what he can do. Say so plainly. */
  isPlatformAdmin: boolean
}

const ROLE_BLURB: Record<TenantRole, string> = {
  admin: 'Everything, including these permissions.',
  secretary: 'Everything. The lodge’s administrative office.',
  grand_master: 'Everything. Outranks every officer of this lodge when he visits.',
  worshipful_master: 'Meetings, events, notices, giving out work; reads the finances.',
  treasurer: 'The finances in full, and meetings; reads the roster.',
  warden: 'Meetings, attendance, giving out work.',
  deacon: 'Attendance and degree progress.',
  member: 'The portal only — his own dues, his own work, the notices.',
}

const ROLE_ORDER: TenantRole[] = [
  'member', 'deacon', 'warden', 'treasurer', 'worshipful_master',
  'secretary', 'grand_master', 'admin',
]

export function MemberPermissions({
  tenantId, memberId, memberName, tenantRole, degree, overrides,
  canSetPermissions, canEditDegree, isSelf, isPlatformAdmin,
}: Props) {
  const router = useRouter()
  const [role, setRole] = useState<TenantRole>(tenantRole)
  const [deg, setDeg] = useState(degree ?? 'MM')
  const [ex, setEx] = useState<CapabilityOverrides>(overrides)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const flash = (message: string) => {
    setSaved(message)
    setTimeout(() => setSaved(''), 2600)
  }

  /**
   * Optimistic, then reverted on failure. These are toggles and
   * dropdowns and they should feel instant — but a control that
   * silently keeps the new value after the write was refused is how an
   * officer comes to believe he delegated something he did not.
   */
  const save = async (key: string, body: Record<string, unknown>, revert: () => void, ok: string) => {
    setBusy(key)
    setError('')
    setSaved('')
    try {
      await callApi('/api/members/permissions', {
        method: 'PATCH',
        body: { tenantId, memberId, ...body },
      })
      flash(ok)
      // The nav, the page guards and every route read this — refresh so
      // a change made here is visible everywhere without a reload.
      router.refresh()
    } catch (e) {
      revert()
      setError(errorMessage(e, 'That could not be saved.'))
    } finally {
      setBusy(null)
    }
  }

  const setCapability = (capability: Capability, value: boolean | null) => {
    const previous = ex[capability]
    setEx((p) => {
      const next = { ...p }
      if (value === null) delete next[capability]
      else next[capability] = value
      return next
    })
    save(
      capability,
      { capability, granted: value },
      () => setEx((p) => {
        const next = { ...p }
        if (previous === undefined) delete next[capability]
        else next[capability] = previous
        return next
      }),
      value === null
        ? `${CAPABILITY_META[capability].label} now follows his tier.`
        : value
          ? `${CAPABILITY_META[capability].label} allowed.`
          : `${CAPABILITY_META[capability].label} taken away.`
    )
  }

  const card: React.CSSProperties = {
    background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: T.radius, padding: '1.25rem', marginBottom: '1rem',
  }
  const eyebrow: React.CSSProperties = {
    fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.14em',
    color: T.gold, textTransform: 'uppercase', marginBottom: '6px',
  }
  const help: React.CSSProperties = {
    fontFamily: T.body, fontSize: '0.86rem', color: T.inkFaint, margin: '0 0 1rem',
  }
  const select: React.CSSProperties = {
    background: T.bgPanel, border: `1px solid ${T.borderStrong}`, borderRadius: '6px',
    color: T.ink, fontFamily: T.body, fontSize: '0.9rem', padding: '9px 12px',
    width: '100%', maxWidth: 380, cursor: 'pointer',
  }

  const locked = !canSetPermissions || isSelf

  return (
    <div>
      {isPlatformAdmin && (
        <Banner tone="info">
          {memberName} is a platform administrator. His access does not come from
          this lodge, so nothing set here restricts him.
        </Banner>
      )}

      {isSelf && (
        <Banner tone="info">
          These are your own permissions, and you cannot change them yourself — if
          you took something away by mistake there would be nobody left who could
          give it back. Ask another Secretary-tier officer.
        </Banner>
      )}

      {!canSetPermissions && !isSelf && (
        <Banner tone="info">
          Only the Secretary, an admin or the Grand Master may change what a
          brother is allowed to do. You can see it here.
        </Banner>
      )}

      {error && <Banner tone="danger">{error}</Banner>}
      {saved && <Banner tone="success">{saved}</Banner>}

      {/* ---------------------------------------------------------- */}
      <div style={card}>
        <div style={eyebrow}>Permission tier</div>
        <p style={help}>
          The rule. Most brothers need nothing beyond the right tier — set that
          first, and use the exceptions below only where this lodge genuinely
          differs from it.
        </p>
        <select
          value={role}
          disabled={locked || busy === 'role'}
          aria-label={`Permission tier for ${memberName}`}
          onChange={(e) => {
            const next = e.target.value as TenantRole
            const previous = role
            setRole(next)
            save('role', { tenantRole: next }, () => setRole(previous), `${memberName} is now ${roleLabel(next)}.`)
          }}
          style={{ ...select, opacity: locked ? 0.6 : 1, cursor: locked ? 'not-allowed' : 'pointer' }}
        >
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>{roleLabel(r)} — {ROLE_BLURB[r]}</option>
          ))}
        </select>
        <div style={{ fontFamily: T.body, fontSize: '0.86rem', color: T.inkFainter, marginTop: '8px' }}>
          {ROLE_BLURB[role]}
        </div>
      </div>

      {/* ---------------------------------------------------------- */}
      <div style={card}>
        <div style={eyebrow}>Degree</div>
        <p style={help}>
          What he has taken. Documents can be held to a degree, and this is what
          they are held against.
        </p>
        <select
          value={deg}
          disabled={!canEditDegree || busy === 'degree'}
          aria-label={`Degree for ${memberName}`}
          onChange={(e) => {
            const next = e.target.value
            const previous = deg
            setDeg(next)
            save('degree', { degree: next }, () => setDeg(previous), `Recorded as ${degreeLabel(next)}.`)
          }}
          style={{ ...select, opacity: canEditDegree ? 1 : 0.6, cursor: canEditDegree ? 'pointer' : 'not-allowed' }}
        >
          <DegreeOptions />
        </select>
      </div>

      {/* ---------------------------------------------------------- */}
      <div style={card}>
        <div style={eyebrow}>What he can reach</div>
        <p style={help}>
          Each of these follows his tier unless you say otherwise. An exception
          set here is real — it is what the server checks, not just what the
          menu shows — and it moves with him if his tier changes only when you
          leave it on <em>Follows his tier</em>.
        </p>

        <div style={{ display: 'grid', gap: '10px' }}>
          {CAPABILITIES.map((c) => {
            const byTier = tierGrants(role, c)
            const setting = ex[c]
            const effective = setting === undefined ? byTier : setting
            const meta = CAPABILITY_META[c]
            return (
              <div
                key={c}
                style={{
                  border: `1px solid ${setting === undefined ? T.border : T.borderStrong}`,
                  background: setting === undefined ? 'transparent' : 'rgba(201,168,76,0.05)',
                  borderRadius: '8px', padding: '0.85rem 1rem',
                  opacity: busy === c ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: T.display, fontSize: '0.92rem', color: T.ink }}>{meta.label}</span>
                      <span style={{
                        fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.1em',
                        padding: '2px 7px', borderRadius: '20px',
                        color: effective ? T.success : T.inkFainter,
                        background: effective ? T.successDim : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${effective ? 'rgba(93,190,133,0.3)' : T.border}`,
                      }}>
                        {effective ? 'ALLOWED' : 'NOT ALLOWED'}
                      </span>
                      {setting !== undefined && (
                        <span style={{ fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.1em', color: T.gold }}>
                          SET FOR HIM
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: T.body, fontSize: '0.86rem', color: T.inkFaint, marginTop: '3px' }}>
                      {meta.blurb}
                    </div>
                    {/* The tier's own answer, always visible. Without it
                        nobody can tell an inherited permission from a
                        deliberate one, and so nobody touches either. */}
                    <div style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em', color: T.inkFainter, marginTop: '5px' }}>
                      {roleLabel(role).toUpperCase()}: {byTier ? 'ALLOWED BY TIER' : 'NOT IN THIS TIER'}
                      {' · '}
                      {grantedTiers(c).map((r) => roleLabel(r)).join(', ')}
                    </div>
                  </div>

                  <Segmented
                    disabled={locked || busy === c}
                    value={setting === undefined ? 'tier' : setting ? 'yes' : 'no'}
                    onChange={(v) => setCapability(c, v === 'tier' ? null : v === 'yes')}
                    label={`${meta.label} for ${memberName}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Follows his tier / Allowed / Not allowed — the three real answers. */
function Segmented({
  value, onChange, disabled, label,
}: {
  value: 'tier' | 'yes' | 'no'
  onChange: (v: 'tier' | 'yes' | 'no') => void
  disabled: boolean
  label: string
}) {
  const options: { v: 'tier' | 'yes' | 'no'; text: string; tone: string }[] = [
    { v: 'tier', text: 'Follows his tier', tone: T.inkFaint },
    { v: 'yes', text: 'Allow', tone: T.success },
    { v: 'no', text: 'Deny', tone: T.danger },
  ]
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', border: `1px solid ${T.border}`, borderRadius: '6px', overflow: 'hidden' }}>
      {options.map((o) => {
        const on = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => !on && onChange(o.v)}
            style={{
              background: on ? 'rgba(201,168,76,0.14)' : 'transparent',
              border: 'none', borderRight: `1px solid ${T.border}`,
              color: on ? o.tone : T.inkFainter,
              fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.08em',
              padding: '9px 12px', cursor: disabled ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {o.text.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

function Banner({ tone, children }: { tone: 'info' | 'danger' | 'success'; children: React.ReactNode }) {
  const colors = {
    info: { bg: T.infoDim, border: 'rgba(123,184,212,0.3)', text: T.info },
    danger: { bg: T.dangerDim, border: 'rgba(231,76,60,0.3)', text: T.danger },
    success: { bg: T.successDim, border: 'rgba(93,190,133,0.3)', text: T.success },
  }[tone]
  return (
    <div style={{
      background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
      padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem',
      fontFamily: T.body, fontSize: '0.9rem',
    }}>
      {children}
    </div>
  )
}
