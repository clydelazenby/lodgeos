import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { DEGREE_VALUES } from '@/lib/degrees'

/**
 * Records a document row AFTER the browser has uploaded the file
 * straight to Supabase Storage.
 *
 * WHY UPLOADS NO LONGER GO THROUGH THE SERVER
 *
 * /api/documents/upload received the whole file as multipart form data
 * and forwarded it to Storage. That cannot work for training video, and
 * in fact never worked for large documents either: Vercel caps a
 * serverless function's REQUEST BODY at 4.5MB. The route advertised a
 * 25MB limit and the bucket allowed 25MB, but anything over ~4.5MB was
 * rejected by the platform before a single line of that route ran — so
 * the failure looked like a mysterious network error rather than a
 * size limit.
 *
 * The browser now uploads directly to Storage using the officer's own
 * session. That path has no 4.5MB ceiling, and it is already
 * authorized: migration 007's "Tenant admins can upload documents"
 * policy checks is_tenant_admin() against the tenant-id folder the file
 * is being written into, so a member cannot write into another lodge's
 * folder even though the request no longer passes through our code.
 *
 * This route then records the metadata row. It re-derives the tenant
 * from the storage path rather than trusting the client's claim, and
 * verifies the object genuinely exists — otherwise a caller could
 * fabricate library entries pointing at files that were never uploaded.
 */

const MAX_SIZE = 500 * 1024 * 1024 // must not exceed migration 013's bucket limit

const ALLOWED_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/wav',
])

const ACCESS_LEVELS = new Set(['all', ...DEGREE_VALUES])

export async function POST(request: Request) {
  try {
    const {
      tenantId, storagePath, name, category, accessLevel,
      description, mimeType, fileSize, durationSeconds,
    } = await request.json()

    if (!tenantId || !storagePath || !name?.trim()) {
      return NextResponse.json(
        { error: 'Missing tenantId, storagePath, or name.' },
        { status: 400 }
      )
    }

    // The path must live under this tenant's folder. Checked here as
    // well as by storage RLS, because this row is what the app reads
    // from — a row claiming tenant A while pointing at tenant B's file
    // would expose that file through our own download route.
    const folder = String(storagePath).split('/')[0]
    if (folder !== tenantId) {
      return NextResponse.json(
        { error: 'Storage path does not belong to this lodge.' },
        { status: 400 }
      )
    }

    if (mimeType && !ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json({ error: `File type "${mimeType}" is not allowed.` }, { status: 400 })
    }
    if (fileSize && Number(fileSize) > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds the 500MB limit.' }, { status: 400 })
    }
    if (accessLevel && !ACCESS_LEVELS.has(accessLevel)) {
      return NextResponse.json({ error: `Unknown access level "${accessLevel}".` }, { status: 400 })
    }

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    // Confirm the object is really there. Without this, a valid officer
    // could create library entries for files that don't exist, which
    // would surface later as broken downloads with no obvious cause.
    const lastSlash = String(storagePath).lastIndexOf('/')
    const dir = String(storagePath).slice(0, lastSlash)
    const base = String(storagePath).slice(lastSlash + 1)

    const { data: listed, error: listError } = await supabase.storage
      .from('documents')
      .list(dir, { search: base, limit: 1 })

    if (listError) throw listError

    if (!listed?.some((o) => o.name === base)) {
      return NextResponse.json(
        { error: 'That file was not found in storage. The upload may not have finished.' },
        { status: 400 }
      )
    }

    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        tenant_id: tenantId,
        name: String(name).trim(),
        category: category || 'Other',
        access_level: accessLevel || 'all',
        description: description || null,
        file_url: `storage://documents/${storagePath}`,
        storage_path: storagePath,
        mime_type: mimeType || null,
        file_size: fileSize ? Number(fileSize) : null,
        duration_seconds: durationSeconds ? Math.round(Number(durationSeconds)) : null,
        uploaded_by: auth.userId,
      })
      .select()
      .single()

    if (insertError) {
      // Row failed but the file is already in the bucket — remove it so
      // the bucket doesn't accumulate objects nothing points at.
      await supabase.storage.from('documents').remove([storagePath])
      throw insertError
    }

    return NextResponse.json({ success: true, document: doc })
  } catch (error: any) {
    console.error('Document record error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
