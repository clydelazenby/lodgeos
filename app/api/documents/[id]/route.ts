import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { DEGREE_VALUES } from '@/lib/degrees'
import { recordAudit, actorName } from '@/lib/audit'

const ACCESS_LEVELS = new Set(['all', ...DEGREE_VALUES])

/**
 * Corrects what a document SAYS about itself — never the file.
 *
 * The library was write-once: a document uploaded as "scan_0042" with
 * the wrong degree floor could only be deleted and uploaded again,
 * which throws away its version history and its place in the
 * curriculum. Four things are worth changing after the fact, and none
 * of them touches storage:
 *
 *   name          what a brother reads on the shelf
 *   description   what it is for
 *   category      which shelf it is on
 *   access_level  who may open it — the important one
 *
 * NOT THE FILE ITSELF. Replacing the contents of a document under a
 * name the lodge already trusts is how "the bylaws" quietly become
 * something else. The library already has the honest way to do that:
 * upload the new version and name what it supersedes, which keeps both
 * and records the succession.
 *
 * ONLY WHAT WAS SENT IS WRITTEN, so the audit trail names the field
 * that changed rather than claiming the whole record was rewritten.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient()

    // Read first: the tenant this document belongs to is what
    // authorization is scoped against, and the client does not get to
    // assert it.
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, tenant_id, name, description, category, access_level')
      .eq('id', params.id)
      .maybeSingle()

    if (docError) throw docError
    if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 })

    const auth = await requireCapability(doc.tenant_id, 'documents')
    if (!auth.ok) return auth.response

    const body = await request.json()
    const patch: Record<string, any> = {}
    const changed: string[] = []

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: 'A document needs a name.' }, { status: 400 })
      }
      if (name !== doc.name) { patch.name = name.slice(0, 200); changed.push('name') }
    }

    if (typeof body.description === 'string') {
      const description = body.description.trim().slice(0, 2000) || null
      if (description !== (doc.description ?? null)) {
        patch.description = description
        changed.push('description')
      }
    }

    if (typeof body.category === 'string' && body.category.trim()) {
      const category = body.category.trim()
      if (category !== doc.category) { patch.category = category; changed.push('category') }
    }

    if (typeof body.accessLevel === 'string') {
      if (!ACCESS_LEVELS.has(body.accessLevel)) {
        return NextResponse.json({ error: 'That is not a degree this app knows.' }, { status: 400 })
      }
      if (body.accessLevel !== doc.access_level) {
        patch.access_level = body.accessLevel
        changed.push('degree')
      }
    }

    if (changed.length === 0) {
      return NextResponse.json({ success: true, changed: [] })
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update(patch)
      .eq('id', params.id)

    if (updateError) throw updateError

    /**
     * The degree floor is named in the summary when it moves, because
     * it is the only one of the four that changes who may read the
     * document — "renamed a file" and "opened the lodge's ritual
     * material to every Entered Apprentice" should not read alike in
     * the trail.
     */
    const movedFloor = changed.includes('degree')
    await recordAudit({
      tenantId: doc.tenant_id,
      actorId: auth.userId,
      actorName: await actorName(auth.userId),
      action: 'document.updated',
      summary: movedFloor
        ? `Changed who may read "${patch.name ?? doc.name}" — now ${patch.access_level === 'all' ? 'every brother' : patch.access_level + ' and above'}`
        : `Edited the details of "${patch.name ?? doc.name}" (${changed.join(', ')})`,
      entityType: 'document',
      entityId: doc.id,
      detail: { changed, from: { name: doc.name, category: doc.category, access_level: doc.access_level } },
    })

    return NextResponse.json({ success: true, changed })
  } catch (error: any) {
    console.error('Document update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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

    const auth = await requireCapability(doc.tenant_id, 'documents')
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
