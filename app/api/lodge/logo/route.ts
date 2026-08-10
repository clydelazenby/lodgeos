import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole } from '@/lib/auth/requireTenantAdmin'

/**
 * Uploads the lodge's crest.
 *
 * The crest is now the first thing in every email the lodge sends (see
 * lib/email/layout.ts), and until this route existed there was no way
 * to set one — logo_url was readable and writable through the
 * super-admin tenant editor but had no upload anywhere, so every lodge
 * had a null crest and the stationery fell back to a text-only header.
 *
 * WHY THE SERVICE CLIENT, when the avatar route deliberately does not:
 * migration 007's storage policies scope writes to a folder named for
 * the user's own id, which is exactly right for a personal avatar and
 * exactly wrong for a shared lodge asset — a crest belongs to the
 * tenant, not to whichever officer happened to upload it. The
 * authorization that matters happens above, in requireTenantRole:
 * only an officer who may change lodge settings gets this far.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const tenantId = String(formData.get('tenantId') ?? '')

    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Same tier as the rest of lodge settings.
    const auth = await requireTenantRole(tenantId, ['admin', 'secretary', 'grand_master'])
    if (!auth.ok) return auth.response

    const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'File must be JPEG, PNG, or WebP' }, { status: 400 })
    }
    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
    }

    // Confirm the caller's own session is real before writing with the
    // service role. requireTenantRole already did this, but the storage
    // write below bypasses RLS entirely, so it is worth being explicit
    // that an authenticated person is behind it.
    const sessionClient = await createClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'

    // Fixed path per tenant so re-uploading replaces the crest rather
    // than accumulating orphans, matching the avatar route's reasoning.
    const path = `${tenantId}/crest.${ext}`

    const { error: uploadError } = await service.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) throw uploadError

    const { data: urlData } = service.storage.from('avatars').getPublicUrl(path)
    // Cache-bust: the storage path is stable, so without this a CDN can
    // keep serving the old crest — including inside already-sent email,
    // where a stale image is far more visible than on a page.
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await service
      .from('tenants')
      .update({ logo_url: logoUrl })
      .eq('id', tenantId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, logoUrl })
  } catch (error: any) {
    console.error('Lodge logo upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
