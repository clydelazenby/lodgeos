import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { DocumentDownloadLink } from '@/components/lodge/DocumentUpload'
import { meetsDegree, degreeLabel, degreeShortLabel } from '@/lib/degrees'
import { completion, nextStep, DEGREE_TITLE } from '@/lib/curriculum'

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

  const [{ data: allDocs }, { data: steps }, { data: myProgress }] = await Promise.all([
    supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', (membership as any).tenant_id)
      .order('created_at', { ascending: false }),
    // His own degree's work, in order. RLS lets any member read the
    // steps — a candidate must be able to see what he is working
    // toward — while the documents behind them keep their degree floor.
    supabase
      .from('curriculum_steps')
      .select('id, degree, title, description, sort_order, document_id, required')
      .eq('tenant_id', (membership as any).tenant_id)
      .eq('degree', myDegree)
      .order('sort_order'),
    supabase
      .from('curriculum_progress')
      .select('step_id, completed_on, signed_off_by_name, notes')
      .eq('tenant_id', (membership as any).tenant_id)
      .eq('member_id', user.id),
  ])

  const visible = (allDocs ?? []).filter((d: any) =>
    isSuperAdmin || meetsDegree(myDegree, d.access_level)
  )

  const hiddenCount = (allDocs?.length ?? 0) - visible.length

  /**
   * WHERE HE IS, which he could not previously find out.
   *
   * The portal showed a flat library and left the candidate to work out
   * the order himself. The lodge knew the order all along; it simply
   * had nowhere to write it down.
   *
   * Only shown while there IS a curriculum for his degree — a Master
   * Mason of thirty years does not want a checklist, and an empty one
   * would read as a demand rather than a guide.
   */
  const mySteps = (steps ?? []) as any[]
  const done = new Set((myProgress ?? []).map((p: any) => p.step_id))
  const progressStats = completion(mySteps as any, done)
  const myNext = nextStep(mySteps as any, done)
  const docById = new Map(visible.map((d: any) => [d.id, d]))

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

      {/* YOUR OWN WORK, IN ORDER.
          The library is alphabetical furniture; this is the answer to
          "what do I do next", which the lodge always knew and had
          nowhere to write down. Absent for a brother with no curriculum
          — a Master Mason of thirty years does not want a checklist. */}
      {mySteps.length > 0 && (
        <div className="data-box">
          <div className="data-box-head">
            <span>Your {DEGREE_TITLE[myDegree as keyof typeof DEGREE_TITLE] ?? myDegree} Work</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
              {progressStats.done}/{progressStats.total}
            </span>
          </div>

          <div style={{ padding: '1rem 1.4rem 0' }}>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: '0.8rem' }}>
              <div style={{ height: '100%', width: `${progressStats.percent}%`, background: '#C9A84C', borderRadius: 2 }} />
            </div>
            {myNext ? (
              <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#E8E2D5', margin: '0 0 0.4rem' }}>
                Next: <strong style={{ color: '#F5F0E8' }}>{myNext.title}</strong>
                {myNext.description ? ` — ${myNext.description}` : ''}
              </p>
            ) : (
              <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#5DBE85', margin: '0 0 0.4rem' }}>
                You have completed every required step. Speak to your mentor about what follows.
              </p>
            )}
            <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.85rem', color: '#918879', margin: '0 0 1rem' }}>
              Steps are signed off by an officer who has heard them — that is what a proficiency
              means, so they cannot be ticked here.
            </p>
          </div>

          {mySteps.map((s: any) => {
            const isDone = done.has(s.id)
            const material = s.document_id ? docById.get(s.document_id) : null
            return (
              <div key={s.id} style={{ padding: '0.7rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ color: isDone ? '#5DBE85' : '#3A4155', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {isDone ? '✓' : '○'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: isDone ? '#918879' : '#F5F0E8' }}>
                    {s.title}
                    {!s.required && <span style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#918879' }}> · optional</span>}
                  </span>
                  {s.description && (
                    <span style={{ display: 'block', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: '#B8B0A0' }}>
                      {s.description}
                    </span>
                  )}
                  {/* Only when the material is open to his degree — a
                      step may point at something he cannot yet read,
                      and naming it would leak what the floor hides. */}
                  {material && (
                    <a href={`/api/documents/${material.id}/download`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>
                      📄 {material.name}
                    </a>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

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
