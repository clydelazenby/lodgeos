import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'

// Ledger-system tokens, matching tailwind.config.ts. Inlined as literals
// here rather than Tailwind classes because every other page in this
// app currently does the same — this page proves the new system works
// in place; a follow-up pass converts pages to actual `bg-vellum` /
// `text-ink` classes once the visual direction is confirmed.
const T = {
  vellum: '#F7F3E8', vellumDim: '#EDE6D3',
  ink: '#1C1810', inkFaint: '#6B6252', inkFainter: '#A39A87',
  seal: '#8B1E1E', sealDim: '#F1E1DD',
  ledger: '#2F4538', ledgerDim: '#E2E8DE',
  brass: '#B8923F', brassDim: '#EFE6CC',
  display: "'Fraunces', Georgia, serif",
  body: "'Source Sans 3', -apple-system, system-ui, sans-serif",
  figure: "'Spectral', Georgia, serif",
}

export default async function LodgeDuesPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: tenant } = await supabase.from('tenants').select('*').eq('slug', params.slug).single()
  if (!tenant) notFound()

  const [{ data: members }, { data: payments }] = await Promise.all([
    supabase.from('tenant_members').select('*, profiles(first_name, last_name, email)').eq('tenant_id', tenant.id).eq('is_active', true).order('created_at'),
    supabase.from('payments').select('*, profiles(first_name, last_name)').eq('tenant_id', tenant.id).eq('status', 'succeeded').order('created_at', { ascending: false }).limit(20),
  ])

  const paid = members?.filter((m: any) => m.dues_status === 'paid') ?? []
  const due = members?.filter((m: any) => m.dues_status === 'due') ?? []
  const exempt = members?.filter((m: any) => m.dues_status === 'exempt') ?? []
  const collected = paid.reduce((a: number, m: any) => a + (tenant.dues_amount ?? 60), 0)
  const outstanding = due.reduce((a: number, m: any) => a + (tenant.dues_amount ?? 60), 0)

  const statusTone: Record<string, { bg: string; text: string; border: string }> = {
    paid: { bg: T.ledgerDim, text: T.ledger, border: T.ledger },
    due: { bg: T.sealDim, text: T.seal, border: T.seal },
    exempt: { bg: T.brassDim, text: '#8A6A24', border: T.brass },
  }

  return (
    <div style={{ background: T.vellumDim, minHeight: '100%', padding: '0' }}>
      <div className="lodgeos-dues-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem', borderBottom: `2px solid ${T.ink}`, paddingBottom: '1.1rem' }}>
        <div>
          <div style={{ fontFamily: T.figure, fontSize: '11px', color: T.brass, letterSpacing: '0.12em', textTransform: 'uppercase', fontStyle: 'italic', marginBottom: '4px' }}>
            Folio · Dues &amp; Finance
          </div>
          <h1 style={{ fontFamily: T.display, fontSize: '1.6rem', fontWeight: 600, color: T.ink, margin: 0, letterSpacing: '-0.01em' }}>Dues Ledger — {new Date().getFullYear()}</h1>
        </div>
        <form action="/api/dues/remind" method="post">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <button type="submit" style={{
            background: 'transparent', border: `1px solid ${T.brass}`, color: T.ink,
            fontFamily: T.body, fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.02em',
            padding: '9px 18px', borderRadius: '2px', cursor: 'pointer',
          }}>
            Send Reminders ({due.length})
          </button>
        </form>
      </div>

      {/* Stat strip — one ruled folio, internally divided. 2 columns on mobile via lodgeos-stat-cell class. */}
      <div className="lodgeos-stat-strip" style={{ background: T.vellum, border: `1px solid ${T.brass}`, marginBottom: '1.75rem', display: 'flex', flexWrap: 'wrap' }}>
        {[
          { label: 'Collected', value: `$${collected.toLocaleString()}`, tone: T.ledger },
          { label: 'Outstanding', value: `$${outstanding.toLocaleString()}`, tone: T.seal },
          { label: 'Annual Rate', value: `$${tenant.dues_amount}`, tone: T.ink },
          { label: 'Paid', value: paid.length, tone: T.ledger },
          { label: 'Due', value: due.length, tone: T.seal },
          { label: 'Exempt', value: exempt.length, tone: T.inkFaint },
        ].map(({ label, value, tone }, i) => (
          <div key={label} className="lodgeos-stat-cell" style={{ padding: '1.1rem 1.4rem', flex: '1 1 140px', borderLeft: i > 0 ? `1px solid ${T.brassDim}` : 'none' }}>
            <div style={{ fontFamily: T.figure, fontSize: '10px', letterSpacing: '0.1em', color: T.inkFaint, textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontFamily: T.display, fontSize: '1.5rem', fontWeight: 600, color: tone, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Dues status table — horizontal scroll on mobile rather than
          cramming 6 columns into 320px, the honest standard pattern for
          data-dense tables. */}
      <div style={{ background: T.vellum, border: `1px solid ${T.brass}`, marginBottom: '1.75rem' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.brassDim}`, fontFamily: T.display, fontSize: '0.95rem', fontWeight: 600, color: T.ink }}>
          Member Dues Status — {new Date().getFullYear()}
        </div>
        <div className="lodgeos-table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
          <thead>
            <tr>
              {['Brother', 'Email', 'Degree', 'Amount', 'Status', 'Paid On'].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontFamily: T.figure, fontSize: '10px', letterSpacing: '0.09em', color: T.inkFainter, textTransform: 'uppercase', borderBottom: `1px solid ${T.brassDim}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members?.map((m: any, i: number) => (
              <tr key={m.id} style={{ borderBottom: i < (members?.length ?? 0) - 1 ? `1px solid ${T.vellumDim}` : 'none' }}>
                <td style={{ padding: '12px 20px', fontFamily: T.body, fontSize: '0.85rem', color: T.ink, fontWeight: 600 }}>Bro. {m.profiles?.first_name} {m.profiles?.last_name}</td>
                <td style={{ padding: '12px 20px', fontFamily: T.figure, fontSize: '0.75rem', color: T.inkFaint }}>{m.profiles?.email || '—'}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{ fontFamily: T.figure, fontSize: '10.5px', fontWeight: 600, color: T.inkFaint, border: `1px solid ${T.brassDim}`, background: T.vellumDim, padding: '2px 8px', letterSpacing: '0.05em' }}>{m.degree}</span>
                </td>
                <td style={{ padding: '12px 20px', fontFamily: T.figure, fontSize: '0.85rem', color: T.ink }}>${tenant.dues_amount}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{
                    fontFamily: T.figure, fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: statusTone[m.dues_status]?.bg, color: statusTone[m.dues_status]?.text,
                    border: `1px solid ${statusTone[m.dues_status]?.border}`, padding: '2px 9px',
                  }}>{m.dues_status}</span>
                </td>
                <td style={{ padding: '12px 20px', fontFamily: T.figure, fontSize: '0.75rem', color: T.inkFaint }}>
                  {m.dues_paid_at ? format(new Date(m.dues_paid_at), 'MMM d, yyyy') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Payment history */}
      <div style={{ background: T.vellum, border: `1px solid ${T.brass}` }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.brassDim}`, fontFamily: T.display, fontSize: '0.95rem', fontWeight: 600, color: T.ink }}>
          Payment History
        </div>
        <div className="lodgeos-table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
          <thead>
            <tr>
              {['Brother', 'Amount', 'Year', 'Date', 'Receipt'].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontFamily: T.figure, fontSize: '10px', letterSpacing: '0.09em', color: T.inkFainter, textTransform: 'uppercase', borderBottom: `1px solid ${T.brassDim}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments?.map((p: any, i: number) => (
              <tr key={p.id} style={{ borderBottom: i < (payments?.length ?? 0) - 1 ? `1px solid ${T.vellumDim}` : 'none' }}>
                <td style={{ padding: '12px 20px', fontFamily: T.body, fontSize: '0.85rem', color: T.ink, fontWeight: 600 }}>Bro. {p.profiles?.first_name} {p.profiles?.last_name}</td>
                <td style={{ padding: '12px 20px', fontFamily: T.figure, fontSize: '0.9rem', fontWeight: 600, color: T.ledger }}>${p.amount}</td>
                <td style={{ padding: '12px 20px', fontFamily: T.figure, fontSize: '0.8rem', color: T.inkFaint }}>{p.dues_year || '—'}</td>
                <td style={{ padding: '12px 20px', fontFamily: T.figure, fontSize: '0.75rem', color: T.inkFaint }}>{format(new Date(p.created_at), 'MMM d, yyyy')}</td>
                <td style={{ padding: '12px 20px' }}>{p.receipt_url ? <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: T.brass, fontSize: '0.8rem', fontFamily: T.body, fontWeight: 600 }}>View →</a> : <span style={{ color: T.inkFainter }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {(!payments || payments.length === 0) && <div style={{ padding: '2.5rem', textAlign: 'center', color: T.inkFaint, fontFamily: T.body, fontStyle: 'italic' }}>No payments recorded yet.</div>}
      </div>

      <style>{`
        .lodgeos-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (max-width: 640px) {
          .lodgeos-stat-cell { flex: 1 1 45% !important; }
          .lodgeos-dues-header { align-items: stretch; }
          .lodgeos-dues-header form { width: 100%; }
          .lodgeos-dues-header button { width: 100%; }
        }
      `}</style>
    </div>
  )
}
