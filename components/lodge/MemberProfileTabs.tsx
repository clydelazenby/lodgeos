'use client'
import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { T, pillTone } from '@/lib/designTokens'
import { AvatarUpload } from '@/components/lodge/AvatarUpload'
import { MemberQrCode } from '@/components/lodge/MemberQrCode'

const TABS = ['Overview', 'Attendance', 'Dues', 'History', 'Notes'] as const
type Tab = typeof TABS[number]

export function MemberProfileTabs({
  slug, tenant, membership, attendanceHistory, paymentHistory, degreeHistory,
}: {
  slug: string; tenant: any; membership: any
  attendanceHistory: any[]; paymentHistory: any[]; degreeHistory: any[]
}) {
  const [tab, setTab] = useState<Tab>('Overview')
  const [notes, setNotes] = useState(membership.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  const p = membership.profiles
  const initials = `${p?.first_name?.[0] ?? ''}${p?.last_name?.[0] ?? ''}`.toUpperCase() || '?'
  const attendedCount = attendanceHistory.filter(a => a.status === 'present').length
  const attendanceRate = attendanceHistory.length ? Math.round((attendedCount / attendanceHistory.length) * 100) : null
  const totalPaid = paymentHistory.reduce((sum, pay) => sum + Number(pay.amount), 0)

  const saveNotes = async () => {
    setSavingNotes(true)
    setNotesSaved(false)
    const res = await fetch('/api/members/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, memberId: membership.user_id, notes }),
    })
    if (res.ok) { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2500) }
    setSavingNotes(false)
  }

  const sectionStyle: React.CSSProperties = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.25rem' }
  const labelStyle: React.CSSProperties = { fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.12em', color: T.inkFaint, textTransform: 'uppercase', marginBottom: '4px' }

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      <Link href={`/lodge/${slug}/members`} style={{ fontFamily: T.mono, fontSize: '11px', color: T.inkFaint, textDecoration: 'none', display: 'inline-block', marginBottom: '1.25rem' }}>← Back to Members</Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
<AvatarUpload
  currentUrl={p?.avatar_url || null}
  initials={initials}
/>
        
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: T.display, fontSize: '1.4rem', color: T.ink, margin: 0 }}>{p?.first_name} {p?.last_name}</h1>
            {membership.lodge_role && <span style={{ ...pillTone('gold'), background: pillTone('gold').bg, color: pillTone('gold').text, border: `1px solid ${pillTone('gold').border}`, padding: '3px 10px', borderRadius: '20px', fontFamily: T.mono, fontSize: '10px' }}>{membership.lodge_role}</span>}
          </div>
          <div style={{ fontFamily: T.body, fontSize: '0.82rem', color: T.inkFaint, marginTop: '4px' }}>
            {tenant.name} #{tenant.number} · {p?.email}{p?.phone ? ` · ${p.phone}` : ''}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '1.25rem', borderBottom: `1px solid ${T.border}`, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: T.body, fontSize: '0.82rem', color: tab === t ? T.gold : T.inkFaint,
            borderBottom: tab === t ? `2px solid ${T.gold}` : '2px solid transparent',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={sectionStyle}><div style={labelStyle}>Current Degree</div><div style={{ fontFamily: T.display, fontSize: '1.3rem', color: T.ink }}>{membership.degree}</div></div>
          <div style={sectionStyle}><div style={labelStyle}>Officer Position</div><div style={{ fontFamily: T.display, fontSize: '1.1rem', color: T.ink }}>{membership.lodge_role || '—'}</div></div>
          <div style={sectionStyle}><div style={labelStyle}>Attendance Rate</div><div style={{ fontFamily: T.display, fontSize: '1.3rem', color: T.ink }}>{attendanceRate !== null ? `${attendanceRate}%` : '—'}</div></div>
          <div style={sectionStyle}>
            <div style={labelStyle}>Dues Status</div>
            <div style={{ fontFamily: T.body, fontSize: '0.95rem', color: membership.dues_status === 'paid' ? T.success : membership.dues_status === 'due' ? T.danger : T.inkFaint, fontWeight: 600, textTransform: 'capitalize' }}>{membership.dues_status}</div>
          </div>
          <div style={{ ...sectionStyle, gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Member Since</div>
            <div style={{ fontFamily: T.body, fontSize: '0.9rem', color: T.ink }}>{membership.joined_date ? format(new Date(membership.joined_date), 'MMMM yyyy') : 'Not recorded'}</div>
          </div>
          <div style={sectionStyle}>
  <div style={labelStyle}>Member QR Code</div>

  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      marginTop: '10px',
    }}
  >
    <MemberQrCode
      qrToken={p?.qr_token || null}
    />
  </div>
