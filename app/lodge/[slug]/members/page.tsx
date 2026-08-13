'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/lodge/ConfirmDialog'
import { MemberImport } from '@/components/lodge/MemberImport'
import { RosterExport } from '@/components/lodge/RosterExport'
import { notify } from '@/lib/toast'
import { DegreeOptions } from '@/components/DegreeOptions'
import { OfficeSelect } from '@/components/lodge/OfficeSelect'
import { roleLabel } from '@/lib/auth/permissions'
import { REMOVAL_STATUSES, statusDefinition, statusLabel, statusPillClass } from '@/lib/membership'
import { PendingBrothers } from '@/components/lodge/PendingBrothers'

export default function LodgeMembersPage() {
  const params = useParams()
  const slug = params.slug as string
  const searchParams = useSearchParams()
  const [members, setMembers] = useState<any[]>([])
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', degree: 'MM', lodgeRole: '', tenantRole: 'member' })
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [removing, setRemoving] = useState<any>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const [notifyRemoved, setNotifyRemoved] = useState(true)
  const [removalNote, setRemovalNote] = useState('')
  // WHY he is coming off the roster, and when it took effect. The
  // annual return asks for both and neither used to be recorded.
  const [removalStatus, setRemovalStatus] = useState('demitted')
  const [removalDate, setRemovalDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [removalStatusNote, setRemovalStatusNote] = useState('')
  const [reinstating, setReinstating] = useState<any>(null)
  const [reinstateBusy, setReinstateBusy] = useState(false)
  const [reinstateError, setReinstateError] = useState('')
  const [showFormer, setShowFormer] = useState(false)
  const [notice, setNotice] = useState('')
  // Brothers who asked for a login from the public lodge site.
  const [accessRequests, setAccessRequests] = useState<any[]>([])
  const supabase = createClient()

  // Hoisted out of the effect so a completed roster import can call it
  // again — the table has to pick up the newly added brothers without a
  // manual page refresh.
  const load = async () => {
    const { data: t } = await supabase.from('tenants').select('id, name, number').eq('slug', slug).single()
    if (!t) return
    setTenant(t)
    const { data: m } = await supabase
      .from('tenant_members')
      .select('*, profiles(first_name, last_name, email, phone, avatar_url)')
      .eq('tenant_id', t.id)
      .order('created_at')
    setMembers(m ?? [])

    // A request that lives only in the Secretary's inbox is a request
    // that gets buried. RLS restricts these to lodge admins.
    const { data: requests } = await supabase
      .from('portal_access_requests')
      .select('*')
      .eq('tenant_id', t.id)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
    setAccessRequests(requests ?? [])

    setLoading(false)
  }

  /**
   * Loads a request into the invite form rather than inviting straight
   * from it. Nothing on that form is verified — the Secretary still has
   * to set the degree and access level, and confirm he knows the man.
   */
  const useRequest = (req: any) => {
    setInviteForm({
      firstName: req.first_name || '',
      lastName: req.last_name || '',
      email: req.email || '',
      degree: 'MM',
      lodgeRole: req.lodge_role || '',
      tenantRole: 'member',
    })
    setInviteMsg('')
    setShowInvite(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resolveRequest = async (req: any, status: 'invited' | 'dismissed') => {
    setAccessRequests(prev => prev.filter(r => r.id !== req.id))
    const { error } = await supabase
      .from('portal_access_requests')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', req.id)

    if (error) {
      // Put it back rather than letting it vanish from the page while
      // still sitting unresolved in the table.
      setAccessRequests(prev => [req, ...prev])
      notify.error(`That request could not be updated: ${error.message}`)
      return
    }
    notify.saved(status === 'invited' ? 'Marked as invited' : 'Request dismissed')
  }

  useEffect(() => {
    load()
  }, [])

  /**
   * ARRIVING FROM THE SECRETARY'S EMAIL.
   *
   * Its buttons carry ?request=<id>&action=invite|question|dismiss.
   * They decide nothing on their own — an email gets forwarded, and
   * putting a man on a lodge roster is not something a forwarded link
   * should be able to do. What they do is bring the right request to
   * the top of the page with the intended action already taken as far
   * as it safely can be: the invite form filled in from his own words,
   * or the dismissal one press away.
   *
   * Guarded on a ref so a later render cannot re-fire it and re-open a
   * form the Secretary has just closed.
   */
  const followedEmail = useRef(false)
  useEffect(() => {
    if (followedEmail.current || accessRequests.length === 0) return
    const id = searchParams?.get('request')
    const action = searchParams?.get('action')
    if (!id) return
    const req = accessRequests.find(r => r.id === id)
    if (!req) {
      // Already dealt with, by him or by another officer. Saying so
      // beats a page that looks as though the link did nothing.
      followedEmail.current = true
      setNotice('That request has already been dealt with.')
      return
    }
    followedEmail.current = true
    if (action === 'invite') useRequest(req)
    else if (action === 'dismiss') resolveRequest(req, 'dismissed')
    // 'question' has no button of its own: the alert email is sent with
    // reply-to set to the man himself, so the answer is to reply to it.
    // Bringing him to the request is all this can usefully do.
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [accessRequests, searchParams])

  /**
   * WHY THE try/finally MATTERS — this is the bug that made the button
   * say "Sending invitation..." forever.
   *
   * This used to call res.json() unconditionally with no try/catch. Any
   * rejection — a dropped connection, or a platform timeout whose body
   * is an HTML error page rather than JSON — left the promise rejected,
   * so setInviting(false) never ran. The button stayed disabled and
   * mid-flight for the rest of the page's life, with no error shown and
   * nothing to retry. The Secretary had no way to tell a hung request
   * from a slow one.
   *
   * Now: the spinner always clears, the body is parsed defensively, and
   * the request has a deadline of its own so it cannot outlive the
   * server's.
   */
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteMsg('')

    // Comfortably beyond the route's own 30s ceiling, so this fires
    // only when the request is genuinely lost rather than merely slow.
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 45000)

    try {
      const res = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, ...inviteForm }),
        signal: controller.signal,
      })

      // A gateway timeout or crashed function returns HTML, not JSON.
      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { /* handled below */ }

      if (!res.ok) {
        setInviteMsg(`Error: ${data?.error || `The server returned ${res.status}. The invitation was not completed.`}`)
        return
      }
      if (!data) {
        setInviteMsg('Error: The server sent an unreadable response. Check the roster before inviting again.')
        return
      }

      // The brother is on the roster either way; the email is reported
      // separately so "invitation sent" is never claimed falsely.
      if (data.warning) {
        setInviteMsg(`Added to the roster, but: ${data.warning}`)
      } else if (data.method === 'magiclink') {
        setInviteMsg('✓ Added. He already had a LodgeOS account, so he was emailed a sign-in link.')
      } else {
        setInviteMsg('✓ Invitation sent successfully.')
      }

      setInviteForm({ firstName: '', lastName: '', email: '', degree: 'MM', lodgeRole: '', tenantRole: 'member' })
      const { data: m } = await supabase.from('tenant_members').select('*, profiles(first_name, last_name, email, phone, avatar_url)').eq('tenant_id', tenant.id).order('created_at')
      setMembers(m ?? [])
    } catch (err: any) {
      setInviteMsg(
        err?.name === 'AbortError'
          ? 'Error: The invitation timed out. Check the roster below before trying again — he may already have been added.'
          : `Error: ${err?.message || 'The invitation could not be sent.'}`
      )
    } finally {
      clearTimeout(deadline)
      setInviting(false)
    }
  }

  const FIELD_LABEL: Record<string, string> = { degree: 'Degree', dues_status: 'Dues status', lodge_role: 'Lodge office' }

  const updateMember = async (memberId: string, field: string, value: string) => {
    const previous = members.find(m => m.id === memberId)?.[field]

    // Optimistic: these are dropdowns in a table and should feel instant.
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, [field]: value } : m))

    const { error } = await supabase.from('tenant_members').update({ [field]: value }).eq('id', memberId)

    if (error) {
      // The write failed but the dropdown was already showing the new
      // value — previously that discrepancy was invisible and the
      // officer would believe a change had been recorded that had not.
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, [field]: previous } : m))
      notify.error(`${FIELD_LABEL[field] ?? 'Change'} could not be saved: ${error.message}`)
      return
    }

    notify.saved(`${FIELD_LABEL[field] ?? 'Change'} updated`)
  }

  const confirmRemove = async () => {
    if (!removing) return
    setRemoveBusy(true)
    setRemoveError('')
    try {
      const res = await fetch('/api/members/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          memberId: removing.id,
          notify: notifyRemoved,
          note: removalNote,
          status: removalStatus,
          statusDate: removalDate,
          statusNote: removalStatusNote,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Server-side guards (last admin, self-removal) come back here.
        // They're kept in the dialog rather than dismissing it, so the
        // secretary reads why it was refused.
        setRemoveError(data.error || 'Could not remove that brother.')
        return
      }
      // He is no longer FILTERED OUT of the list — he moves to the
      // former brethren section below it. Dropping the row was right
      // when removal deleted it; now that the lodge keeps the record,
      // the interface should show the record it keeps.
      setMembers(prev => prev.map(m => m.id === removing.id
        ? { ...m, is_active: false, membership_status: removalStatus, status_date: removalDate, lodge_role: null }
        : m))
      setRemoving(null)
      setRemovalNote('')
      setRemovalStatusNote('')
      setNotifyRemoved(true)
      setNotice(data.message)
    } catch (err: any) {
      setRemoveError(err?.message || 'Could not remove that brother.')
    } finally {
      setRemoveBusy(false)
    }
  }

  const confirmReinstate = async () => {
    if (!reinstating) return
    setReinstateBusy(true)
    setReinstateError('')
    try {
      const res = await fetch('/api/members/reinstate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, memberId: reinstating.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReinstateError(data.error || 'Could not reinstate that brother.')
        return
      }
      setMembers(prev => prev.map(m => m.id === reinstating.id
        ? { ...m, is_active: true, membership_status: 'active' }
        : m))
      setReinstating(null)
      setNotice(data.message)
    } catch (err: any) {
      setReinstateError(err?.message || 'Could not reinstate that brother.')
    } finally {
      setReinstateBusy(false)
    }
  }

  const sendReminder = async () => {
    const res = await fetch('/api/dues/remind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id }),
    })
    const data = await res.json()
    alert(`Dues reminders sent to ${data.sent} brothers. ${data.failed > 0 ? `${data.failed} failed.` : ''}`)
  }

  const inputStyle = { background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', outline: 'none', borderRadius: '4px', width: '100%' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  const dueCount = members.filter(m => m.dues_status === 'due' && m.is_active).length

  // The roster is the men currently on it. Everyone else is history the
  // lodge now keeps rather than deletes, and history belongs in its own
  // section — not mixed into the working list an officer scans weekly.
  const onRoll = members.filter(m => m.is_active)

  /**
   * On the roster, but never once through the door.
   *
   * first_signin_at is set the first time a brother reaches either
   * dashboard, so a null means the invitation produced nothing —
   * either it never arrived, or he never opened it. Oldest first,
   * because the man waiting longest is the one whose address is
   * probably wrong.
   */
  const pending = onRoll
    .filter(m => !m.first_signin_at)
    .map(m => ({
      id: m.id,
      userId: m.user_id,
      name: `${m.profiles?.first_name ?? ''} ${m.profiles?.last_name ?? ''}`.trim() || (m.profiles?.email ?? 'Unnamed brother'),
      email: m.profiles?.email ?? null,
      invitedAt: m.created_at ?? null,
      lastSentAt: m.invite_last_sent_at ?? null,
    }))
    .sort((a, b) => String(a.lastSentAt ?? a.invitedAt ?? '').localeCompare(String(b.lastSentAt ?? b.invitedAt ?? '')))

  /**
   * EACH BROTHER APPEARS ONCE, and this table is not where a pending
   * one appears.
   *
   * He was listed twice: in the section above, and again here among
   * men who use the app weekly. Two lists of the same names is two
   * places to keep in your head, and the count at the top agreed with
   * neither of them.
   *
   * He is still on the roll — the lodge admitted him, and the header
   * count below says so. He is simply not in the table of brothers the
   * app can reach, because he is not one of them yet. His record, and
   * the power to take him off, are both on his row above.
   */
  const roster = onRoll.filter(m => m.first_signin_at)

  const former = members
    .filter(m => !m.is_active)
    .sort((a, b) => String(b.status_date ?? '').localeCompare(String(a.status_date ?? '')))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Members</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
            {onRoll.length} active {onRoll.length === 1 ? 'brother' : 'brothers'}
            {pending.length > 0 && (
              // The roll and the table now differ, so the difference is
              // stated rather than left to be discovered by counting.
              <span style={{ color: '#918879' }}>
                {' · '}{pending.length} not yet signed in
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {dueCount > 0 && (
            <button onClick={sendReminder} className="btn-outline" style={{ fontSize: '0.68rem' }}>
              Send Dues Reminders ({dueCount})
            </button>
          )}
          <RosterExport members={members} lodgeSlug={slug} />
          {tenant && <MemberImport tenantId={tenant.id} onImported={load} />}
          <button onClick={() => setShowInvite(!showInvite)} className="btn-gold" style={{ fontSize: '0.68rem' }}>
            {showInvite ? 'Cancel' : '+ Invite Brother'}
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ background: 'rgba(93,190,133,0.12)', border: '1px solid rgba(93,190,133,0.3)', color: '#5DBE85', padding: '10px 14px', borderRadius: '4px', marginBottom: '1.5rem', fontFamily: 'Crimson Pro, serif', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: '#5DBE85', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Portal access requests from the public lodge site */}
      {accessRequests.length > 0 && (
        <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.3)', padding: '1.5rem 2rem', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: '#C9A84C', marginBottom: '0.35rem' }}>
            Portal Access Requested ({accessRequests.length})
          </div>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', marginTop: 0, marginBottom: '1.25rem', lineHeight: 1.7 }}>
            Asked for a login from the lodge website. None of these details are verified — invite a
            brother only if you know him to be on the roster.
          </p>

          {accessRequests.map(req => (
            <div key={req.id} style={{ borderTop: '1px solid rgba(201,168,76,0.12)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ minWidth: '240px', flex: 1 }}>
                <div style={{ color: '#F5F0E8', fontFamily: 'Crimson Pro, serif', fontSize: '1.05rem' }}>
                  {req.first_name} {req.last_name}
                  {req.lodge_role ? <span style={{ color: '#B8B0A0', fontStyle: 'italic' }}> — {req.lodge_role}</span> : null}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#B8B0A0', marginTop: 4 }}>
                  {req.email}{req.phone ? ` · ${req.phone}` : ''}{req.years_a_member ? ` · ${req.years_a_member}` : ''}
                </div>
                {req.message && (
                  <p style={{ fontFamily: 'Crimson Pro, serif', color: '#B8B0A0', fontSize: '0.95rem', lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>
                    {req.message}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => useRequest(req)} className="btn-gold" style={{ fontSize: '0.62rem' }}>
                  Invite This Brother
                </button>
                <button onClick={() => resolveRequest(req, 'invited')} className="btn-outline" style={{ fontSize: '0.62rem' }}>
                  Mark Invited
                </button>
                <button onClick={() => resolveRequest(req, 'dismissed')} className="btn-outline" style={{ fontSize: '0.62rem' }}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.15)', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#C9A84C', marginBottom: '1.5rem' }}>Invite a Brother</div>
          {inviteMsg && (
            <div style={{ background: inviteMsg.startsWith('✓') ? 'rgba(39,174,96,0.15)' : 'rgba(192,57,43,0.15)', border: `1px solid ${inviteMsg.startsWith('✓') ? 'rgba(39,174,96,0.3)' : 'rgba(192,57,43,0.3)'}`, color: inviteMsg.startsWith('✓') ? '#5DBE85' : '#EC5B4B', padding: '10px 14px', borderRadius: '4px', marginBottom: '1rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>
              {inviteMsg}
            </div>
          )}
          <form onSubmit={handleInvite} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div><label className="lodgeos-required" style={labelStyle}>First Name</label><input value={inviteForm.firstName} onChange={e => setInviteForm(p => ({ ...p, firstName: e.target.value }))} style={inputStyle} required /></div>
            <div><label className="lodgeos-required" style={labelStyle}>Last Name</label><input value={inviteForm.lastName} onChange={e => setInviteForm(p => ({ ...p, lastName: e.target.value }))} style={inputStyle} required /></div>
            <div><label className="lodgeos-required" style={labelStyle}>Email</label><input type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Degree</label>
              <select value={inviteForm.degree} onChange={e => setInviteForm(p => ({ ...p, degree: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                <DegreeOptions />
              </select>
            </div>
            <div>
              <label style={labelStyle}>Lodge Office</label>
              <OfficeSelect
                value={inviteForm.lodgeRole}
                onChange={(next) => setInviteForm(p => ({ ...p, lodgeRole: next }))}
                style={{ ...inputStyle, cursor: 'pointer' }}
                ariaLabel="Lodge office for the brother being invited"
              />
              <p style={{ fontSize: '0.7rem', color: '#B8B0A0', fontStyle: 'italic', marginTop: '4px' }}>
                Seats him in the Lodge Room. This was a free-text box, and only an exact match
                seated anybody.
              </p>
            </div>
            <div><label style={labelStyle}>Portal Access</label>
              <select value={inviteForm.tenantRole} onChange={e => setInviteForm(p => ({ ...p, tenantRole: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="member">Member — basic portal access</option>
                <option value="deacon">Deacon — attendance &amp; degree tracking</option>
                <option value="warden">Warden — meetings &amp; roster (Senior or Junior)</option>
                <option value="treasurer">Treasurer — full financial access</option>
                <option value="worshipful_master">Worshipful Master — meetings, events &amp; communications</option>
                <option value="grand_master">Grand Master — full access, presides over the Grand Lodge</option>
                <option value="secretary">Secretary — full lodge management</option>
                <option value="admin">Admin — full access</option>
              </select>
              <p style={{ fontSize: '0.7rem', color: '#B8B0A0', fontStyle: 'italic', marginTop: '4px' }}>
                This sets system permissions. Use "Lodge Role" above for the exact office title shown on rosters (e.g. distinguishing Senior Warden from Junior Warden).
              </p>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={inviting} className="btn-gold" style={{ fontSize: '0.68rem', opacity: inviting ? 0.7 : 1 }}>
                {inviting ? 'Sending invitation...' : 'Send Invitation Email'}
              </button>
              <p style={{ fontSize: '0.82rem', color: '#B8B0A0', fontStyle: 'italic', marginTop: '8px' }}>Brother will receive a welcome email with instructions to set up their portal access.</p>
            </div>
          </form>
        </div>
      )}

      {/* Before the roster, not after it. A brother who cannot get in
          is the only thing on this page that needs doing today; the
          roster itself is a reference. */}
      {!loading && (
        <PendingBrothers
          tenantId={tenant.id}
          slug={slug}
          pending={pending}
          onRemove={(memberId) => {
            setRemoveError('')
            setRemoving(members.find(m => m.id === memberId) ?? null)
          }}
          onSent={(memberId, sentAt) =>
            setMembers(prev => prev.map(m => m.id === memberId ? { ...m, invite_last_sent_at: sentAt } : m))
          }
        />
      )}

      {/* Members table */}
      <div className="data-box">
        {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0' }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Name', 'Contact', 'Degree', 'Role', 'Dues', 'Portal', 'Status', ''].map((h, i) => <th key={h || `col-${i}`} className="dash-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {roster.map((m, i) => {
                const p = m.profiles
                return (
                  <tr key={m.id}>
                    <td className="dash-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                          background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.25)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {p?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded external Storage URL, not a static local asset
                            <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#C9A84C' }}>
                              {`${p?.first_name?.[0] ?? ''}${p?.last_name?.[0] ?? ''}`.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/lodge/${slug}/members/${m.user_id}`} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: '#C9A84C', textDecoration: 'none' }}>
                            Bro. {p?.first_name ?? '—'} {p?.last_name ?? ''}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#B8B0A0' }}>
                      <div>{p?.email ?? '—'}</div>
                      <div>{p?.phone ?? ''}</div>
                    </td>
                    <td className="dash-td">
                      <select value={m.degree} onChange={e => updateMember(m.id, 'degree', e.target.value)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#C9A84C', outline: 'none' }}>
                        <DegreeOptions short />
                      </select>
                    </td>
                    <td className="dash-td">
                      {/* Editable at last. The Lodge Room's own subtitle
                          says to assign stations from the Members page,
                          and until now this column was plain text. */}
                      <OfficeSelect
                        value={m.lodge_role || ''}
                        onChange={(next) => updateMember(m.id, 'lodge_role', next)}
                        ariaLabel={`Lodge office for ${m.profiles?.first_name ?? 'this brother'}`}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: '#B8B0A0', outline: 'none', maxWidth: 170 }}
                      />
                    </td>
                    <td className="dash-td">
                      <select value={m.dues_status} onChange={e => updateMember(m.id, 'dues_status', e.target.value)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: m.dues_status === 'paid' ? '#5DBE85' : m.dues_status === 'due' ? '#C9A84C' : '#B8B0A0', outline: 'none' }}>
                        <option value="paid">Paid</option>
                        <option value="due">Due</option>
                        <option value="exempt">Exempt</option>
                      </select>
                    </td>
                    <td className="dash-td"><span className={`pill ${
                  m.tenant_role === 'admin' || m.tenant_role === 'secretary' ? 'pill-mm'
                  : m.tenant_role === 'grand_master' ? 'pill-shrine'
                  : m.tenant_role === 'worshipful_master' ? 'pill-active'
                  : m.tenant_role === 'treasurer' ? 'pill-fc'
                  : m.tenant_role === 'warden' || m.tenant_role === 'deacon' ? 'pill-ea'
                  : 'pill-new'
                }`}>{roleLabel(m.tenant_role)}</span></td>
                    <td className="dash-td"><span className={`pill ${statusPillClass(m.membership_status)}`}>{statusLabel(m.membership_status)}</span></td>
                    <td className="dash-td" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => { setRemoveError(''); setRemoving(m) }}
                        title="Remove from roster"
                        aria-label={`Remove ${p?.first_name ?? ''} ${p?.last_name ?? ''} from roster`}
                        style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
                          background: 'transparent', border: '1px solid rgba(231,76,60,0.25)',
                          color: '#EC5B4B', padding: '4px 10px', borderRadius: '3px', cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && roster.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No members yet. Invite your first brother above.</div>}
      </div>

      {/* FORMER BRETHREN.
          These rows used to be deleted outright, so this section could
          not have existed. Now that removal records a reason and a date,
          the lodge has the material for its own annual return — and a
          demitted or suspended brother has a way back that does not
          involve inviting him as though he were a stranger. */}
      {!loading && former.length > 0 && (
        <div className="data-box" style={{ marginTop: '1.5rem' }}>
          <div className="data-box-head">
            <button
              onClick={() => setShowFormer(v => !v)}
              aria-expanded={showFormer}
              style={{ background: 'none', border: 'none', color: '#F5F0E8', fontFamily: 'Cinzel, serif', fontSize: '0.88rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span aria-hidden="true" style={{ fontSize: '0.55rem', opacity: 0.7, display: 'inline-block', transform: showFormer ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
              Former Brethren
            </button>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>{former.length}</span>
          </div>

          {showFormer && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Name', 'Status', 'Effective', 'Note', ''].map((h, i) => <th key={h || `f-${i}`} className="dash-th">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {former.map((m) => {
                    const p = m.profiles
                    const def = statusDefinition(m.membership_status)
                    return (
                      <tr key={m.id}>
                        <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: '#F5F0E8' }}>
                          {p?.first_name} {p?.last_name}
                        </td>
                        <td className="dash-td">
                          <span className={`pill ${statusPillClass(m.membership_status)}`}>{statusLabel(m.membership_status)}</span>
                        </td>
                        <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#B8B0A0' }}>
                          {m.status_date ?? '—'}
                        </td>
                        <td className="dash-td" style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: '#B8B0A0' }}>
                          {m.status_note || <span style={{ opacity: 0.5 }}>—</span>}
                        </td>
                        <td className="dash-td" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {/* Deliberately absent for an expulsion and a
                              death. One is a Grand Lodge action the
                              lodge cannot undo from a roster; the other
                              is not a thing to offer a button for. */}
                          {m.membership_status !== 'expelled' && m.membership_status !== 'deceased' && (
                            <button
                              onClick={() => { setReinstateError(''); setReinstating(m) }}
                              style={{
                                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
                                background: 'transparent', border: '1px solid rgba(201,168,76,0.3)',
                                color: '#C9A84C', padding: '4px 10px', borderRadius: '3px', cursor: 'pointer',
                              }}
                            >
                              Reinstate
                            </button>
                          )}
                          {m.membership_status === 'expelled' && (
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#918879' }} title={def?.hint}>
                              GRAND LODGE
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!reinstating}
        title="Put him back on the roster?"
        confirmLabel="Reinstate"
        busy={reinstateBusy}
        error={reinstateError}
        onCancel={() => { if (!reinstateBusy) { setReinstating(null); setReinstateError('') } }}
        onConfirm={confirmReinstate}
        body={
          <>
            <p style={{ marginBottom: '0.9rem' }}>
              <strong style={{ color: '#F5F0E8' }}>
                Bro. {reinstating?.profiles?.first_name} {reinstating?.profiles?.last_name}
              </strong>{' '}
              returns to the roster and regains portal access. He was recorded as{' '}
              {statusLabel(reinstating?.membership_status).toLowerCase()}
              {reinstating?.status_date ? ` on ${reinstating.status_date}` : ''}.
            </p>
            <p style={{ fontSize: '0.92rem', color: '#918879', fontStyle: 'italic' }}>
              His attendance, dues and degree history come back with him — they were never
              detached. His former office is <strong>not</strong> restored; if he is to take a
              station again, set it on the roster.
            </p>
          </>
        }
      />

      <ConfirmDialog
        open={!!removing}
        title="Take him off the roster?"
        confirmLabel="Record and Remove"
        busy={removeBusy}
        error={removeError}
        onCancel={() => { if (!removeBusy) { setRemoving(null); setRemoveError(''); setRemovalNote(''); setRemovalStatusNote(''); setNotifyRemoved(true) } }}
        onConfirm={confirmRemove}
        body={
          <>
            <p style={{ marginBottom: '0.9rem' }}>
              <strong style={{ color: '#F5F0E8' }}>
                Bro. {removing?.profiles?.first_name} {removing?.profiles?.last_name}
              </strong>{' '}
              will be taken off this lodge&apos;s roster and will lose portal access.
            </p>
            <p style={{ marginBottom: '0.9rem' }}>
              Their attendance record, dues payments, and degree history are{' '}
              <strong style={{ color: '#F5F0E8' }}>kept</strong> — past years&apos; reports and
              analytics will not change. The membership itself is kept too, marked with the
              reason below, so it can be reinstated and so the annual return has the figures.
            </p>

            {/* THE REASON, WHICH THE LODGE NEEDS AND NEVER USED TO ASK.
                A demit, a suspension, an expulsion and a death are four
                different things to a Grand Lodge and the return counts
                them separately. Asked here, once, at the only moment
                anyone knows the answer. */}
            <div style={{ borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: '0.9rem', marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.12em', color: '#C9A84C', marginBottom: '0.5rem' }}>
                REASON
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {REMOVAL_STATUSES.map((s) => (
                  <label key={s.value} style={{ display: 'flex', gap: '0.6rem', cursor: 'pointer', alignItems: 'flex-start', padding: '5px 0' }}>
                    <input
                      type="radio"
                      name="removal-status"
                      value={s.value}
                      checked={removalStatus === s.value}
                      onChange={() => {
                        setRemovalStatus(s.value)
                        // The default follows the reason rather than
                        // making the Secretary remember to turn the
                        // email off for a death every single time.
                        setNotifyRemoved(s.notifyByDefault)
                      }}
                      style={{ accentColor: '#C9A84C', marginTop: 3 }}
                    />
                    <span>
                      <span style={{ fontSize: '0.95rem', color: '#F5F0E8' }}>{s.label}</span>
                      <span style={{ display: 'block', fontSize: '0.85rem', color: '#918879', fontStyle: 'italic' }}>{s.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0', marginBottom: 4 }}>
                    EFFECTIVE DATE
                  </label>
                  {/* The date it happened, not the date it was typed.
                      A death recorded three weeks later belongs in the
                      week it occurred — and either side of New Year
                      that is a different return entirely. */}
                  <input
                    type="date"
                    value={removalDate}
                    onChange={e => setRemovalDate(e.target.value)}
                    style={{ background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '7px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', borderRadius: 4 }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0', marginBottom: 4 }}>
                    LODGE NOTE (NEVER SENT)
                  </label>
                  <input
                    value={removalStatusNote}
                    onChange={e => setRemovalStatusNote(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. Demitted to Corinthian #45"
                    style={{ width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '7px 10px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', borderRadius: 4 }}
                  />
                </div>
              </div>
            </div>

            {/* Telling him, and the choice not to.
                A demitted brother should hear it from the lodge. A
                brother removed because he has died should not have an
                automated message land in the inbox his widow is
                reading, and a duplicate row created by mistake has
                nobody to notify. Only the Secretary knows which this
                is. */}
            <div style={{ borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: '0.9rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifyRemoved}
                  onChange={e => setNotifyRemoved(e.target.checked)}
                  style={{ accentColor: '#C9A84C' }}
                />
                <span style={{ fontSize: '0.95rem', color: '#F5F0E8' }}>
                  Let him know by email
                </span>
              </label>

              {notifyRemoved ? (
                <div style={{ marginTop: '0.7rem' }}>
                  <textarea
                    value={removalNote}
                    onChange={e => setRemovalNote(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="Optional — a line in your own words, e.g. &quot;Demitted at your own request, with the lodge's thanks.&quot;"
                    style={{ width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '9px 12px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', borderRadius: 4, resize: 'vertical' }}
                  />
                  <p style={{ fontSize: '0.82rem', color: '#918879', fontStyle: 'italic', margin: '4px 0 0' }}>
                    The email states the fact and that his records are kept. It gives no reason unless
                    you write one here.
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: '0.82rem', color: '#918879', fontStyle: 'italic', margin: '6px 0 0' }}>
                  He will be removed without being told.
                </p>
              )}
            </div>
          </>
        }
      />
    </div>
  )
}
