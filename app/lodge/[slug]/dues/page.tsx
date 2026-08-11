import { createClient } from '@/lib/supabase/server'
import { getTenantBySlug, getSessionUser, getProfile, getMembership } from '@/lib/supabase/queries'
import { loadOverrides } from '@/lib/auth/capabilities'
import { can } from '@/lib/auth/permissions'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { T } from '@/lib/designTokens'
import { DuesReminderButton } from '@/components/lodge/DuesReminderButton'
import { DuesRateEditor } from '@/components/lodge/DuesRateEditor'
import { ChargesPanel } from '@/components/lodge/ChargesPanel'
import { PendingTransfers } from '@/components/lodge/PendingTransfers'

/**
 * REBUILT ON THE SHARED DESIGN SYSTEM.
 *
 * This page was the last one still rendering the abandoned "vellum"
 * palette — cream #F7F3E8 backgrounds, brass rules, Fraunces/Spectral
 * type — declared in a local `const T = {...}` block at the top of the
 * file. Every other page in the app uses the navy/gold system in
 * lib/designTokens.ts. The old block's own comment admitted it was
 * provisional ("a follow-up pass converts pages… once the visual
 * direction is confirmed"), and designTokens.ts records that the
 * direction was in fact confirmed as a full replacement. Clicking from
 * Members to Dues looked like leaving the application.
 *
 * WHAT CHANGED BEYOND THE PALETTE
 *
 * - Six equally-weighted stat cells became three figures plus a
 *   collection bar. Paid/Due/Exempt were three big numerals restating
 *   what the member table below already lists row by row; they are now
 *   a single subordinate line, and the space went to the one thing a
 *   treasurer actually wants at a glance — how close the lodge is to
 *   collecting the year.
 * - Tables use the shared .data-box/.dash-th/.dash-td classes instead
 *   of per-cell inline styles. Those classes already carry the mobile
 *   horizontal-scroll behavior this page was hand-rolling in a <style>
 *   block, so that block is gone too.
 * - The Send Reminders control is now a real client component. See
 *   components/lodge/DuesReminderButton.tsx for what was wrong with it.
 */
