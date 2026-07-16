import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'

export async function POST(request: Request) {
  try {
    const { tenantId, itemId, completed, notes } = await request.json()
    if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const updates: Record<string, unknown> = {}
    if (completed !== undefined) {
      updates.completed = completed
      // completed_at only set/cleared when completed actually changes,
      // not on every notes-only edit — so re-saving a note on an
      // already-checked item doesn't silently update its timestamp.
      updates.completed_at = completed ? new Date().toISOString() : null
      updates.completed_by = completed ? auth.userId : null
    }
    if (notes !== undefined) updates.notes = notes

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('meeting_agenda_items')
      .update(updates)
      .eq('id', itemId)
      .eq('tenant_id', tenantId) // scope by tenant, not just item id, same defense-in-depth pattern as every other tenant-write route tonight
      .select()
      .single()

    if (error) throw error
    if (!updated) return NextResponse.json({ error: 'Agenda item not found for this lodge' }, { status: 404 })

    return NextResponse.json({ success: true, item: updated })
  } catch (error: any) {
    console.error('Update agenda item error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
