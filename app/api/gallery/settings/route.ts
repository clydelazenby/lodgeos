import { NextResponse } from 'next/server'
import { revalidateLodgePage } from '@/app/actions/revalidate'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'

/**
 * Whether the public site shows a Gallery at all, and what it says
 * above the photographs.
 *
 * gallery_enabled turns off the SECTION AND THE NAV LINK together. They
 * have to move as one: a "Gallery" entry in the navigation that scrolls
 * to nothing is worse than no entry, and that exact bug — a nav link
 * pointing at four empty placeholder boxes — is what migration 037 was
 * written to fix. Splitting the two settings would let a lodge
 * reintroduce it.
 */
/** Kept in step with the check constraint in migration 040. */
const THUMB_LABELS = new Set(['caption', 'caption_date', 'date', 'none'])

export async function PATCH(request: Request) {
  try {
    const { tenantId, enabled, heading, intro, thumbLabel } = await request.json()
    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })

    const auth = await requireCapability(tenantId, 'settings')
    if (!auth.ok) return auth.response

    const patch: Record<string, any> = {}
    if (enabled !== undefined) patch.gallery_enabled = Boolean(enabled)
    if (heading !== undefined) patch.gallery_heading = String(heading ?? '').trim().slice(0, 120) || null
    if (intro !== undefined) patch.gallery_intro = String(intro ?? '').trim().slice(0, 400) || null
    if (thumbLabel !== undefined) {
      // Checked against the same list as the database constraint, so a
      // bad value is a clean 400 rather than a 500 from Postgres.
      if (!THUMB_LABELS.has(String(thumbLabel))) {
        return NextResponse.json({ error: `'${thumbLabel}' is not a thumbnail setting.` }, { status: 400 })
      }
      patch.gallery_thumb_label = String(thumbLabel)
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
    }

    const { data, error } = await createServiceClient()
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select('gallery_enabled, gallery_heading, gallery_intro, gallery_thumb_label')
      .single()

    if (error) throw error

    // Turning the section on or off changes the NAV as well as the
    // page, so both have to be regenerated or the menu keeps offering
    // a Gallery the site no longer shows.
    try {
      const { data: lodge } = await createServiceClient()
        .from('tenants').select('slug').eq('id', tenantId).maybeSingle()
      if ((lodge as any)?.slug) await revalidateLodgePage((lodge as any).slug)
    } catch (e) {
      console.error('Gallery cache purge failed (the setting itself is saved):', e)
    }

    return NextResponse.json({ success: true, settings: data })
  } catch (error: any) {
    console.error('Gallery settings error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