export default async function LodgeDuesPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const tenant = await getTenantBySlug(params.slug)
  if (!tenant) notFound()

  // Read-only for officers the finance routes would reject. Presentation
  // only — /api/dues/rate, /api/dues/charges and /api/dues/remind each
  // re-check the tier server-side.
  const viewer = await getSessionUser()
  const [viewerProfile, viewerMembership] = await Promise.all([
    viewer ? getProfile(viewer.id) : Promise.resolve(null),
    viewer ? getMembership(tenant.id, viewer.id) : Promise.resolve(null),
  ])
  const canManageFinance = can(
    (viewerMembership as any)?.tenant_role ?? null,
    'finance',
    viewerProfile?.platform_role === 'super_admin',
    viewer ? await loadOverrides(tenant.id, viewer.id) : {}
  )

  const [{ data: members }, { data: payments }, { data: charges }] = await Promise.all([
    supabase.from('tenant_members').select('*, profiles(first_name, last_name, email)').eq('tenant_id', tenant.id).eq('is_active', true).order('created_at'),
    supabase.from('payments').select('*, profiles!payments_member_id_fkey(first_name, last_name)').eq('tenant_id', tenant.id).eq('status', 'succeeded').order('created_at', { ascending: false }).limit(20),
    supabase
      .from('member_charges')
      .select('*, profiles!member_charges_member_id_fkey(first_name, last_name)')
      .eq('tenant_id', tenant.id)
      // Outstanding first, then most recent — a treasurer opens this
      // page to see what is owed, not what was settled last spring.
      .order('status')
      .order('created_at', { ascending: false }),
  ])

  // Transfers a brother has reported but nobody has checked against the
  // bank yet. Card payments never appear here — Stripe confirms those.
  const { data: pendingTransfers } = await supabase
    .from('payments')
    .select('id, member_id, amount, dues_year, payment_method, reported_at, reference_note, profiles!payments_member_id_fkey(first_name, last_name)')
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending')
    .not('payment_method', 'is', null)
    .neq('payment_method', 'card')
    .order('reported_at', { ascending: false })

  const rate = tenant.dues_amount ?? 60
  const paid = members?.filter((m: any) => m.dues_status === 'paid') ?? []
  const due = members?.filter((m: any) => m.dues_status === 'due') ?? []
  const exempt = members?.filter((m: any) => m.dues_status === 'exempt') ?? []

  const collected = paid.length * rate
  const outstanding = due.length * rate
  const expected = collected + outstanding
  const pctCollected = expected > 0 ? Math.round((collected / expected) * 100) : 100

  // Penalties and fees are money owed on top of dues. Folded into the
  // Outstanding figure so the headline number is what the lodge is
  // actually owed, not just its dues subtotal — but deliberately kept
  // OUT of the collection-rate bar below, which measures dues against
  // the annual rate and would be distorted by one-off charges.
  const chargesOutstanding = (charges ?? [])
    .filter((c: any) => c.status === 'outstanding')
    .reduce((a: number, c: any) => a + Number(c.amount), 0)

  const duesTone: Record<string, string> = { paid: 'pill-active', due: 'pill-new', exempt: 'pill-ea' }

  const money = (n: number) => `$${n.toLocaleString()}`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: T.ink, marginBottom: '0.25rem' }}>
            Dues — {new Date().getFullYear()}
          </h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: T.inkFaint }}>
            {paid.length} paid · {due.length} outstanding · {exempt.length} exempt
          </p>
        </div>
        {canManageFinance && <DuesReminderButton tenantId={tenant.id} dueCount={due.length} />}
      </div>

      {/* Three figures, not six. Collected and Outstanding are the
          decisions; Annual Rate is the context that makes them legible. */}
      <div className="data-box" style={{ padding: '1.5rem 1.4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Collected', value: money(collected), tone: T.success },
            { label: 'Outstanding', value: money(outstanding + chargesOutstanding), tone: (due.length > 0 || chargesOutstanding > 0) ? T.danger : T.inkFaint },
          ].map(({ label, value, tone }) => (
            <div key={label}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: T.gold, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {label}
              </div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.7rem', fontWeight: 700, color: tone, lineHeight: 1 }}>
                {value}
              </div>
            </div>
          ))}

          {/* Editable in place — this is the number the whole page is
              built around, and it previously lived only on the Settings
              page among branding and contact fields. */}
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: T.gold, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Annual Rate
            </div>
            {canManageFinance ? (
              <DuesRateEditor tenantId={tenant.id} current={rate} />
            ) : (
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.7rem', fontWeight: 700, color: T.ink, lineHeight: 1 }}>
                {money(rate)}
              </div>
            )}
          </div>
        </div>

        {/* Collection progress — the one number a treasurer is actually
            tracking through the year, which the old six-cell strip made
            you compute in your head. */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: T.gold, textTransform: 'uppercase' }}>
              Collection Rate
            </span>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: T.ink }}>
              {pctCollected}% of {money(expected)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={pctCollected}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Dues collected this year"
            style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}
          >
            <div style={{ width: `${pctCollected}%`, height: '100%', background: T.gold, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>

      <div className="data-box">
        <div className="data-box-head">Member Dues Status</div>
        {members && members.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Brother', 'Contact', 'Degree', 'Amount', 'Status', 'Paid On'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id}>
                  <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>
                    Bro. {m.profiles?.first_name} {m.profiles?.last_name}
                  </td>
                  <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: T.inkFaint }}>
                    {m.profiles?.email || '—'}
                  </td>
                  <td className="dash-td"><span className="pill pill-ea">{m.degree}</span></td>
                  <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>
                    {m.dues_status === 'exempt' ? '—' : money(rate)}
                  </td>
                  <td className="dash-td"><span className={`pill ${duesTone[m.dues_status] ?? 'pill-new'}`}>{m.dues_status}</span></td>
                  <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: T.inkFaint }}>
                    {m.dues_paid_at ? format(new Date(m.dues_paid_at), 'MMM d, yyyy') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: T.inkFaint, fontStyle: 'italic' }}>
            No active members on the roster yet.
          </div>
        )}
      </div>

      {canManageFinance && (
        <PendingTransfers tenantId={tenant.id} pending={(pendingTransfers ?? []) as any} />
      )}

      {canManageFinance && (
        <ChargesPanel
          tenantId={tenant.id}
          members={(members ?? []).map((m: any) => ({ user_id: m.user_id, profiles: m.profiles }))}
          charges={(charges ?? []) as any}
        />
      )}

      <div className="data-box">
        <div className="data-box-head">Recent Payments</div>
        {payments && payments.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Brother', 'Amount', 'Year', 'Date', 'Receipt'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id}>
                  <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>
                    Bro. {p.profiles?.first_name} {p.profiles?.last_name}
                  </td>
                  <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: T.success }}>${p.amount}</td>
                  <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: T.inkFaint }}>{p.dues_year || '—'}</td>
                  <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: T.inkFaint }}>
                    {format(new Date(p.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="dash-td">
                    {p.receipt_url
                      ? <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: T.gold, textDecoration: 'none' }}>View ↗</a>
                      : <span style={{ color: T.inkFainter }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: T.inkFaint, fontStyle: 'italic' }}>
            No payments recorded yet.
          </div>
        )}
      </div>
    </div>
  )
}
