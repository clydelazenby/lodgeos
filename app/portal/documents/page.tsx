import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { DocumentDownloadLink } from '@/components/lodge/DocumentUpload'
import { meetsDegree, degreeLabel, degreeShortLabel } from '@/lib/degrees'

/**
 * The lodge library, as a brother sees it.
 *
 * The documents themselves were only reachable from the officer-facing
 * lodge page, so a plain member had no route to the by-laws, the
 * minutes or the degree instruction at all.
 *
 * FILTERING IS THE SAME RULE THE DOWNLOAD ROUTE ENFORCES, deliberately
 * — meetsDegree() from lib/degrees, which both use. A list that showed
 * titles the click would refuse would be worse than useless here: for
 * degree-restricted material the title is often the sensitive part, so
 * a document he may not open is a document he may not see named.
 *
 * Note that officer tier is NOT a bypass, exactly as on the lodge-side
 * page. The restriction is about degree, and being Treasurer does not
 * make a man a Master Mason.
 */
export default async function PortalDocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('platform_role').eq('id', user.id).single(),
    supabase.from('tenant_members')
      .select('tenant_id, degree')
      .eq('user_id', user.id).eq('is_active', true).single(),
  ])

  if (!membership) redirect('/auth/login')

  const myDegree = (membership as any).degree
  const isSuperAdmin = profile?.platform_role === 'super_admin'

  const { data: allDocs } = await supabase
    .from('documents')
    .select('*')
    .eq('tenant_id', (membership as any).tenant_id)
    .order('created_at', { ascending: false })

  const visible = (allDocs ?? []).filter((d: any) =>
    isSuperAdmin || meetsDegree(myDegree, d.access_level)
  )

  const hiddenCount = (allDocs?.length ?? 0) - visible.length

  // Grouped by the lodge's own categories, so a long library reads as
  // sections rather than one undifferentiated list.
  const byCategory = new Map<string, any[]>()
  for (const doc of visible) {
    const key = doc.category || 'Other'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(doc)
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>LODGE LIBRARY</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Documents</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
          Everything open to a {degreeLabel(myDegree)}.
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="data-box">
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>
            {hiddenCount > 0
              ? 'Nothing in the library is open to your degree yet.'
              : 'The lodge has not published any documents yet.'}
          </div>
        </div>
      ) : (
        Array.from(byCategory.entries()).map(([category, docs]) => (
          <div className="data-box" key={category} style={{ marginBottom: '1rem' }}>
            <div className="data-box-head">
              <span>{category}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
                {docs.length}
              </span>
            </div>
            {docs.map((d: any, i: number) => (
              <div key={d.id} style={{ padding: '0.95rem 1.4rem', borderBottom: i < docs.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '200px', flex: 1 }}>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: '#F5F0E8', marginBottom: '2px' }}>{d.name}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>
                    {format(new Date(d.created_at), 'MMM d, yyyy')}
                    {d.access_level && d.access_level !== 'all' && ` · ${degreeShortLabel(d.access_level)}+`}
                  </div>
                  {d.description && (
                    <p style={{ fontFamily: 'Crimson Pro, serif', color: '#B8B0A0', fontSize: '0.9rem', margin: '6px 0 0', lineHeight: 1.6 }}>
                      {d.description}
                    </p>
                  )}
                </div>
                <DocumentDownloadLink documentId={d.id} />
              </div>
            ))}
          </div>
        ))
      )}

      {hiddenCount > 0 && (
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: 'rgba(184,176,160,0.6)', fontSize: '0.9rem', marginTop: '1.25rem' }}>
          {hiddenCount} {hiddenCount === 1 ? 'document is' : 'documents are'} reserved for a higher degree
          and {hiddenCount === 1 ? 'is' : 'are'} not shown.
        </p>
      )}
    </div>
  )
}
