import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'

const VALID_STATUSES = new Set(['present', 'absent', 'excused'])

export async function POST(request: Request) {
  try {
    const { tenantId, eventId, records } = await request.json()
    if (!eventId || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Missing eventId or records array' }, { status: 400 })
    }
    for (const r of records) {
      if (!VALID_STATUSES.has(r.status)) {
        return NextResponse.json({ error: `Invalid status: ${r.status}` }, { status: 400 })
      }
    }

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const rows = records.map((r: { memberId: string; status: string }) => ({
      tenant_id: tenantId,
      event_id: eventId,
      member_id: r.memberId,
      status: r.status,
    }))

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'event_id,member_id' })

    if (error) throw error
    return NextResponse.json({ success: true, recorded: rows.length })
  } catch (error: any) {
    console.error('Record attendance error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
