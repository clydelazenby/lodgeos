import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin, requireTenantRole } from '@/lib/auth/requireTenantAdmin'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * Writing, submitting and approving minutes.
 *
 * THE APPROVAL IS THE INTERESTING PART. A set of minutes is not a
 * document that simply exists — it is read at the NEXT stated
 * communication and approved, or approved as corrected, and until then
 * it is one officer's account carrying no authority. This route keeps
 * that distinction rather than flattening it to a saved file.
 *
 * Who may do what:
 * - write/submit: any officer, matching who runs a meeting
 * - approve: the Secretary's office and the Master, because approval is
 *   an act of the lodge and someone must be answerable for recording
 *   that it happened
 */

const MAX_BODY = 120_000

export async function POST(request: Request) {
  try {
    const { tenantId, eventId, body, status } = await request.json()

    if (!tenantId || !eventId) {
      return NextResponse.json({ error: 'Missing tenantId or eventId.' }, { status: 400 })
    }
    if (typeof body !== 'string') {
      return NextResponse.json({ error: 'Minutes body must be text.' }, { status: 400 })
    }
    if (body.length > MAX_BODY) {
      return NextResponse.json(
        { error: `That is longer than ${MAX_BODY.toLocaleString()} characters.` },
        { status: 400 }
      )
    }
    if (status && !['draft', 'submitted'].includes(status)) {
      return NextResponse.json(
        { error: 'Minutes are approved through /api/minutes/approve, not by saving.' },
        { status: 400 }
      )
    }

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { data: event } = await supabase
      .from('lodge_events')
      .select('id, title, event_date')
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'No such meeting for this lodge.' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('meeting_minutes')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .maybeSingle()

    /**
     * Approved minutes are closed.
     *
     * Once the lodge has read and approved them they are the lodge's
     * record, not the Secretary's document, and a later quiet edit
     * would make the app assert that the lodge approved words it never
     * heard. A correction after approval is itself an act of the lodge
     * at a subsequent meeting — recorded in correction_note through the
     * approve route, not by overwriting the text.
     */
    if ((existing as any)?.status === 'approved') {
      return NextResponse.json(
        {
          error:
            'These minutes have been read and approved by the lodge and can no longer be edited. A correction is made at a meeting and recorded against the approval.',
        },
        { status: 409 }
      )
    }

    const name = await actorName(auth.userId)
    const now = new Date().toISOString()

    const { data: saved, error } = await supabase
      .from('meeting_minutes')
      .upsert(
        {
          tenant_id: tenantId,
          event_id: eventId,
          body,
          status: status ?? 'draft',
          drafted_by: auth.userId,
          drafted_by_name: name,
          updated_at: now,
        },
        { onConflict: 'event_id' }
      )
      .select()
      .single()

    if (error) throw error

    // Only the submission is audited, not every keystroke-triggered
    // save. An audit trail that logs "saved a draft" forty times per
    // meeting buries the entries anyone actually looks for.
    if (status === 'submitted' && (existing as any)?.status !== 'submitted') {
      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: name,
        action: 'minutes.submitted',
        summary: `Submitted minutes of ${(event as any).title} (${(event as any).event_date}) to be read at the next meeting`,
        entityType: 'meeting_minutes',
        entityId: (saved as any).id,
      })
    }

    return NextResponse.json({ success: true, minutes: saved })
  } catch (error: any) {
    console.error('Save minutes error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Approval. A separate verb because it is a separate act — performed by
 * the lodge, at a meeting, on a date, and not by whoever last had the
 * document open.
 */
export async function PUT(request: Request) {
  try {
    const { tenantId, minutesId, approvedAtEventId, approvedOn, correctionNote } =
      await request.json()

    if (!tenantId || !minutesId) {
      return NextResponse.json({ error: 'Missing tenantId or minutesId.' }, { status: 400 })
    }

    const auth = await requireTenantRole(tenantId, [
      'admin', 'secretary', 'grand_master', 'worshipful_master',
    ])
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { data: minutes } = await supabase
      .from('meeting_minutes')
      .select('id, status, body, lodge_events(title, event_date)')
      .eq('id', minutesId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!minutes) {
      return NextResponse.json({ error: 'No such minutes for this lodge.' }, { status: 404 })
    }
    if ((minutes as any).status === 'approved') {
      return NextResponse.json({ error: 'These minutes are already approved.' }, { status: 400 })
    }
    if (!(minutes as any).body?.trim()) {
      return NextResponse.json(
        { error: 'There is nothing written to approve.' },
        { status: 400 }
      )
    }

    /**
     * The approving meeting must belong to this lodge and must not be
     * the meeting being minuted — minutes cannot be approved at the
     * meeting they record, because they are written afterwards. Getting
     * this wrong would produce a chain of custody that reads as a
     * circle.
     */
    if (approvedAtEventId) {
      const { data: approvingEvent } = await supabase
        .from('lodge_events')
        .select('id')
        .eq('id', approvedAtEventId)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (!approvingEvent) {
        return NextResponse.json(
          { error: 'The approving meeting does not belong to this lodge.' },
          { status: 400 }
        )
      }

      const { data: self } = await supabase
        .from('meeting_minutes')
        .select('event_id')
        .eq('id', minutesId)
        .maybeSingle()

      if ((self as any)?.event_id === approvedAtEventId) {
        return NextResponse.json(
          {
            error:
              'Minutes cannot be approved at the meeting they record — they are read at the next one.',
          },
          { status: 400 }
        )
      }
    }

    const name = await actorName(auth.userId)

    const { data: updated, error } = await supabase
      .from('meeting_minutes')
      .update({
        status: 'approved',
        approved_by: auth.userId,
        approved_by_name: name,
        approved_on:
          typeof approvedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(approvedOn)
            ? approvedOn
            : new Date().toISOString().slice(0, 10),
        approved_at_event_id: approvedAtEventId || null,
        correction_note:
          typeof correctionNote === 'string' && correctionNote.trim()
            ? correctionNote.trim().slice(0, 2000)
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', minutesId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error

    const of = (minutes as any).lodge_events
    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: name,
      action: 'minutes.approved',
      summary: `Recorded the lodge's approval of the minutes of ${of?.title ?? 'a meeting'} (${of?.event_date ?? ''})${correctionNote ? ', as corrected' : ''}`,
      entityType: 'meeting_minutes',
      entityId: minutesId,
      detail: { approvedAtEventId: approvedAtEventId || null, corrected: !!correctionNote },
    })

    return NextResponse.json({ success: true, minutes: updated })
  } catch (error: any) {
    console.error('Approve minutes error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
