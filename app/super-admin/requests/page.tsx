import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

/**
 * Lodges that have asked to use LodgeOS.
 *
 * THESE HAD NOWHERE TO LIVE. The request route saved a row and emailed
 * the platform owner, and that email was the only copy — nothing in the
 * app listed them, so a request sat at status 'new' for ever and a
 * deleted email lost it entirely. The first one to arrive was from the
 * Senior Warden of a lodge already on the platform, which is precisely
 * the sort of thing you want a queue for rather than an inbox.
 *
 * Open ones first, because a decided request is a record and an
 * undecided one is work.
 */
export default async function AccessRequestsPage() {
  const supabase = await createClient()
  const { data: requests } = await supabase
    .from('platform_access_requests')
    .select('*')
    .order('created_at', { ascending: false })

  const all = (requests ?? []) as any[]
  const open = all.filter(r => r.status === 'new' || r.status === 'contacted')
  const settled = all.filter(r => r.status === 'approved' || r.status === 'declined')

  const pill: Record<string, string> = {
    new: 'pill-new', contacted: 'pill-trial', approved: 'pill-active', declined: 'pill-canceled',
  }

  const table = (rows: any[], empty: string) => (
    <div className="data-box" style={{ marginBottom: '2rem' }}>
      {rows.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic' }}>
          {empty}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Lodge', 'Contact', 'Members', 'Status', 'Asked', ''].map(h => <th key={h} className="dash-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="dash-td">
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem' }}>
                    {r.lodge_name}{r.lodge_number ? ` #${r.lodge_number}` : ''}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>
                    {r.jurisdiction || '—'}
                  </div>
                </td>
                <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>
                  <div>{r.contact_name}{r.contact_role ? ` — ${r.contact_role}` : ''}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', wordBreak: 'break-word' }}>{r.contact_email}</div>
                </td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: '#B8B0A0', textAlign: 'center' }}>
                  {r.member_count ?? '—'}
                </td>
                <td className="dash-td"><span className={`pill ${pill[r.status] ?? 'pill-new'}`}>{r.status}</span></td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#B8B0A0' }}>
                  {format(new Date(r.created_at), 'MMM d, yyyy')}
                </td>
                <td className="dash-td">
                  <Link href={`/super-admin/requests/${r.id}`} className="btn-outline" style={{ fontSize: '0.62rem', textDecoration: 'none' }}>
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Access Requests</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
          {open.length} waiting on a decision
        </p>
      </div>

      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
        Waiting
      </div>
      {table(open, 'Nothing waiting.')}

      {settled.length > 0 && (
        <>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#918879', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Decided
          </div>
          {table(settled, '')}
        </>
      )}
    </div>
  )
}
