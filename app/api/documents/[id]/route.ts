import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole } from '@/lib/auth/requireTenantAdmin'

/**
 * Deletes a document — both the stored file and its database row.
 *
 * ORDER MATTERS, AND THE FAILURE MODES ARE NOT SYMMETRIC
 *
 * The storage object is removed FIRST, then the row. If storage
 * removal fails, the whole operation aborts and the row stays, so the
 * document remains listed and downloadable — a visible, retryable
 * failure.
 *
 * The reverse order would be worse: deleting the row first and then
 * failing on storage would orphan the file in the bucket with nothing
 * left pointing at it. It would be invisible in the UI, still counted
 * against storage quota, and still retrievable by anyone who could
 * reconstruct a signed URL. Silent orphans are harder to fix than a
 * loud failure.
 *
 * If the row deletion fails after the file is already gone, that IS
 * reported as an error, and the document will show up as a broken
 * entry rather than vanishing — which is the honest signal that
 * something went wrong, and the download route already handles a
 * missing storage_path gracefully.
 *
 * GUARD
 *
 * Restricted to secretary/admin rather than the full officer set.
 * Uploading is a routine officer action; destroying the lodge's only
 * copy of a document is a records-custody one.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient()

    // Read the document BEFORE authorizing, because the tenant it
    // belongs to is what the authorization check is scoped against —
    // the client doesn't get to assert which tenant this document is
    // in.
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, tenant_id, name, storage_path')
      .eq('id', params.id)
      .maybeSingle()

    if (docError) throw docError

    if (!doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
    }

    const auth = await requireTenantRole(doc.tenant_id, ['admin', 'secretary', 'grand_master'])
    if (!auth.ok) return auth.response

    // Documents uploaded before migration 007 have no storage_path —
    // there is no file to remove, only a row.
    if (doc.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path])

      if (storageError) {
        return NextResponse.json(
          { error: `Could not delete the stored file: ${storageError.message}. Nothing was removed.` },
          { status: 500 }
        )
      }
    }

    const { error: rowError } = await supabase
      .from('documents')
      .delete()
      .eq('id', params.id)

    if (rowError) throw rowError

    return NextResponse.json({ success: true, deleted: doc.name })
  } catch (error: any) {
    console.error('Document delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
