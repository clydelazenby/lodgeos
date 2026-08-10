import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole } from '@/lib/auth/requireTenantAdmin'
import { collectRecipients, sendLodgeNoticeBatch } from '@/lib/email/lodgeNotice'

/**
 * Sends a lodge-wide notice and records what actually happened.
 *
 * Three modes, chosen by the request body:
 *
 *   mode: 'test'  — sends one copy to the requesting officer only.
 *                   Nothing is written to `communications`; a test is
 *                   not part of the lodge's record.
 *   mode: 'draft' — saves without sending. Overwrites an existing draft
 *                   when `draftId` is supplied.
 *   mode: 'send'  — the real thing (default).
 *
 * Restricted to the officers who legitimately speak for the lodge.
 * Deliberately NARROWER than requireTenantAdmin's full officer set: a
 * Deacon has real duties elsewhere in this app, but a message going out
 * under the lodge's name to every brother is the Secretary's, Master's,
 * or Admin's to send.
 */

const ALLOWED_GROUPS = new Set(['all', 'mm_only', 'candidates', 'dues_outstanding'])
const MAX_SUBJECT = 200
const MAX_BODY = 20000

export async function POST(request: Request) {
  try {
    const { tenantId, subject, body, recipientGroup, mode, draftId } = await request.json()

    const action: 'send' | 'test' | 'draft' = mode === 'test' || mode === 'draft' ? mode : 'send'

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Subject and message are required.' }, { status: 400 })
    }
    if (subject.length > MAX_SUBJECT) {
      return NextResponse.json({ error: `Subject must be under ${MAX_SUBJECT} characters.` }, { status: 400 })
    }
    if (body.length > MAX_BODY) {
      return NextResponse.json({ error: `Message must be under ${MAX_BODY} characters.` }, { status: 400 })
    }

    const group = recipientGroup || 'all'
    if (!ALLOWED_GROUPS.has(group)) {
      return NextResponse.json({ error: `Unknown recipient group "${group}".` }, { status: 400 })
    }

    const auth = await requireTenantRole(tenantId, [
      'admin', 'secretary', 'worshipful_master',
    ])
    if (!auth.ok) return auth.response

    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const { data: tenant } = await supabase.from('tenants').select('name, number').eq('id', tenantId).single()
    if (!tenant) return NextResponse.json({ error: 'Lodge not found.' }, { status: 404 })

    const { data: sender } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', auth.userId)
      .single()

    const sentByName = sender ? `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() : undefined
    const lodgeName = `${tenant.name} #${tenant.number}`

    // ---- Draft: save and stop ---------------------------------

    if (action === 'draft') {
      const payload = {
        tenant_id: tenantId,
        subject,
        body,
        recipient_group: group,
        sent_by: auth.userId,
        is_draft: true,
        sent_at: null,
      }

      const query = draftId
        ? serviceClient.from('communications').update(payload).eq('id', draftId).eq('tenant_id', tenantId)
        : serviceClient.from('communications').insert(payload)

      const { data: draft, error: draftError } = await query
        .select('*, profiles(first_name, last_name)')
        .single()

      if (draftError) throw draftError

      return NextResponse.json({ success: true, mode: 'draft', communication: draft })
    }

    // ---- Test: one copy to the sender, recorded nowhere -------

    if (action === 'test') {
      if (!sender?.email) {
        return NextResponse.json(
          { error: 'Your own profile has no email address, so there is nowhere to send the test.' },
          { status: 400 }
        )
      }

      const { sent, failed } = await sendLodgeNoticeBatch({
        recipients: [{ email: sender.email, firstName: sender.first_name ?? 'Brother' }],
        lodgeName,
        subject,
        body,
        sentByName,
        replyTo: sender.email,
      })

      if (!sent) {
        return NextResponse.json(
          { error: failed[0]?.reason || 'The test message could not be sent.' },
          { status: 502 }
        )
      }

      return NextResponse.json({ success: true, mode: 'test', sentTo: sender.email })
    }

    // ---- Send for real ----------------------------------------

    let query = supabase
      .from('tenant_members')
      .select('user_id, dues_status, degree, profiles(first_name, email)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    if (group === 'mm_only') query = query.eq('degree', 'MM')
    if (group === 'candidates') query = query.in('degree', ['EA', 'FC'])
    if (group === 'dues_outstanding') query = query.eq('dues_status', 'due')

    const { data: members, error: membersError } = await query
    if (membersError) throw membersError

    // Validation happens before any network call, so one unusable
    // address can't reject a batch of 100 good ones.
    const { valid, failed: unreachable } = collectRecipients(
      (members ?? []).map((m: any) => ({
        email: m.profiles?.email,
        firstName: m.profiles?.first_name,
      }))
    )

    // Lets the per-recipient delivery rows point back at a real brother,
    // so a bounce can be shown against a name rather than a bare address.
    const memberIdByEmail = new Map<string, string>()
    for (const m of members ?? []) {
      const email = (m as any).profiles?.email?.trim().toLowerCase()
      if (email) memberIdByEmail.set(email, (m as any).user_id)
    }

    if (valid.length === 0) {
      return NextResponse.json(
        {
          error:
            (members?.length ?? 0) === 0
              ? 'No active brothers match that group.'
              : 'None of the brothers in that group have a usable email address on file.',
          failedRecipients: unreachable,
        },
        { status: 400 }
      )
    }

    const { sent, accepted, failed: sendFailures } = await sendLodgeNoticeBatch({
      recipients: valid,
      lodgeName,
      subject,
      body,
      sentByName,
      replyTo: sender?.email ?? undefined,
    })

    const allFailures = [...unreachable, ...sendFailures]
    const total = (members?.length ?? 0)

    // Recorded whether or not delivery fully succeeded — a notice that
    // reached 40 of 47 brothers is still part of the lodge's record, and
    // the gap is exactly what the secretary needs to see later.
    const { data: comm, error: recordError } = await serviceClient
      .from('communications')
      .insert({
        tenant_id: tenantId,
        subject,
        body,
        recipient_group: group,
        sent_by: auth.userId,
        is_draft: false,
        sent_at: new Date().toISOString(),
        recipient_count: total,
        sent_count: sent,
        failed_count: allFailures.length,
        failed_recipients: allFailures,
      })
      .select('*, profiles(first_name, last_name)')
      .single()

    if (recordError) {
      // The mail is already out; failing the request now would tell the
      // secretary nothing was sent, which is worse than a missing
      // history row. Report success with the caveat instead.
      console.error('Notice sent but could not be recorded:', recordError)
      return NextResponse.json({
        success: sent > 0,
        sent,
        failed: allFailures.length,
        total,
        failedRecipients: allFailures,
        warning: 'The notice was sent, but could not be saved to the history.',
      })
    }

    // Per-recipient delivery rows. Written after the communication row
    // exists (they reference it) and best-effort: the mail is already
    // sent by this point, so a tracking-write failure must not be
    // reported to the secretary as a failed send. It costs delivery
    // detail for this one notice, nothing more.
    const recipientRows = [
      ...accepted.map((a) => ({
        communication_id: comm.id,
        tenant_id: tenantId,
        member_id: memberIdByEmail.get(a.email) ?? null,
        email: a.email,
        resend_email_id: a.resendEmailId,
        status: 'sent',
        last_event_at: new Date().toISOString(),
      })),
      ...sendFailures.map((f) => ({
        communication_id: comm.id,
        tenant_id: tenantId,
        member_id: memberIdByEmail.get(f.email) ?? null,
        email: f.email,
        resend_email_id: null,
        status: 'failed',
        detail: f.reason,
        last_event_at: new Date().toISOString(),
      })),
    ]

    if (recipientRows.length) {
      const { error: trackingError } = await serviceClient
        .from('communication_recipients')
        .upsert(recipientRows, { onConflict: 'communication_id,email' })

      if (trackingError) {
        console.error('Notice sent but delivery tracking rows failed:', trackingError)
      }
    }

    // A draft that has now gone out shouldn't linger in the drafts list.
    if (draftId) {
      await serviceClient.from('communications').delete().eq('id', draftId).eq('tenant_id', tenantId).eq('is_draft', true)
    }

    return NextResponse.json({
      success: sent > 0,
      sent,
      failed: allFailures.length,
      total,
      failedRecipients: allFailures,
      communication: comm,
    })
  } catch (error: any) {
    console.error('Send communication error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
