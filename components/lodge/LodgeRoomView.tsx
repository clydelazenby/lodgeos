'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { T } from '@/lib/designTokens'
import { StationMemberModal, type StationSelection } from '@/components/lodge/StationMemberModal'

/**
 * The Lodge Room floor plan, shared by the officer page and the
 * brother portal's check-in page.
 *
 * It used to be the body of app/lodge/[slug]/lodge-room/page.tsx and
 * nothing else could show it. Every brother has a reason to see where
 * the stations are and who is sitting in them — arguably more reason
 * than an officer, who already knows — so it moved here and that page
 * became a thin wrapper.
 *
 * WHAT DIFFERS IN THE PORTAL. `interactive={false}` stops a station
 * opening the member modal, because that modal links through to the
 * officer-side member record which a plain brother may not open. The
 * plan, the names and the attendance rings are all still there; only
 * the link out is withheld, so nothing renders that would 403 on tap.
 *
 * `fixedEventId` pins the plan to one meeting and hides the picker —
 * the check-in page uses it to show the room filling up in real time
 * for the meeting that is currently open.
 */
// Position each station as a percentage of the room's width/height,
// laid out to resemble an actual lodge floor plan: East (top, where
// the WM sits) to West (bottom, the entrance/Tyler's post), with
// Wardens flanking the WM and the working officers along the sides.
/**
 * `short` is the phone-sized label. The full station name is what
 * forces a chair to be ~76px wide, and twelve 76px chairs cannot fit a
 * 300px-wide floor plan at these fixed percentages no matter how small
 * the type gets — four of them ended up hanging off the edges of the
 * box. Abbreviating the label (and dropping the brother's name, which
 * stays in the tooltip and in the roster panel beside the plan) takes
 * a chair down to 48px, which fits with room to spare.
 */
const LAYOUT: { station: string; short: string; top: string; left: string }[] = [
  { station: 'Worshipful Master', short: 'WM', top: '8%', left: '50%' },
  { station: 'Senior Warden', short: 'SW', top: '22%', left: '25%' },
  { station: 'Junior Warden', short: 'JW', top: '22%', left: '75%' },
  { station: 'Treasurer', short: 'Treas', top: '42%', left: '12%' },
  { station: 'Chaplain', short: 'Chap', top: '42%', left: '88%' },
  { station: 'Secretary', short: 'Sec', top: '58%', left: '12%' },
  { station: 'Marshal', short: 'Mar', top: '58%', left: '88%' },
  { station: 'Senior Deacon', short: 'SD', top: '48%', left: '38%' },
  { station: 'Junior Deacon', short: 'JD', top: '48%', left: '62%' },
  { station: 'Senior Steward', short: 'SS', top: '80%', left: '30%' },
  { station: 'Junior Steward', short: 'JS', top: '80%', left: '70%' },
  { station: 'Tyler', short: 'Tyler', top: '94%', left: '50%' },
]

