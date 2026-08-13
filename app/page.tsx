import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { normaliseHost } from '@/lib/domains'

/**
 * The front door, which belongs to whoever knocked on it.
 *
 * THIS WAS `redirect('/psalms-of-job-1827')`, and that was not laziness
 * — it was the mechanism. psalmslodge1827.com points at this
 * application, and that one line is how the lodge's own domain reached
 * the lodge's own website. Pointing the root at the marketing page,
 * which is the obvious multi-tenant fix, would have taken a real
 * lodge's website down and replaced it with an advertisement for the
 * software it runs on.
 *
 * So the root answers by HOST. A request arriving on a lodge's own
 * domain is served that lodge; anything else — the platform's own
 * domain, a preview URL, a bare IP — gets the marketing page. Psalms of
 * Job behaves exactly as it did, now by lookup rather than by being
 * hardcoded into the software.
 *
 * SERVICE CLIENT, and it is not a shortcut: this runs for an anonymous
 * visitor who has no session at all, and the question being asked
 * ("whose domain is this?") is not one RLS can answer for a stranger.
 * Only the slug is read, and the answer is a redirect to a page that is
 * public anyway.
 */
export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const host = normaliseHost((await headers()).get('host'))

  if (host) {
    try {
      const { data: tenant } = await createServiceClient()
        .from('tenants')
        .select('slug')
        .eq('custom_domain', host)
        .maybeSingle()

      if ((tenant as any)?.slug) redirect(`/${(tenant as any).slug}`)
    } catch (error) {
      /**
       * A lodge's website must not 500 because a lookup failed. Falling
       * through to the marketing page is wrong for that visitor, but it
       * is a page rather than an error — and redirect() throws by
       * design, so it is re-thrown rather than swallowed here.
       */
      if ((error as any)?.digest?.startsWith?.('NEXT_REDIRECT')) throw error
      console.error('Root host lookup failed:', error)
    }
  }

  redirect('/start')
}
