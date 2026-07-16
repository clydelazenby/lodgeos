import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'

export async function POST(request: Request) {
  try {
    const { tenantId, eventId } = await request.json()
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { data: event } = await supabase.from('lodge_events').select('opened_at, closed_at').eq('id', eventId).eq('tenant_id', tenantId).single()
    if (!event) return NextResponse.json({ error: 'Event not found for this lodge' }, { status: 404 })
    if (!event.opened_at) return NextResponse.json({ error: 'This meeting was never opened' }, { status: 409 })
    if (event.closed_at) return NextResponse.json({ error: 'This meeting is already closed' }, { status: 409 })

    const { data: updated, error } = await supabase
      .from('lodge_events')
      .update({ closed_at: new Date().toISOString(), meeting_qr_token: null })
      .eq('id', eventId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, event: updated })
  } catch (error: any) {
    console.error('Close meeting error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
