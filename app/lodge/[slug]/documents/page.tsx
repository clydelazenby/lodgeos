import { createClient } from '@/lib/supabase/server'
import { getTenantBySlug, getSessionUser, getMembership, getProfile } from '@/lib/supabase/queries'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { DocumentUploadButton, DocumentDownloadLink, DocumentDeleteButton, DocumentPlayer } from '@/components/lodge/DocumentUpload'
// From lib, NOT from the component file. These are called during this
// server render, and a function imported from a 'use client' module is
// a client reference that throws when invoked on the server.
import { isPlayable, formatDuration } from '@/lib/documents'
import { DEGREE_RANK, degreeShortLabel } from '@/lib/degrees'

/**
 * Degree hierarchy — the SAME map the download route uses, now
 * imported from lib/degrees.ts rather than hand-copied into both. A Master Mason can open
 * anything an EA or FC can, so access_level is a FLOOR, not an
 * exact-match requirement.
 *
 * THIS PAGE PREVIOUSLY LISTED EVERY DOCUMENT TO EVERYONE.
 *
 * The download route enforced access_level correctly, but the list did
 * not filter at all — so an Entered Apprentice saw the names and
 * descriptions of Master Mason material and only hit a 403 on click.
 * For degree-restricted ritual material the title alone is often the
 * sensitive part, and a permission system that leaks what it's hiding
 * isn't doing its job.
 *
 * The rule applied here is exactly the rule the download route
 * enforces, so the list and the click can never disagree: filter by the
 * viewer's own degree, with super admins exempt. Note that officer tier
 * is deliberately NOT a bypass — the restriction is about degree, and
 * being Treasurer doesn't make someone a Master Mason.
 */

export default async function LodgeDocumentsPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const tenant = await getTenantBySlug(params.slug)
  if (!tenant) notFound()

  const user = await getSessionUser()
  const [membership, profile, { data: allDocs }] = await Promise.all([
    user ? getMembership(tenant.id, user.id) : Promise.resolve(null),
    user ? getProfile(user.id) : Promise.resolve(null),
    supabase
      .from('documents')
      .select('*, profiles(first_name, last_name)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }),
  ])

  const isSuperAdmin = profile?.platform_role === 'super_admin'
  const viewerRank = DEGREE_RANK[(membership as any)?.degree] ?? 0

  const visible = (allDocs ?? []).filter((d: any) => {
    if (isSuperAdmin) return true
    if (!d.access_level || d.access_level === 'all') return true
    return viewerRank >= (DEGREE_RANK[d.access_level] ?? 0)
  })

  const hiddenCount = (allDocs?.length ?? 0) - visible.length

  // Officers manage the library; everyone else only reads from it.
  const canManage =
    isSuperAdmin ||
    (membership as any)?.tenant_role === 'admin' ||
    (membership as any)?.tenant_role === 'secretary'

  const accessColor: Record<string, string> = { all: 'pill-active', EA: 'pill-ea', FC: 'pill-fc', MM: 'pill-mm' }

  // Category counts are computed from what this viewer can actually
  // see, so the tiles never advertise documents the list won't show.
  const categories = [
    { label: 'Degree Materials', key: 'Degree Materials' },
    { label: 'Meeting Minutes', key: 'Minutes' },
    { label: 'Administration', key: 'Administration' },
    { label: 'Grand Lodge', key: 'Grand Lodge' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Document Library</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
            {isSuperAdmin
              ? 'All documents, unfiltered — platform administrator view'
              : `Showing what a ${(membership as any)?.degree ?? 'guest'} may access`}
          </p>
        </div>
        {canManage && <DocumentUploadButton tenantId={tenant.id} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', marginBottom: '2rem' }}>
        {categories.map(({ label, key }) => (
          <div key={label} style={{ background: '#141C2E', padding: '1.25rem', boxShadow: '0 0 0 1px rgba(201,168,76,0.1)' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{label}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', fontWeight: 700, color: '#F5F0E8', lineHeight: 1 }}>
              {visible.filter((d: any) => d.category === key).length}
            </div>
          </div>
        ))}
      </div>

      <div className="data-box">
        <div className="data-box-head">Available To You</div>
        {visible.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Document', 'Category', 'Uploaded By', 'Date', 'Access Level', ''].map((h, i) => (
                  <th key={h || `col-${i}`} className="dash-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((d: any) => (
                <tr key={d.id}>
                  <td className="dash-td">
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isPlayable(d.mime_type) && (
                        <span title="Recording" style={{ color: '#C9A84C', fontSize: '0.7rem' }}>
                          {d.mime_type?.startsWith('video/') ? '▶' : '♪'}
                        </span>
                      )}
                      {d.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#B8B0A0', marginTop: '2px' }}>
                      {d.description || ''}
                      {formatDuration(d.duration_seconds) && (
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', marginLeft: d.description ? 8 : 0 }}>
                          {formatDuration(d.duration_seconds)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>{d.category}</td>
                  <td className="dash-td" style={{ fontSize: '0.82rem', color: '#B8B0A0' }}>{d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : '—'}</td>
                  <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#B8B0A0' }}>{format(new Date(d.created_at), 'MMM d, yyyy')}</td>
                  <td className="dash-td"><span className={`pill ${accessColor[d.access_level] ?? 'pill-new'}`}>{d.access_level === 'all' ? 'All Brothers' : `${degreeShortLabel(d.access_level)}+`}</span></td>
                  <td className="dash-td" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      {isPlayable(d.mime_type)
                        ? <DocumentPlayer documentId={d.id} mimeType={d.mime_type} name={d.name} />
                        : <DocumentDownloadLink documentId={d.id} />}
                      {canManage && <DocumentDeleteButton documentId={d.id} documentName={d.name} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>
            {(allDocs?.length ?? 0) > 0
              ? 'No documents are available at your degree yet.'
              : 'No documents uploaded yet. Upload degree materials, meeting minutes, and bylaws here.'}
          </div>
        )}
      </div>

      {/* Acknowledges that restricted material exists without naming it —
          otherwise a member who knows a document was circulated would
          reasonably think the library was broken. */}
      {hiddenCount > 0 && (
        <div style={{ marginTop: '1rem', padding: '1rem 1.5rem', background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', fontFamily: 'Crimson Pro, serif', color: '#B8B0A0', fontStyle: 'italic' }}>
          {hiddenCount} further {hiddenCount === 1 ? 'document is' : 'documents are'} held for higher degrees and will appear here as you advance.
        </div>
      )}

      <div style={{ marginTop: '1rem', padding: '1rem 1.5rem', background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0', letterSpacing: '0.08em' }}>ACCESS LEVELS:</span>
        {[['All Brothers', 'pill-active'], ['EA+', 'pill-ea'], ['FC+', 'pill-fc'], ['MM Only', 'pill-mm']].map(([l, c]) => (
          <span key={l} className={`pill ${c}`}>{l}</span>
        ))}
      </div>
    </div>
  )
}
