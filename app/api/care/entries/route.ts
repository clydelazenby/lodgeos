import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'

const VALID_CARE_TYPES = new Set(['sickness', 'distress', 'widow', 'other'])
const VALID_STATUSES = new Set(['open', 'monitoring', 'resolved'])

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, action } = body

    // Restricted to officer tiers generally (not narrowed further at
    // this layer) because creating/managing an entry is an
    // administrative act any officer might legitimately need to do —
    // it's READ visibility that's narrowed (via RLS, see migration
    // 005), not who can act on an entry they're already permitted to see.
    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    if (action === 'create') {
      const { personName, relationship, careType, memberId, summary, contactPhone, contactAddress, assignedTo, checkInIntervalDays } = body
      if (!personName?.trim()) return NextResponse.json({ error: 'personName is required' }, { status: 400 })
      if (careType && !VALID_CARE_TYPES.has(careType)) return NextResponse.json({ error: `Invalid careType: ${careType}` }, { status: 400 })

      const { data, error } = await supabase
        .from('care_entries')
        .insert({
          tenant_id: tenantId,
          person_name: personName,
          relationship: relationship || null,
          care_type: careType || 'other',
          member_id: memberId || null,
          summary: summary || null,
          contact_phone: contactPhone || null,
          contact_address: contactAddress || null,
          assigned_to: assignedTo || null,
          check_in_interval_days: checkInIntervalDays || 14,
          created_by: auth.userId,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, entry: data })
    }

    if (action === 'update') {
      const { entryId, status, summary, assignedTo, checkInIntervalDays } = body
      if (!entryId) return NextResponse.json({ error: 'entryId is required' }, { status: 400 })
      if (status && !VALID_STATUSES.has(status)) return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })

      const updates: Record<string, unknown> = {}
      if (status !== undefined) updates.status = status
      if (summary !== undefined) updates.summary = summary
      if (assignedTo !== undefined) updates.assigned_to = assignedTo
      if (checkInIntervalDays !== undefined) updates.check_in_interval_days = checkInIntervalDays

      const { data, error } = await supabase
        .from('care_entries')
        .update(updates)
        .eq('id', entryId)
        .eq('tenant_id', tenantId)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, entry: data })
    }

    if (action === 'check-in') {
      const { entryId, note } = body
      if (!entryId) return NextResponse.json({ error: 'entryId is required' }, { status: 400 })

      // Verify the entry belongs to this tenant before logging against
      // it, so a check-in can't be recorded against another lodge's entry.
      const { data: entry } = await supabase.from('care_entries').select('id').eq('id', entryId).eq('tenant_id', tenantId).single()
      if (!entry) return NextResponse.json({ error: 'Entry not found for this lodge' }, { status: 404 })

      const { error: checkinError } = await supabase
        .from('care_checkins')
        .insert({ care_entry_id: entryId, checked_in_by: auth.userId, note: note || null })
      if (checkinError) throw checkinError

      const { data: updated, error: updateError } = await supabase
        .from('care_entries')
        .update({ last_checked_in_at: new Date().toISOString() })
        .eq('id', entryId)
        .select()
        .single()
      if (updateError) throw updateError

      return NextResponse.json({ success: true, entry: updated })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error: any) {
    console.error('Care entries error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
