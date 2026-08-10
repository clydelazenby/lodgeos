import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * The minutes, as a brother sees them.
 *
 * APPROVED ONLY, and that is not a nicety. Minutes are read aloud in
 * open lodge and approved there; until that happens they are one
 * officer's account of an evening and carry no authority. A brother
 * reading a draft would be reading something the lodge has not agreed
 * to — and might yet correct.
 *
 * NOTHING NEW IS EXPOSED AT THE DATABASE LEVEL. Migration 030's RLS
 * policy already grants members select on approved rows only; this page
 * gives them somewhere to read what their session could already fetch,
 * and the drafts stay invisible whatever this file does.
 *
 * A brother who was absent has every right to know what was done in his
 * lodge. That is the whole reason minutes are read at all.
 */
export default async function PortalMinutesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) redirect('/auth/login')

  const { data: minutes } = await supabase
    .from('meeting_minutes')
    .select('id, body, approved_on, correction_note, lodge_events(title, event_date)')
    .eq('tenant_id', (membership as any).tenant_id)
    .eq('status', 'approved')
    .order('approved_on', { ascending: false })

  const rows = [...(minutes ?? [])].sort((a: any, b: any) =>
    String(b.lodge_events?.event_date ?? '').localeCompare(String(a.lodge_events?.event_date ?? ''))
  )

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          THE RECORD OF THE LODGE
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Minutes
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          Minutes read and approved by the lodge. Those still awaiting approval are not shown — they
          are not yet the lodge&apos;s record.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="data-box">
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>
            No approved minutes yet.
          </div>
        </div>
      ) : (
        rows.map((m: any) => (
          <div key={m.id} className="data-box">
            <div className="data-box-head">
              <span>{m.lodge_events?.title ?? 'Meeting'}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
                {m.lodge_events?.event_date}
              </span>
            </div>

            {m.correction_note && (
              <div style={{ margin: '1rem 1.4rem 0', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', padding: '10px 12px', borderRadius: 4 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.14em', color: '#C9A84C', marginBottom: 4 }}>
                  APPROVED AS CORRECTED
                </div>
                <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem', color: '#E8E2D5' }}>
                  {m.correction_note}
                </div>
              </div>
            )}

            <div style={{ padding: '1.2rem 1.4rem', fontFamily: 'Crimson Pro, serif', fontSize: '0.98rem', lineHeight: 1.75, color: '#E8E2D5', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {m.body}
            </div>

            {m.approved_on && (
              <div style={{ padding: '0 1.4rem 1.2rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#918879' }}>
                APPROVED {m.approved_on}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
