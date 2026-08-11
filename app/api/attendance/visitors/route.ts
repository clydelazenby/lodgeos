import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'

/**
 * Signs a visiting brother into the register, and removes a mistake.
 *
 * Officer tier, matching attendance itself — the Junior Deacon is
 * frequently the man actually holding the book, and requireTenantAdmin
 * has meant "holds administrative access of some kind" since migration
 * 022, which is the right breadth here.
 */

const MAX_PER_EVENT = 200

export async function POST(request: Request) {
  try {
    const { tenantId, eventId, name, visitingFrom, jurisdiction, title, notes } =
      await request.json()

    if (!tenantId || !eventId || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'A visitor needs at least a name and a meeting to be signed into.' },
        { status: 400 }
      )
    }

    const auth = await requireCapability(tenantId, 'meetings')
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    // The event must belong to THIS lodge. Without this check a valid
    // event id from another lodge would accept a visitor row scoped to
    // a tenant the officer does have rights in, quietly attaching a
    // name to someone else's meeting.
    const { data: event } = await supabase
      .from('lodge_events')
      .select('id')
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'No such meeting for this lodge.' }, { status: 404 })
    }

    // A ceiling, not a business rule. Two hundred visitors is a Grand
    // Lodge occasion; a thousand is a stuck script.
    const { count } = await supabase
      .from('event_visitors')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)

    if ((count ?? 0) >= MAX_PER_EVENT) {
      return NextResponse.json(
        { error: `This meeting already has ${MAX_PER_EVENT} visitors recorded.` },
        { status: 400 }
      )
    }

    const text = (value: unknown, limit: number) =>
      typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null

    const { data: visitor, error } = await supabase
      .from('event_visitors')
      .insert({
        tenant_id: tenantId,
        event_id: eventId,
        name: name.trim().slice(0, 120),
        visiting_from: text(visitingFrom, 120),
        jurisdiction: text(jurisdiction, 120),
        title: text(title, 80),
        notes: text(notes, 300),
        signed_in_by: auth.userId,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, visitor })
  } catch (error: any) {
    console.error('Sign visitor error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { tenantId, visitorId } = await request.json()
    if (!tenantId || !visitorId) {
      return NextResponse.json({ error: 'Missing tenantId or visitorId.' }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'meetings')
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    // Struck out rather than kept: a visitor row is a line written in a
    // book on one evening, and a name entered in error is corrected in
    // the book, not annotated. This is the one record in the app that
    // is genuinely disposable — no history hangs off it.
    const { error } = await supabase
      .from('event_visitors')
      .delete()
      .eq('id', visitorId)
      .eq('tenant_id', tenantId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Remove visitor error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
