import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicGallery } from '@/components/public/PublicGallery'

/**
 * The lodge's photographs, on a page of their own.
 *
 * WHY A PAGE AND NOT JUST THE ANCHOR on the front page. This is what
 * gets EMAILED, and a link that drops a brother halfway down a long
 * scrolling site — past the hero, the history, the calendar — is a link
 * that arrives somewhere confusing. It is also what gets shared: a
 * lodge that wants to send its photographs to a widow or a visiting
 * brother should be able to send exactly that and nothing else.
 *
 * The front page keeps its gallery section, now showing the first
 * dozen with a link through to here. Both read the same rows.
 */

export const revalidate = 300

async function load(slug: string) {
  const supabase = createServiceClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, number, slug, rite, city, state, gallery_enabled, gallery_heading, gallery_intro, gallery_thumb_label')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) return null

  /**
   * THE is_published FILTER IS LOAD-BEARING, exactly as on the front
   * page: this reads with the service client because the page is
   * rendered for visitors with no session, and that bypasses RLS. A
   * photograph the lodge has taken down stays down because of this
   * line.
   */
  const { data: photos } = await supabase
    .from('gallery_photos')
    .select('id, url, thumb_url, caption, alt_text, taken_on, width, height')
    .eq('tenant_id', (tenant as any).id)
    .eq('is_published', true)
    .order('sort_order')
    .order('created_at')

  return { tenant: tenant as any, photos: photos ?? [] }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await load(params.slug)
  if (!data) return { title: 'Gallery' }
  const { tenant, photos } = data
  const title = `${tenant.gallery_heading || 'Gallery'} — ${tenant.name} #${tenant.number}`
  return {
    title,
    description:
      tenant.gallery_intro ||
      `Photographs from ${tenant.name} #${tenant.number}${tenant.city ? `, ${tenant.city}` : ''}.`,
    // The first photograph is what a link to this page shows when it is
    // pasted into a message — which is the whole point of sending it.
    openGraph: {
      title,
      images: photos[0]?.url ? [{ url: photos[0].url }] : undefined,
    },
  }
}

export default async function PublicGalleryPage({ params }: { params: { slug: string } }) {
  const data = await load(params.slug)
  if (!data) notFound()

  const { tenant, photos } = data
  if (tenant.gallery_enabled === false) notFound()

  const gold = '#C9A84C'
  const navy = '#0D1B2A'
  const cream = '#F4EFE6'
  const dim = '#DCCFB5'

  return (
    <div style={{ minHeight: '100vh', background: navy, color: cream, fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '3.5rem 1.5rem 5rem', minWidth: 0 }}>
        <Link
          href={`/${params.slug}`}
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', color: dim, textDecoration: 'none', textTransform: 'uppercase' }}
        >
          ← {tenant.name} #{tenant.number}
        </Link>

        <h1 style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: '2.4rem', color: cream, margin: '1.25rem 0 0.5rem' }}>
          {tenant.gallery_heading || 'Our Lodge'}
        </h1>

        {tenant.gallery_intro && (
          <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: '1.05rem', color: dim, maxWidth: '46rem', lineHeight: 1.7, marginBottom: '2rem' }}>
            {tenant.gallery_intro}
          </p>
        )}

        {photos.length === 0 ? (
          <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontStyle: 'italic', color: dim, marginTop: '2rem' }}>
            There are no photographs here yet.
          </p>
        ) : (
          <div style={{ marginTop: '2rem' }}>
            <PublicGallery
              photos={photos as any}
              lodgeName={`${tenant.name} #${tenant.number}`}
              thumbLabel={tenant.gallery_thumb_label ?? 'caption'}
            />
          </div>
        )}

        <div style={{ marginTop: '3.5rem', borderTop: `1px solid ${gold}20`, paddingTop: '1.5rem' }}>
          <Link
            href={`/${params.slug}`}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', color: gold, textDecoration: 'none', textTransform: 'uppercase' }}
          >
            Back to {tenant.name} #{tenant.number} →
          </Link>
        </div>
      </div>
    </div>
  )
}
