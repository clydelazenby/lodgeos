import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { RequestReview } from '@/components/super-admin/RequestReview'
import { isSameLodge, normaliseLodgeNumber } from '@/lib/lodgeMatch'

/**
 * One request, and the decision.
 *
 * Reached from the buttons in the alert email, which carry ?action=
 * so the page opens with that choice already made and waits for one
 * confirmation. The super-admin layout above this is what keeps a
 * forwarded link from reaching it, and the route behind the button
 * re-checks anyway.
 */
export default async function AccessRequestPage({
  params, searchParams,
}: {
  params: { id: string }
  searchParams?: { action?: string }
}) {
  const supabase = await createClient()

  const { data: request } = await supabase
    .from('platform_access_requests').select('*').eq('id', params.id).maybeSingle()

  if (!request) notFound()
  const r = request as any

  /**
   * Is this lodge already here? The same question the alert email
   * asked, re-asked on the page where the decision is actually taken —
   * a lodge may have been created in between — and answered by the same
   * matcher, so the email and the page cannot disagree.
   */
  let duplicateOf: { name: string; number: string | null; slug: string } | null = null
  if (normaliseLodgeNumber(r.lodge_number)) {
    const { data: candidates } = await supabase
      .from('tenants').select('name, number, jurisdiction, slug').not('number', 'is', null).limit(200)
    const hit = (candidates ?? []).find((t: any) => isSameLodge(
      { name: r.lodge_name, number: r.lodge_number, jurisdiction: r.jurisdiction }, t)) as any
    if (hit) duplicateOf = { name: hit.name, number: hit.number, slug: hit.slug }
  }

  const wanted = searchParams?.action
  const initialAction =
    wanted === 'approve' || wanted === 'decline' || wanted === 'question' ? wanted : null

  return (
    <div>
      <Link
        href="/super-admin/requests"
        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.15em', color: '#B8B0A0', textDecoration: 'none', display: 'block', marginBottom: '1.5rem' }}
      >
        ← ALL REQUESTS
      </Link>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.25em', color: '#C9A84C', marginBottom: '0.4rem' }}>
          ACCESS REQUEST
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: '#F5F0E8', margin: 0 }}>
          {r.lodge_name}{r.lodge_number ? ` #${r.lodge_number}` : ''}
        </h1>
      </div>

      <RequestReview request={r} duplicateOf={duplicateOf} initialAction={initialAction} />
    </div>
  )
}
