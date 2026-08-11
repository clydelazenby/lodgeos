import { redirect, notFound } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { loadOverrides } from '@/lib/auth/capabilities'
import { canWithTiers } from '@/lib/auth/permissions'
import { GalleryManager } from '@/components/lodge/GalleryManager'

/**
 * The photographs on the lodge's public site.
 *
 * Guarded by 'settings' — the rest of the public site's content sits
 * behind the same capability — and read through canWithTiers so that a
 * lodge which has handed the gallery to its Historian by exception gets
 * the page as well as the routes behind it.
 */
export default async function GalleryPage({ params }: { params: { slug: string } }) {
  const [user, tenant] = await Promise.all([getSessionUser(), getTenantBySlug(params.slug)])
  if (!user) redirect('/auth/login')
  if (!tenant) notFound()

  const [membership, profile] = await Promise.all([
    getMembership(tenant.id, user.id),
    getProfile(user.id),
  ])

  const isSuperAdmin = profile?.platform_role === 'super_admin'
  if (!membership && !isSuperAdmin) redirect('/auth/login')

  const role = (membership as any)?.tenant_role ?? null
  const allowed = canWithTiers(
    role, 'settings', isSuperAdmin,
    await loadOverrides(tenant.id, user.id),
    ['admin', 'secretary', 'grand_master']
  )
  if (!allowed) redirect(`/lodge/${params.slug}/dashboard`)

  const supabase = await createClient()
  const { data: photos } = await supabase
    .from('gallery_photos')
    .select('id, url, thumb_url, caption, alt_text, taken_on, is_published, width, height, bytes')
    .eq('tenant_id', tenant.id)
    .order('sort_order')
    .order('created_at')

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: '1.6rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          THE PUBLIC SITE
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Gallery
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          The photographs a visitor sees. Add them here and they appear on the lodge&rsquo;s
          front page — the hall, the officers, the degree nights, the breakfasts.
        </p>
      </div>

      <GalleryManager
        tenantId={tenant.id}
        slug={params.slug}
        photos={(photos ?? []) as any}
        settings={{
          gallery_enabled: (tenant as any).gallery_enabled ?? true,
          gallery_heading: (tenant as any).gallery_heading ?? null,
          gallery_intro: (tenant as any).gallery_intro ?? null,
        }}
      />
    </div>
  )
}
