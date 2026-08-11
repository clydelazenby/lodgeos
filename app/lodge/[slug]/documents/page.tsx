import { createClient } from '@/lib/supabase/server'
import { getTenantBySlug, getSessionUser, getMembership, getProfile } from '@/lib/supabase/queries'
import { loadOverrides } from '@/lib/auth/capabilities'
import { notFound } from 'next/navigation'
import { DocumentUploadButton } from '@/components/lodge/DocumentUpload'
import { DocumentsTabs } from '@/components/lodge/DocumentsTabs'
import { can } from '@/lib/auth/permissions'
import { DEGREE_RANK } from '@/lib/degrees'

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
  const [membership, profile, { data: allDocs }, { data: curriculumSteps }] = await Promise.all([
    user ? getMembership(tenant.id, user.id) : Promise.resolve(null),
    user ? getProfile(user.id) : Promise.resolve(null),
    supabase
      .from('documents')
      .select('*, profiles(first_name, last_name)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('curriculum_steps')
      .select('id, degree, title, description, sort_order, document_id, required')
      .eq('tenant_id', tenant.id)
      .order('degree')
      .order('sort_order'),
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
  //
  // Now through the 'documents' capability rather than two hardcoded
  // tiers, so a Junior Deacon who actually keeps the library can be
  // given it — which is the whole point of the exceptions, and the
  // /api/documents routes read the same answer.
  const docOverrides = user ? await loadOverrides(tenant.id, user.id) : {}
  const canManage = can((membership as any)?.tenant_role ?? null, 'documents', isSuperAdmin, docOverrides)

  // Writing the curriculum is setting lodge policy, so it sits with the
  // Secretary's office and the Master. The route enforces the same set;
  // this only decides whether the controls render.
  const canEditCurriculum =
    can((membership as any)?.tenant_role ?? null, 'settings', isSuperAdmin, docOverrides) ||
    (membership as any)?.tenant_role === 'worshipful_master'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.6rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Document Library</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
            {isSuperAdmin
              ? 'All documents, unfiltered — platform administrator view'
              : `Showing what a ${(membership as any)?.degree ?? 'guest'} may access`}
          </p>
        </div>
        {canManage && (
          <DocumentUploadButton
            tenantId={tenant.id}
            existing={visible.map((d: any) => ({ id: d.id, name: d.name }))}
          />
        )}
      </div>

      <DocumentsTabs
        slug={params.slug}
        tenantId={tenant.id}
        documents={visible}
        curriculumSteps={(curriculumSteps ?? []) as any}
        canManage={canManage}
        canEditCurriculum={canEditCurriculum}
        hiddenCount={hiddenCount}
      />
    </div>
  )
}