</div>
        </div>
      )}

      {tab === 'Attendance' && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Meeting History ({attendanceHistory.length} recorded)</div>
          {attendanceHistory.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: T.inkFainter, fontStyle: 'italic', fontSize: '0.85rem' }}>No attendance records yet.</div>
          ) : attendanceHistory.map((a, i) => {
            const ev = a.lodge_events
            const tone = a.status === 'present' ? pillTone('success') : a.status === 'excused' ? pillTone('gold') : pillTone('danger')
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0', borderBottom: i < attendanceHistory.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div>
                  <div style={{ fontFamily: T.body, fontSize: '0.85rem', color: T.ink }}>{ev?.title ?? 'Unknown event'}</div>
                  <div style={{ fontFamily: T.mono, fontSize: '10.5px', color: T.inkFaint }}>{ev?.event_date ? format(new Date(ev.event_date + 'T12:00:00'), 'MMM d, yyyy') : ''}</div>
                </div>
                <span style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}`, padding: '2px 10px', borderRadius: '20px', fontFamily: T.mono, fontSize: '10px', textTransform: 'capitalize' }}>{a.status}</span>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'Dues' && (
        <div>
          <div style={{ ...sectionStyle, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={labelStyle}>Total Paid (all time)</div><div style={{ fontFamily: T.display, fontSize: '1.4rem', color: T.success }}>${totalPaid.toLocaleString()}</div></div>
            <Link href={`/lodge/${slug}/dues`} style={{ fontFamily: T.mono, fontSize: '10.5px', color: T.gold, textDecoration: 'none' }}>Full Dues Ledger →</Link>
          </div>
          <div style={sectionStyle}>
            <div style={labelStyle}>Payment History</div>
            {paymentHistory.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: T.inkFainter, fontStyle: 'italic', fontSize: '0.85rem' }}>No payments recorded yet.</div>
            ) : paymentHistory.map((pay, i) => (
              <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.7rem 0', borderBottom: i < paymentHistory.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div>
                  <div style={{ fontFamily: T.body, fontSize: '0.85rem', color: T.ink }}>Dues {pay.dues_year ?? ''}</div>
                  <div style={{ fontFamily: T.mono, fontSize: '10.5px', color: T.inkFaint }}>{format(new Date(pay.created_at), 'MMM d, yyyy')}</div>
                </div>
                <div style={{ fontFamily: T.display, fontSize: '0.95rem', color: T.success }}>${pay.amount}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'History' && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Masonic Record</div>
          {degreeHistory.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: T.inkFainter, fontStyle: 'italic', fontSize: '0.85rem' }}>No degree progress recorded yet.</div>
          ) : degreeHistory.map((d) => (
            <div key={d.degree} style={{ padding: '0.85rem 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: T.body, fontSize: '0.88rem', color: T.ink, fontWeight: 600 }}>{d.degree}</span>
                <span style={{ color: d.proficiency_passed ? T.success : T.inkFainter, fontFamily: T.mono, fontSize: '10.5px' }}>{d.proficiency_passed ? '✓ Proficient' : 'Not yet proficient'}</span>
              </div>
              <div style={{ fontFamily: T.mono, fontSize: '10.5px', color: T.inkFaint, marginTop: '4px' }}>
                {d.conferred_date ? `Conferred ${format(new Date(d.conferred_date), 'MMM d, yyyy')}` : 'Not yet conferred'}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Notes' && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Secretary's Notes</div>
          <p style={{ fontFamily: T.body, fontSize: '0.78rem', color: T.inkFainter, fontStyle: 'italic', marginTop: '2px', marginBottom: '0.9rem' }}>
            Visible to officers with admin access. Not visible to the member themselves.
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={6}
            placeholder="Add a note about this brother..."
            style={{ width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink, padding: '10px 14px', borderRadius: '6px', fontFamily: T.body, fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
            <button onClick={saveNotes} disabled={savingNotes} style={{ background: T.gold, color: T.bg, border: 'none', padding: '9px 22px', borderRadius: '6px', fontFamily: T.display, fontSize: '0.82rem', fontWeight: 600, cursor: savingNotes ? 'not-allowed' : 'pointer', opacity: savingNotes ? 0.6 : 1 }}>
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
            {notesSaved && <span style={{ color: T.success, fontFamily: T.mono, fontSize: '11px' }}>✓ Saved</span>}
          </div>
        </div>
      )}
    </div>
  )
}
