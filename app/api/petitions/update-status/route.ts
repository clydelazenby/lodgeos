import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantRole } from '@/lib/auth/requireTenantAdmin'

const VALID_STATUSES = new Set(['new', 'under_review', 'approved', 'denied'])

export async function POST(request: Request) {
  try {
    const { tenantId, petitionId, status, notes } = await request.json()

    if (!petitionId || !status) {
      return NextResponse.json({ error: 'Missing petitionId or status' }, { status: 400 })
    }
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
    }

    // Membership decisions traditionally rest with the Secretary and
    // lodge leadership, not with every officer tier — a Treasurer or
    // Deacon having equal say in approving/denying a petition doesn't
    // match how lodges actually operate.
    const auth = await requireTenantRole(tenantId, ['secretary', 'worshipful_master', 'admin'])
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    // Scope the update to this tenant explicitly, not just the petition id,
    // so an admin of Lodge A can't move a petition belonging to Lodge B.
    const { data: updated, error } = await supabase
      .from('petitions')
      .update({
        status,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        ...(notes !== undefined ? { notes } : {}),
      })
      .eq('id', petitionId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error
    if (!updated) return NextResponse.json({ error: 'Petition not found for this lodge' }, { status: 404 })

    return NextResponse.json({ success: true, petition: updated })
  } catch (error: any) {
    console.error('Update petition status error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
