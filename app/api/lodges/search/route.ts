import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Finding your own lodge, from the outside.
 *
 * PUBLIC, AND DELIBERATELY SO. A brother who cannot sign in has no
 * account to search with — he is exactly the person this serves. It
 * returns only what the lodge's own public page at /[slug] already
 * shows the world: its name, its number and its address on this site.
 * No contact details, no roster, no counts.
 *
 * WHY IT EXISTS. The Senior Warden of a lodge already on LodgeOS could
 * not sign in, found "Request Access", and filled in the form that
 * signs up a NEW lodge — because there was no way to say "my lodge is
 * already here, I just cannot get in". This is the other half of that
 * answer: he names his lodge and is sent to its own door.
 */
/**
 * Read at request time, never prerendered. The query string IS the
 * request here, so there is nothing to build ahead of time — without
 * this Next tries and logs a dynamic-server error on every build.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim()

    // Two characters matches half the platform and is not a search.
    if (q.length < 2) return NextResponse.json({ lodges: [] })

    const service = createServiceClient()

    /**
     * Matched on name OR number, because a brother is as likely to
     * know "1827" as "Psalms of Job". % and _ are escaped: they are
     * wildcards in ilike, and a query of "%" would otherwise return
     * every lodge on the platform.
     */
    const needle = q.replace(/[%_\\]/g, m => `\\${m}`)

    const { data } = await service
      .from('tenants')
      .select('name, number, slug, city, state')
      .or(`name.ilike.%${needle}%,number.ilike.%${needle}%`)
      .order('name')
      .limit(10)

    return NextResponse.json({
      lodges: (data ?? []).map((t: any) => ({
        name: t.name,
        number: t.number,
        slug: t.slug,
        where: [t.city, t.state].filter(Boolean).join(', ') || null,
      })),
    })
  } catch (error: any) {
    console.error('Lodge search error:', error)
    // An empty list rather than an error: the page offers the "my lodge
    // is not here" path regardless, so a failed search must not become
    // a dead end.
    return NextResponse.json({ lodges: [] })
  }
}
