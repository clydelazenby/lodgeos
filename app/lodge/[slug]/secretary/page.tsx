import { notFound, redirect } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import { can } from '@/lib/auth/permissions'
import { SecretaryConversation } from '@/components/lodge/ai/SecretaryConversation'

/**
 * The AI Secretary, given a room of its own.
 *
 * The docked panel is 380 pixels wide, which is the right size for
 * "who owes dues?" and the wrong size for the job it was actually built
 * to do. Drafting a set of minutes meant writing six hundred words into
 * a box the size of a business card, unable to see the top of the draft
 * while working on the foot of it, with the lodge page it was drawn
 * from hidden behind it.
 *
 * Two doors onto one assistant: the bubble for a question asked in
 * passing, this page for work. The conversation is shared — the thread
 * lives in sessionStorage, keyed by lodge — so a question asked in the
 * panel can be carried in here and continued without repeating it.
 *
 * Access matches the panel exactly, which is to say the API route's own
 * requireTenantAdmin: any seated officer, plus a platform admin. This
 * page adds no reach of its own; the route re-checks on every request
 * and every tool query runs under the officer's own RLS session.
 */
export default async function LodgeSecretaryPage({ params }: { params: { slug: string } }) {
  const [user, tenant] = await Promise.all([getSessionUser(), getTenantBySlug(params.slug)])

  if (!user) redirect('/auth/login')
  if (!tenant) notFound()

  const [membership, profile] = await Promise.all([
    getMembership(tenant.id, user.id),
    getProfile(user.id),
  ])

  const isSuperAdmin = profile?.platform_role === 'super_admin'
  if (!membership && !isSuperAdmin) redirect('/auth/login')
  if (membership && (membership as any).tenant_role === 'member') redirect('/portal')

  const canSendNotices = can((membership as any)?.tenant_role ?? null, 'communications', isSuperAdmin)

  return (
    <div>
      <div style={{ marginBottom: '1.4rem' }}>
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.62rem',
            letterSpacing: '0.3em',
            color: '#C9A84C',
            marginBottom: '0.5rem',
          }}
        >
          THE EAST DESK
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          AI Secretary
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          Ask about the lodge, or paste rough notes and have them drafted. It reads live records and
          writes drafts; it sends nothing on its own.
        </p>
      </div>

      <div className="lodgeos-ai-page">
        <SecretaryConversation
          tenantId={tenant.id}
          slug={params.slug}
          canSendNotices={canSendNotices}
        />
      </div>
    </div>
  )
}
