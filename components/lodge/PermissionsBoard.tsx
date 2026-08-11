'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { callApi, errorMessage } from '@/lib/clientFetch'
import { notify } from '@/lib/toast'
import { ALL_OFFICES } from '@/lib/stations'
import {
  CAPABILITIES, CAPABILITY_META, SOURCE_LABEL, roleLabel, resolveCapability,
  type Capability, type CapabilityOverrides, type CapabilitySource,
} from '@/lib/auth/permissions'
import type { TenantRole } from '@/lib/auth/requireTenantAdmin'

/**
 * The lodge's table of authority, on one page.
 *
 * TWO QUESTIONS, TWO VIEWS, because officers ask both and they have
 * different answers:
 *
 * BY OFFICE — "what does the Junior Deacon's chair carry?" This is the
 * one a lodge actually decides, and the one that survives December.
 * Offices move at the annual handover; a permission attached to the
 * chair moves with them, and nobody has to remember to strip it off
 * the outgoing officer. Attach it to the man and that is exactly what
 * somebody has to remember, every year, for every office.
 *
 * BY BROTHER — "so what can Bro. Powell actually do?", which is the
 * question you have when a man says something is not working. It shows
 * the answer AND where the answer came from, because a permission you
 * cannot trace is one nobody can undo.
 *
 * THE GRID SCROLLS SIDEWAYS ON A PHONE and does not drag the page with
 * it. That needs min-width:0 on the flex/grid parent as well as
 * overflow-x on the scroller — without it the widest cell pushes the
 * whole document wide and every page on the site gains a horizontal
 * scrollbar. This has bitten this codebase before.
 */

type MemberRow = {
  userId: string
  name: string
  tenantRole: TenantRole
  lodgeRole: string | null
  memberOverrides: CapabilityOverrides
  isPlatformAdmin: boolean
}