export function LodgeRoomView({
  slug,
  interactive = true,
  showHeading = true,
  fixedEventId,
}: {
  slug: string
  interactive?: boolean
  showHeading?: boolean
  /** Pin to one meeting and hide the picker. */
  fixedEventId?: string | null
}) {
  const supabase = createClient()

  const [tenant, setTenant] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [pickedEventId, setPickedEventId] = useState('')
  // A pinned meeting always wins over the picker's value.
  const selectedEventId = fixedEventId ?? pickedEventId
  const [attendance, setAttendance] = useState<Record<string, string>>({}) // member user_id -> status
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<StationSelection | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: t } = await supabase.from('tenants').select('id, name, number').eq('slug', slug).single()
      if (!t) { setLoading(false); return }
      setTenant(t)

      const [{ data: m }, { data: e }] = await Promise.all([
        supabase.from('tenant_members').select('user_id, lodge_role, degree, profiles(first_name, last_name, avatar_url)').eq('tenant_id', t.id).eq('is_active', true),
        supabase.from('lodge_events').select('id, title, event_date').eq('tenant_id', t.id).order('event_date', { ascending: false }).limit(20),
      ])
      setMembers(m ?? [])
      setEvents(e ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Load real attendance for the selected event — same table, same
  // status enum, as the Dashboard heatmap and the dedicated Attendance
  // page. Re-fetches whenever the meeting selector changes.
  useEffect(() => {
    const loadAttendance = async () => {
      if (!selectedEventId) { setAttendance({}); return }
      const { data } = await supabase.from('attendance').select('member_id, status').eq('event_id', selectedEventId)
      const map: Record<string, string> = {}
      for (const row of data ?? []) map[(row as any).member_id] = (row as any).status
      setAttendance(map)
    }
    loadAttendance()
  }, [selectedEventId])

  const holderByStation: Record<string, any[]> = {}
  for (const layout of LAYOUT) holderByStation[layout.station] = []
  for (const m of members) {
    const role = m.lodge_role?.trim()
    if (role && holderByStation[role]) holderByStation[role].push(m)
  }

  // Visitors: active members with no named station AND no attendance
  // record marking them absent for the selected meeting — i.e. anyone
  // not part of the fixed layout. Genuinely reads real attendance
  // rather than a hardcoded "3 visitors" the way a static mockup would.
  const unstationedPresent = selectedEventId
    ? members.filter(m => !LAYOUT.some(l => l.station === m.lodge_role?.trim()) && attendance[m.user_id] === 'present')
    : []

  const officersFilled = LAYOUT.filter(l => holderByStation[l.station].length > 0).length
  const officersPresentTonight = selectedEventId
    ? LAYOUT.filter(l => holderByStation[l.station].some(h => attendance[h.user_id] === 'present')).length
    : null

  if (loading) return <div style={{ padding: '2rem', color: T.inkFaint, fontStyle: 'italic' }}>Loading...</div>

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      {interactive && <StationMemberModal selection={selected} slug={slug} onClose={() => setSelected(null)} />}
      {(showHeading || !fixedEventId) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          {showHeading ? (
            <div>
              <h1 style={{ fontFamily: T.display, fontSize: '1.5rem', color: T.ink, margin: 0 }}>Lodge Room</h1>
              <p style={{ fontFamily: T.body, color: T.inkFaint, fontSize: '0.85rem', margin: '4px 0 0' }}>
                Officer station layout — assign stations from the Members page
              </p>
            </div>
          ) : <div />}
          {!fixedEventId && (
            <select
              value={pickedEventId}
              onChange={e => setPickedEventId(e.target.value)}
              aria-label="Show attendance for a meeting"
              style={{ background: T.bgCard, border: `1px solid ${T.border}`, color: T.ink, padding: '9px 14px', borderRadius: '6px', fontFamily: T.body, fontSize: '0.85rem', outline: 'none', cursor: 'pointer', minWidth: '220px' }}
            >
              <option value="">— View stations only —</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{new Date(e.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {e.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="lodgeos-room-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Floor plan */}
        <div className="lodgeos-room-card" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '2rem 1.5rem' }}>
          <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.15em', color: T.inkFaint, textAlign: 'center', marginBottom: '0.5rem' }}>EAST</div>
          <div
            className="lodgeos-room-plan"
            style={{
              position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: '8px',
              border: `1px dashed ${T.border}`, overflow: 'hidden',
              // The same photograph used on the sign-in screen, so the
              // room reads as a continuation of the same place rather
              // than a diagram on a flat panel. Heavily darkened — this
              // is a backdrop, and the officer avatars and station
              // labels on top of it have to stay first to the eye.
              backgroundImage:
                'radial-gradient(ellipse at 50% 10%, rgba(201,168,76,0.10), transparent 60%),' +
                'linear-gradient(rgba(6,11,22,0.86), rgba(6,11,22,0.92)),' +
                "url('/assets/lodgeos/images/login-bg.png')",
              backgroundSize: 'auto, auto, cover',
              backgroundPosition: 'center, center, center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {LAYOUT.map(layout => {
              const holders = holderByStation[layout.station]
              const holder = holders[0] // display first holder; more-than-one is a data-consistency signal same as the dashboard/bench pages, not hidden
              const status = holder ? attendance[holder.user_id] : undefined
              const ringColor = selectedEventId
                ? status === 'present' ? T.success : status === 'excused' ? T.gold : holder ? T.danger : T.inkFainter
                : holder ? T.gold : T.inkFainter

              return (
                <button
                  key={layout.station}
                  type="button"
                  disabled={!interactive}
                  onClick={() => interactive && setSelected({
                    station: layout.station,
                    holder: holder ?? null,
                    status,
                    meetingLabel: selectedEventId
                      ? events.find(e => e.id === selectedEventId)?.title
                      : undefined,
                  })}
                  title={holder ? `${layout.station}: ${holder.profiles?.first_name} ${holder.profiles?.last_name}${status ? ` (${status})` : ''}` : `${layout.station}: Unassigned`}
                  aria-label={holder ? `${layout.station}, ${holder.profiles?.first_name} ${holder.profiles?.last_name}` : `${layout.station}, unassigned`}
                  className="lodgeos-room-chair-wrap"
                  style={{ position: 'absolute', top: layout.top, left: layout.left, transform: 'translate(-50%, -50%)', textAlign: 'center', width: '92px', background: 'transparent', border: 'none', padding: 0, cursor: interactive ? 'pointer' : 'default' }}
                >
                  <div className="lodgeos-room-chair-circle" style={{
                    width: '46px', height: '46px', borderRadius: '50%', margin: '0 auto',
                    background: holder ? T.bgPanel : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${ringColor}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    boxShadow: holder && (!selectedEventId || status === 'present') ? `0 0 0 3px ${ringColor}22` : 'none',
                  }}>
                    {holder?.profiles?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded external Storage URL
                      <img src={holder.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontFamily: T.display, fontSize: '0.85rem', color: holder ? T.gold : T.inkFainter }}>
                        {holder ? `${holder.profiles?.first_name?.[0] ?? ''}${holder.profiles?.last_name?.[0] ?? ''}` : '—'}
                      </span>
                    )}
                  </div>
                  <div className="lodgeos-room-chair-label lodgeos-room-label-full" style={{ fontFamily: T.mono, fontSize: '8.5px', color: T.gold, letterSpacing: '0.03em', marginTop: '4px', textTransform: 'uppercase' }}>{layout.station}</div>
                  <div className="lodgeos-room-chair-label lodgeos-room-label-short" style={{ fontFamily: T.mono, fontSize: '9px', color: T.gold, letterSpacing: '0.03em', marginTop: '4px', textTransform: 'uppercase' }}>{layout.short}</div>
                  <div className="lodgeos-room-chair-name" style={{ fontFamily: T.body, fontSize: '10px', color: T.inkFaint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {holder ? `${holder.profiles?.first_name} ${holder.profiles?.last_name}` : 'Unassigned'}
                  </div>
                </button>
              )
            })}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.15em', color: T.inkFaint, textAlign: 'center', marginTop: '0.5rem' }}>WEST · ENTRANCE</div>
        </div>

        {/* Side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.1rem' }}>
            <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.15em', color: T.inkFaint, textTransform: 'uppercase', marginBottom: '6px' }}>
              {selectedEventId ? 'Officers Present' : 'Stations Filled'}
            </div>
            <div style={{ fontFamily: T.display, fontSize: '1.7rem', color: T.ink }}>
              {selectedEventId ? officersPresentTonight : officersFilled} <span style={{ fontSize: '1.1rem', color: T.inkFaint }}>/ {LAYOUT.length}</span>
            </div>
          </div>

          {selectedEventId && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.1rem' }}>
              <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.15em', color: T.inkFaint, textTransform: 'uppercase', marginBottom: '10px' }}>
                Visitors ({unstationedPresent.length})
              </div>
              {unstationedPresent.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {unstationedPresent.map(m => (
                    <div key={m.user_id} title={`${m.profiles?.first_name} ${m.profiles?.last_name}`} style={{ width: '30px', height: '30px', borderRadius: '50%', background: T.bgPanel, border: `1px solid ${T.borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {m.profiles?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontFamily: T.display, fontSize: '0.65rem', color: T.gold }}>{m.profiles?.first_name?.[0]}{m.profiles?.last_name?.[0]}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: T.inkFainter, fontSize: '0.78rem', fontStyle: 'italic' }}>No unstationed brothers marked present.</div>}
            </div>
          )}

          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.1rem' }}>
            <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.15em', color: T.inkFaint, textTransform: 'uppercase', marginBottom: '10px' }}>Legend</div>
            {[
              { color: selectedEventId ? T.success : T.gold, label: selectedEventId ? 'Present' : 'Station filled' },
              ...(selectedEventId ? [{ color: T.gold, label: 'Excused' }, { color: T.danger, label: 'Absent / no record' }] : []),
              { color: T.inkFainter, label: 'Unassigned' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${item.color}` }} />
                <span style={{ fontFamily: T.body, fontSize: '0.78rem', color: T.inkFaint }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
