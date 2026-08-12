import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DEGREE_RANK, degreeLabel } from '@/lib/degrees'

// Degree hierarchy for access_level checks: a Master Mason can see
// everything an EA or FC can see, plus MM-restricted documents. This
// mirrors how degree progression actually works — a EA-restricted
// document isn't meant to become invisible once someone advances past
// EA, it's a FLOOR, not an exact-match requirement.
//
// The map now covers the appendant degrees too and lives in
// lib/degrees.ts, so this route and the documents list cannot drift
// apart — they were previously two hand-written copies of the same
// three entries.

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: doc } = await supabase.from('documents').select('*').eq('id', params.id).single()
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // Confirm the requester actually belongs to this document's tenant
    // AND meets its access_level, rather than relying on storage RLS
    // alone — storage RLS (migration 007) only proves tenant
    // membership, it can't evaluate the per-degree access_level column,
    // so that check has to happen here at the application layer.
    const { data: membership } = await supabase
      .from('tenant_members')
      .select('degree, is_active')
      .eq('tenant_id', doc.tenant_id)
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await supabase.from('profiles').select('platform_role').eq('id', user.id).single()
    const isSuperAdmin = profile?.platform_role === 'super_admin'

    if (!isSuperAdmin) {
      if (!membership || !membership.is_active) {
        return NextResponse.json({ error: 'Not a member of this lodge' }, { status: 403 })
      }
      if (doc.access_level !== 'all') {
        const requiredRank = DEGREE_RANK[doc.access_level] ?? 0
        const memberRank = DEGREE_RANK[membership.degree] ?? 0
        if (memberRank < requiredRank) {
          return NextResponse.json({ error: `This document requires the ${degreeLabel(doc.access_level)} degree or higher` }, { status: 403 })
        }
      }
    }

    if (!doc.storage_path) {
      return NextResponse.json({ error: 'This document has no associated file (may predate file-upload support)' }, { status: 404 })
    }

    // Service client for the signed-URL generation itself — creating a
    // signed URL is a storage-admin operation distinct from the
    // permission check above, which already happened using the user's
    // own session and real data. Signed for 5 minutes: long enough for
    // a real download to start, short enough that a leaked/logged URL
    // doesn't stay valid indefinitely.
    /**
     * DOWNLOAD MEANS DOWNLOAD.
     *
     * Signing the URL plainly left the browser to decide, and the
     * browser decides by content type: a PDF opened in a tab, a
     * PowerPoint landed in the downloads folder, and the same button
     * did two different things depending on the file. Worse, what it
     * saved was the storage object's name — a uuid and a mangled
     * filename — rather than what the lodge calls the document.
     *
     * `download` sets Content-Disposition: attachment with a filename,
     * so the button behaves the same way for every format and the file
     * arrives called what it is called on the shelf.
     *
     * The player asks for `?inline=1` instead: a video cannot be
     * streamed from an attachment.
     */
    const inline = new URL(request.url).searchParams.get('inline') === '1'

    // The extension has to survive — Windows opens by extension, and
    // "Bylaws" without ".pdf" opens in nothing at all.
    const ext = doc.storage_path.includes('.')
      ? doc.storage_path.slice(doc.storage_path.lastIndexOf('.'))
      : ''
    const base = String(doc.name || 'document').replace(/[\\/:*?"<>|]/g, '-').trim() || 'document'
    const filename = base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`

    const serviceClient = await createServiceClient()
    const { data: signedUrlData, error: signError } = await serviceClient.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 300, inline ? undefined : { download: filename })

    if (signError) throw signError

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      name: doc.name,
      filename,
      mimeType: doc.mime_type,
    })
  } catch (error: any) {
    console.error('Document download error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