export function PermissionsBoard({
  slug, tenantId, offices, members, canEdit,
}: {
  slug: string
  tenantId: string
  /** Every office with a setting, plus every office someone holds. */
  offices: Record<string, CapabilityOverrides>
  members: MemberRow[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [view, setView] = useState<'office' | 'brother'>('office')
  const [grid, setGrid] = useState<Record<string, CapabilityOverrides>>(offices)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  /**
   * Every office worth showing: the canonical list, plus anything this
   * lodge has actually typed or already set. An office a lodge invented
   * must not vanish from the page that governs it.
   */
  const officeNames = Array.from(new Set([
    ...ALL_OFFICES,
    ...Object.keys(grid),
    ...members.map(m => (m.lodgeRole ?? '').trim()).filter(Boolean),
  ]))

  const holdersOf = (office: string) =>
    members.filter(m => (m.lodgeRole ?? '').trim() === office)

  const cycle = (current: boolean | undefined): boolean | null =>
    current === undefined ? true : current === true ? false : null

  const setCell = async (office: string, capability: Capability) => {
    if (!canEdit) return
    const key = `${office}:${capability}`
    const previous = grid[office]?.[capability]
    const next = cycle(previous)

    setGrid(p => {
      const forOffice = { ...(p[office] ?? {}) }
      if (next === null) delete forOffice[capability]
      else forOffice[capability] = next
      return { ...p, [office]: forOffice }
    })
    setBusy(key)
    setError('')
    setNotice('')

    try {
      const data = await callApi('/api/permissions/office', {
        method: 'PATCH',
        body: { tenantId, lodgeRole: office, capability, granted: next },
      })
      const who: string[] = data.holders ?? []
      const label = CAPABILITY_META[capability].label
      const said =
        next === null
          ? `${label} follows the tier again for the ${office}.`
          : `${office}: ${label} ${next ? 'allowed' : 'denied'}.` +
            (who.length
              ? ` That is ${who.join(' and ')}.`
              : ' Nobody holds that office at present, so this takes effect when somebody does.')
      setNotice(said)
      notify.saved(said)
      setTimeout(() => setNotice(''), 6000)
      router.refresh()
    } catch (e) {
      setGrid(p => {
        const forOffice = { ...(p[office] ?? {}) }
        if (previous === undefined) delete forOffice[capability]
        else forOffice[capability] = previous
        return { ...p, [office]: forOffice }
      })
      const message = errorMessage(e, 'That could not be saved.')
      setError(message)
      notify.error(message)
    } finally {
      setBusy(null)
    }
  }

  return (
    // min-width:0 so the scroller below actually scrolls instead of
    // widening the page. See the header.
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', gap: '2px', marginBottom: '1.25rem', borderBottom: `1px solid ${T.border}` }}>
        {([['office', 'By office'], ['brother', 'By brother']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer',
            fontFamily: T.body, fontSize: '0.85rem', color: view === v ? T.gold : T.inkFaint,
            borderBottom: view === v ? `2px solid ${T.gold}` : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {error && <Banner tone="danger">{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}
      {!canEdit && (
        <Banner tone="info">
          Only the Secretary, an admin or the Grand Master may change these. You can
          read them here.
        </Banner>
      )}

      {view === 'office' ? (
        <>
          <p style={{ fontFamily: T.body, fontSize: '0.9rem', color: T.inkFaint, marginTop: 0, marginBottom: '0.75rem' }}>
            What each chair carries, whoever is sitting in it. Tap a cell to cycle it
            between <strong style={{ color: T.inkFaint }}>follows the tier</strong>,{' '}
            <strong style={{ color: T.success }}>allowed</strong> and{' '}
            <strong style={{ color: T.danger }}>denied</strong>. Set at the office
            rather than the man, this survives the annual handover — the access moves
            to next year&rsquo;s officer on its own.
          </p>
          <Legend />
          <OfficeGrid
            officeNames={officeNames}
            grid={grid}
            holdersOf={holdersOf}
            onCell={setCell}
            busy={busy}
            canEdit={canEdit}
          />
        </>
      ) : (
        <BrotherList slug={slug} members={members} grid={grid} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- grid

function OfficeGrid({
  officeNames, grid, holdersOf, onCell, busy, canEdit,
}: {
  officeNames: string[]
  grid: Record<string, CapabilityOverrides>
  holdersOf: (office: string) => MemberRow[]
  onCell: (office: string, c: Capability) => void
  busy: string | null
  canEdit: boolean
}) {
  const th: React.CSSProperties = {
    fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.08em', color: T.inkFainter,
    textTransform: 'uppercase', padding: '8px 6px', textAlign: 'center',
    borderBottom: `1px solid ${T.border}`, whiteSpace: 'normal', width: 78, verticalAlign: 'bottom',
  }
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: T.radius, background: T.bgCard }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 760 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', width: 210, position: 'sticky', left: 0, background: T.bgCard, zIndex: 1 }}>
              Office
            </th>
            {CAPABILITIES.map(c => (
              <th key={c} style={th} title={CAPABILITY_META[c].blurb}>{CAPABILITY_META[c].label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {officeNames.map(office => {
            const who = holdersOf(office)
            return (
              <tr key={office}>
                <td style={{
                  padding: '8px 10px', borderBottom: `1px solid ${T.border}`,
                  position: 'sticky', left: 0, background: T.bgCard, zIndex: 1,
                }}>
                  <div style={{ fontFamily: T.body, fontSize: '0.86rem', color: T.ink }}>{office}</div>
                  {/* Who is in the chair. A permission you cannot attach
                      to a face is one nobody dares change. */}
                  <div style={{ fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.06em', color: who.length ? T.gold : T.inkFainter, marginTop: 2 }}>
                    {who.length ? who.map(m => m.name).join(', ').toUpperCase() : 'VACANT'}
                  </div>
                </td>
                {CAPABILITIES.map(c => {
                  const value = grid[office]?.[c]
                  const key = `${office}:${c}`
                  return (
                    <td key={c} style={{ borderBottom: `1px solid ${T.border}`, textAlign: 'center', padding: 0 }}>
                      <button
                        onClick={() => onCell(office, c)}
                        disabled={!canEdit || busy === key}
                        aria-label={`${CAPABILITY_META[c].label} for the ${office}: ${
                          value === undefined ? 'follows the tier' : value ? 'allowed' : 'denied'
                        }`}
                        style={{
                          width: '100%', height: 46, background: 'transparent', border: 'none',
                          cursor: canEdit ? 'pointer' : 'default', opacity: busy === key ? 0.4 : 1,
                          color: value === undefined ? T.inkFainter : value ? T.success : T.danger,
                          fontFamily: T.mono, fontSize: value === undefined ? '13px' : '15px',
                        }}
                      >
                        {value === undefined ? '·' : value ? '✓' : '✕'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Legend() {
  const item = (mark: string, color: string, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color, fontFamily: T.mono, fontSize: '13px' }}>{mark}</span>
      <span style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em', color: T.inkFainter }}>{text}</span>
    </span>
  )
  return (
    <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
      {item('·', T.inkFainter, 'FOLLOWS THE TIER')}
      {item('✓', T.success, 'ALLOWED')}
      {item('✕', T.danger, 'DENIED')}
    </div>
  )
}

// ------------------------------------------------------------- by man

const SOURCE_COLOR: Record<CapabilitySource, string> = {
  platform: T.info,
  member: T.gold,
  position: T.info,
  tier: T.inkFainter,
}

function BrotherList({
  slug, members, grid,
}: {
  slug: string
  members: MemberRow[]
  grid: Record<string, CapabilityOverrides>
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontFamily: T.body, fontSize: '0.9rem', color: T.inkFaint, marginTop: 0 }}>
        What each brother can actually reach, and — the part that matters when
        something is not working — <em>why</em>. A permission you cannot trace to
        his tier, his chair or a decision about him is one nobody can undo.
      </p>

      <div style={{ display: 'grid', gap: '10px' }}>
        {members.map(m => {
          const office = (m.lodgeRole ?? '').trim()
          const position = office ? grid[office] : undefined
          return (
            <div key={m.userId} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div>
                  <Link
                    href={`/lodge/${slug}/members/${m.userId}?tab=Permissions`}
                    style={{ fontFamily: T.display, fontSize: '0.95rem', color: T.gold, textDecoration: 'none' }}
                  >
                    {m.name}
                  </Link>
                  <div style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em', color: T.inkFainter, marginTop: 2 }}>
                    {roleLabel(m.tenantRole).toUpperCase()}
                    {office ? ` · ${office.toUpperCase()}` : ''}
                    {m.isPlatformAdmin ? ' · PLATFORM ADMIN' : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '9px' }}>
                {CAPABILITIES.map(c => {
                  const r = resolveCapability(m.tenantRole, c, m.isPlatformAdmin, position, m.memberOverrides)
                  if (!r.allowed) return null
                  return (
                    <span
                      key={c}
                      title={SOURCE_LABEL[r.source]}
                      style={{
                        fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.06em',
                        padding: '3px 8px', borderRadius: '20px',
                        color: SOURCE_COLOR[r.source],
                        border: `1px solid ${r.source === 'tier' ? T.border : T.borderStrong}`,
                        background: r.source === 'tier' ? 'transparent' : 'rgba(201,168,76,0.06)',
                      }}
                    >
                      {CAPABILITY_META[c].label.toUpperCase()}
                      {r.source !== 'tier' && ` · ${SOURCE_LABEL[r.source].toUpperCase()}`}
                    </span>
                  )
                })}
                {CAPABILITIES.every(c =>
                  !resolveCapability(m.tenantRole, c, m.isPlatformAdmin, position, m.memberOverrides).allowed
                ) && (
                  <span style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: '0.86rem', color: T.inkFainter }}>
                    Nothing beyond the portal — his own dues, his own work, the notices.
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
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
