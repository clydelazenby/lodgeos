import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * The lodge's photographs.
 *
 * WHY THE SERVICE CLIENT for the storage write, when migration 037's
 * policies would allow it anyway: same reason as the crest route. These
 * are the LODGE's images, not the officer's, and the authorization that
 * matters happened above in requireCapability. The policies remain as
 * the backstop for anything reaching storage directly.
 *
 * WHAT THIS ROUTE DOES NOT DO: resize. The browser does that before
 * uploading, in components/lodge/GalleryManager.tsx, and sends both a
 * display-sized image and a thumbnail. Doing it here would mean holding
 * a 12-megapixel phone photo in a serverless function's memory and
 * shipping an image library to do it — for a job the machine that took
 * the photograph can do instantly. The size check below is the backstop
 * for a client that skipped it.
 *
 * Guarded by 'settings', like the rest of the public site's content —
 * and delegable, so a lodge can hand its Historian the gallery without
 * handing him anything else.
 */

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024

function extFor(type: string): string {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
}

/** Upload one photograph. */
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const tenantId = String(form.get('tenantId') ?? '')
    const file = form.get('file') as File | null
    const thumb = form.get('thumb') as File | null

    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'No image was sent.' }, { status: 400 })

    const auth = await requireCapability(tenantId, 'settings')
    if (!auth.ok) return auth.response

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Photographs must be JPEG, PNG or WebP.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'That image is over 10MB even after resizing. Try a smaller one.' },
        { status: 400 }
      )
    }

    // The session is proved again because everything below writes with
    // the service role, which bypasses RLS entirely.
    const sessionClient = await createClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    // A UNIQUE PATH PER PHOTO, unlike the crest and the avatar, which
    // use a fixed name so re-uploading replaces them. A gallery is a
    // collection: the second photograph must not overwrite the first.
    const id = crypto.randomUUID()
    const path = `${tenantId}/${id}.${extFor(file.type)}`

    const { error: uploadError } = await service.storage
      .from('gallery')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError

    let thumbPath: string | null = null
    let thumbUrl: string | null = null
    if (thumb && ALLOWED.has(thumb.type) && thumb.size <= MAX_BYTES) {
      thumbPath = `${tenantId}/${id}-thumb.${extFor(thumb.type)}`
      const { error: thumbError } = await service.storage
        .from('gallery')
        .upload(thumbPath, thumb, { contentType: thumb.type, upsert: false })
      // A MISSING THUMBNAIL IS NOT A FAILED UPLOAD. thumb_url null means
      // the grid falls back to the full image — slower, and still a
      // photograph on the page. Losing the whole upload over it would
      // not be a trade anyone would choose.
      if (thumbError) {
        console.error('Gallery thumbnail upload failed (the photo itself is fine):', thumbError)
        thumbPath = null
      } else {
        thumbUrl = service.storage.from('gallery').getPublicUrl(thumbPath).data.publicUrl
      }
    }

    const url = service.storage.from('gallery').getPublicUrl(path).data.publicUrl

    // New photographs go to the END of the lodge's arrangement, not the
    // front. Someone who has spent an evening ordering forty pictures
    // should not have tomorrow's upload land in the middle of them.
    const { data: last } = await service
      .from('gallery_photos')
      .select('sort_order')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const caption = String(form.get('caption') ?? '').trim().slice(0, 300) || null
    const altText = String(form.get('altText') ?? '').trim().slice(0, 300) || null
    const takenOnRaw = String(form.get('takenOn') ?? '').trim()
    const takenOn = /^\d{4}-\d{2}-\d{2}$/.test(takenOnRaw) ? takenOnRaw : null
    const width = Number(form.get('width')) || null
    const height = Number(form.get('height')) || null

    const { data: photo, error } = await service
      .from('gallery_photos')
      .insert({
        tenant_id: tenantId,
        storage_path: path,
        url,
        thumb_path: thumbPath,
        thumb_url: thumbUrl,
        caption,
        alt_text: altText,
        taken_on: takenOn,
        sort_order: ((last as any)?.sort_order ?? 0) + 1,
        width,
        height,
        bytes: file.size,
        uploaded_by: auth.userId,
        uploaded_by_name: await actorName(auth.userId),
      })
      .select()
      .single()

    if (error) {
      // The row is the record; a file with no row is invisible and
      // undeletable through the interface. Take it back out.
      await service.storage.from('gallery').remove([path, ...(thumbPath ? [thumbPath] : [])])
      throw error
    }

    return NextResponse.json({ success: true, photo })
  } catch (error: any) {
    console.error('Gallery upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Edit a photograph, or move it. */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, photoId, order } = body
    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })

    const auth = await requireCapability(tenantId, 'settings')
    if (!auth.ok) return auth.response

    const service = createServiceClient()

    /**
     * A REORDER IS A LIST, NOT A NUDGE. The manager sends the whole new
     * arrangement and this writes it. Sending "move this one up" would
     * mean two writes racing whenever an officer clicks twice quickly,
     * and an order that ends up depending on which arrived first.
     */
    if (Array.isArray(order)) {
      const ids: string[] = order.filter((x: unknown) => typeof x === 'string')
      // Scoped to the tenant on every row, so an id from another lodge
      // cannot be reordered — or touched at all — by this one.
      const { data: owned } = await service
        .from('gallery_photos')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('id', ids)

      const ownedIds = new Set((owned ?? []).map((r: any) => r.id))
      let position = 0
      for (const id of ids) {
        if (!ownedIds.has(id)) continue
        position += 1
        const { error } = await service
          .from('gallery_photos')
          .update({ sort_order: position, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('id', id)
        if (error) throw error
      }
      return NextResponse.json({ success: true, ordered: position })
    }

    if (!photoId) return NextResponse.json({ error: 'Missing photoId.' }, { status: 400 })

    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    if ('caption' in body) patch.caption = String(body.caption ?? '').trim().slice(0, 300) || null
    if ('altText' in body) patch.alt_text = String(body.altText ?? '').trim().slice(0, 300) || null
    if ('isPublished' in body) patch.is_published = Boolean(body.isPublished)
    if ('takenOn' in body) {
      const v = String(body.takenOn ?? '').trim()
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return NextResponse.json({ error: 'Date taken must be YYYY-MM-DD, or empty.' }, { status: 400 })
      }
      patch.taken_on = v || null
    }

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
    }

    const { data: photo, error } = await service
      .from('gallery_photos')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', photoId)
      .select()
      .single()

    if (error) throw error

    // Only the visibility change is audited. A caption typo corrected
    // three times is noise; a photograph disappearing from the lodge's
    // public site is something somebody may have to answer for.
    if ('isPublished' in body) {
      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: await actorName(auth.userId),
        action: 'gallery.visibility',
        summary: patch.is_published
          ? `Put a photograph back on the public site${photo?.caption ? ` — "${photo.caption}"` : ''}`
          : `Took a photograph off the public site${photo?.caption ? ` — "${photo.caption}"` : ''}`,
        entityType: 'gallery_photo',
        entityId: photoId,
      })
    }

    return NextResponse.json({ success: true, photo })
  } catch (error: any) {
    console.error('Gallery update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Remove a photograph, and its files. */
export async function DELETE(request: Request) {
  try {
    const { tenantId, photoId } = await request.json()
    if (!tenantId || !photoId) {
      return NextResponse.json({ error: 'Missing tenantId or photoId.' }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'settings')
    if (!auth.ok) return auth.response

    const service = createServiceClient()

    const { data: photo } = await service
      .from('gallery_photos')
      .select('storage_path, thumb_path, caption')
      .eq('tenant_id', tenantId)
      .eq('id', photoId)
      .maybeSingle()

    if (!photo) return NextResponse.json({ error: 'No such photograph.' }, { status: 404 })

    const { error } = await service
      .from('gallery_photos')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', photoId)
    if (error) throw error

    /**
     * FILES AFTER THE ROW, and failure here is swallowed.
     *
     * The row is what the site reads. Deleting it first means the photo
     * is off the site the moment the officer asks, even if the storage
     * call then fails — the opposite order would leave a row pointing
     * at a file that no longer exists, which renders as a broken image
     * on the lodge's front page. An orphaned file costs a few kilobytes
     * and nobody sees it.
     */
    const paths = [(photo as any).storage_path, (photo as any).thumb_path].filter(Boolean)
    const { error: storageError } = await service.storage.from('gallery').remove(paths)
    if (storageError) {
      console.error('Gallery file delete failed (the photo is already off the site):', storageError)
    }

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: await actorName(auth.userId),
      action: 'gallery.deleted',
      summary: `Deleted a photograph from the gallery${(photo as any).caption ? ` — "${(photo as any).caption}"` : ''}`,
      entityType: 'gallery_photo',
      entityId: photoId,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Gallery delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
