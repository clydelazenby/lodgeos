import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { recipientsFor, notifyEach } from '@/lib/notifications.server'
import { sendGalleryPhotosEmail, APP_URL } from '@/lib/email'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * "There are new photographs on the website."
 *
 * ONE EMAIL FOR A BATCH, NOT ONE PER PHOTOGRAPH, and that is the whole
 * reason this is a separate route from the upload. A Secretary emptying
 * his phone after an installation uploads twenty pictures; twenty
 * uploads times ten brethren is two hundred emails, and the lodge would
 * learn to filter the lot within a week. The manager uploads each photo
 * silently and calls this once when the batch is done.
 *
 * IT IS ALSO WHERE "DON'T TELL ANYONE" IS IMPLEMENTED — by not calling
 * it. Correcting a caption, replacing a blurry shot, adding one picture
 * quietly to a set: none of those are news, and an announcement the
 * officer cannot hold back is one he works around by never uploading
 * during the week.
 *
 * WHAT IT SENDS IS PUBLIC. This is the only notice a brother on the
 * plain member tier receives, and it points at the lodge's public page
 * — nothing in it discloses anything a visitor could not already see.
 */
export async function POST(request: Request) {
  try {
    const { tenantId, photoIds } = await request.json()
    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })

    const auth = await requireCapability(tenantId, 'settings')
    if (!auth.ok) return auth.response

    const service = createServiceClient()

    /**
     * Counted from the PUBLISHED rows the caller names, read back from
     * the database rather than trusted from the request.
     *
     * A hidden photograph is not news — telling the lodge to go and
     * look at something that is not on the site is the one mistake this
     * notice must not make.
     */
    const ids: string[] = Array.isArray(photoIds)
      ? photoIds.filter((x: unknown) => typeof x === 'string')
      : []

    let query = service
      .from('gallery_photos')
      .select('id, caption')
      .eq('tenant_id', tenantId)
      .eq('is_published', true)
    if (ids.length) query = query.in('id', ids)
    else query = query.order('created_at', { ascending: false }).limit(1)

    const { data: photos } = await query
    const count = photos?.length ?? 0

    if (!count) {
      return NextResponse.json(
        { error: 'Nothing to announce — those photographs are not on the site.' },
        { status: 400 }
      )
    }

    const { data: lodge } = await service
      .from('tenants')
      .select(`slug, ${LODGE_BRAND_COLUMNS}`)
      .eq('id', tenantId)
      .maybeSingle()

    if (!lodge) return NextResponse.json({ error: 'Lodge not found.' }, { status: 404 })

    // A few, to say what they are of. All twenty would be a wall of
    // text in place of a reason to click.
    const captions = (photos ?? [])
      .map((p: any) => p.caption)
      .filter((c: string | null): c is string => !!c)
      .slice(0, 4)

    const addedBy = await actorName(auth.userId)
    // The gallery's OWN page, not the front page's anchor. A link that
    // drops a brother halfway down a long scrolling site arrives
    // somewhere confusing, and this is also what he will forward on.
    const galleryUrl = `${APP_URL}/${(lodge as any).slug}/gallery`

    /**
     * One tap to the switch, signed in or not.
     *
     * Sent through the sign-in page carrying where he was going, so a
     * brother who is not signed in finishes at the setting rather than
     * at a portal home page with the thing he came for two clicks away.
     * Middleware writes the same parameter when it turns anyone away,
     * and the login page only honours a path on this site.
     */
    const settingsPath = '/portal/profile?notifications=1'
    const settingsUrl = `${APP_URL}/auth/login?next=${encodeURIComponent(settingsPath)}`
    const lodgeName = `${(lodge as any).name} #${(lodge as any).number}`

    // The officer who just uploaded them is excluded — he has seen them.
    const recipients = await recipientsFor(tenantId, 'gallery.photo_added', auth.userId)
    const { sent, failed } = await notifyEach(recipients, (brother) =>
      sendGalleryPhotosEmail({
        to: brother.email,
        firstName: brother.name.split(' ')[0] || 'Brother',
        lodgeName,
        count,
        galleryUrl,
        settingsUrl,
        addedBy,
        captions,
        brand: toLodgeBrand(lodge),
      })
    )

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: addedBy,
      action: 'gallery.announced',
      summary:
        `Told the lodge about ${count} new photograph${count === 1 ? '' : 's'} — ` +
        `${sent} email${sent === 1 ? '' : 's'} sent${failed ? `, ${failed} failed` : ''}`,
      entityType: 'gallery_photo',
      entityId: null,
      detail: { count, sent, failed },
    })

    return NextResponse.json({
      success: true,
      count,
      sent,
      failed,
      // Said plainly so the officer knows whether anyone actually heard.
      message: sent
        ? `${sent} brother${sent === 1 ? '' : 's'} told about ${count} new photograph${count === 1 ? '' : 's'}.` +
          (failed ? ` ${failed} could not be reached.` : '')
        : 'Nobody was told — every brother has this notice switched off, or has no email address on file.',
    })
  } catch (error: any) {
    console.error('Gallery announce error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
