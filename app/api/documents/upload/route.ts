import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'

const ALLOWED_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_SIZE = 25 * 1024 * 1024 // matches the bucket's file_size_limit in migration 007

/**
 * Uploads a document to the lodge's private document library. Uses the
 * service-role client (not the user's own session) because the write
 * target is a tenant-scoped folder the officer is acting ON BEHALF OF
 * the lodge for, not their own personal space the way an avatar is —
 * same reasoning as every other tenant-write route tonight
 * (communications/send, petitions/update-status, etc.): the
 * authorization decision is made explicitly here via
 * requireTenantAdmin(), not left to storage-layer RLS alone to
 * re-derive from a raw insert.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const tenantId = formData.get('tenantId') as string | null
    const name = (formData.get('name') as string | null) || file?.name
    const category = (formData.get('category') as string | null) || 'General'
    const accessLevel = (formData.get('accessLevel') as string | null) || 'all'
    const description = formData.get('description') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'File type not supported. Allowed: PDF, Word, JPEG, PNG, WebP' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File must be under 25MB' }, { status: 400 })
    }
    if (!['all', 'EA', 'FC', 'MM'].includes(accessLevel)) {
      return NextResponse.json({ error: `Invalid accessLevel: ${accessLevel}` }, { status: 400 })
    }

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createServiceClient()

    // Randomized filename component prevents two same-named uploads
    // (e.g. two different "Bylaws.pdf" uploads over the lodge's
    // history) from silently overwriting each other in storage, while
    // keeping the original filename readable in the path for anyone
    // browsing the bucket directly.
    const safeName = (file.name || 'document').replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const storagePath = `${tenantId}/${crypto.randomUUID()}-${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, arrayBuffer, { contentType: file.type })

    if (uploadError) throw uploadError

    // file_url stores a placeholder marker rather than a real URL,
    // since the bucket is private — signed URLs must be generated
    // fresh at read time (see /api/documents/[id]/download), not
    // baked in once at upload time where they'd eventually expire and
    // silently stop working. storage_path is the actual source of
    // truth for locating the file.
    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        tenant_id: tenantId,
        name,
        category,
        file_url: `storage://documents/${storagePath}`,
        file_size: file.size,
        access_level: accessLevel,
        uploaded_by: auth.userId,
        description: description || null,
        storage_path: storagePath,
        mime_type: file.type,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ success: true, document: doc })
  } catch (error: any) {
    console.error('Document upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
