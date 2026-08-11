import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { collectRecipients, sendLodgeNoticeBatch } from '@/lib/email/lodgeNotice'
import { MM_AND_ABOVE, CANDIDATE_DEGREES } from '@/lib/degrees'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'
import { recordAudit, actorName } from '@/lib/audit'

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

const ALLOWED_GROUPS = new Set(['all', 'mm_only', 'candidates', 'dues_outstanding', 'selected', 'manual'])

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * A cap on hand-typed addresses. This path can send from the lodge's
 * verified domain to people who never joined anything, so it is
 * deliberately a short list for a visiting brother or a Grand Lodge
 * officer — not a second mailing list living in a textarea.
 */
const MAX_MANUAL_RECIPIENTS = 25
const MAX_SUBJECT = 200
const MAX_BODY = 20000

export async function POST(request: Request) {
  try {
    const { tenantId, subject, body, recipientGroup, mode, draftId, scheduledAt, eventId, meetingUrl, memberIds, extraEmails } = await request.json()

    // Scheduling. Resend holds the message and releases it at the given
    // instant, so this costs nothing to support and does not require a
    // cron job of our own — the alternative would be storing the notice
    // and polling for its time, which is a scheduler we don't need to
    // build. Capped at 30 days because that is Resend's own limit.
    let scheduleIso: string | undefined
    if (scheduledAt) {
      const when = new Date(scheduledAt)
      if (Number.isNaN(when.getTime())) {
        return NextResponse.json({ error: 'That send time is not a valid date.' }, { status: 400 })
      }
      // One minute of slack: a secretary picking "in 2 minutes" and
      // taking 90 seconds to hit send should not be rejected.
      if (when.getTime() < Date.now() - 60_000) {
        return NextResponse.json({ error: 'That send time is in the past.' }, { status: 400 })
      }
      if (when.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Notices can be scheduled up to 30 days ahead.' }, { status: 400 })
      }
      scheduleIso = when.toISOString()
    }

    let joinUrl: string | undefined
    if (meetingUrl?.trim()) {
      let parsed: URL
      try {
        parsed = new URL(meetingUrl.trim())
      } catch {
        return NextResponse.json({ error: 'That meeting link is not a valid URL.' }, { status: 400 })
      }
      // Only http(s). A javascript: or data: URL rendered as a button
      // that every brother is told to tap is not something to send under
      // the lodge's name.
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return NextResponse.json(
          { error: 'Meeting links must start with https:// — Zoom, Meet, Teams and Discord links all do.' },
          { status: 400 }
        )
      }
      joinUrl = parsed.toString()
    }

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

    const auth = await requireCapability(tenantId, 'communications')
    if (!auth.ok) return auth.response

    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const { data: tenant } = await supabase.from('tenants').select(LODGE_BRAND_COLUMNS).eq('id', tenantId).single()
    if (!tenant) return NextResponse.json({ error: 'Lodge not found.' }, { status: 404 })

    const { data: sender } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', auth.userId)
      .single()

    const sentByName = sender ? `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() : undefined
    const lodgeName = `${tenant.name} #${tenant.number}`

    // Resolve the attached event, scoped to this lodge so an id from
    // another tenant cannot be surfaced in a notice.
    let noticeEvent: { id: string; title: string; dateLabel: string; location?: string | null } | undefined
    if (eventId) {
      const { data: ev } = await supabase
        .from('lodge_events')
        .select('id, title, event_date, event_time, location')
        .eq('id', eventId)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (!ev) {
        return NextResponse.json({ error: 'That event does not belong to this lodge.' }, { status: 400 })
      }

      // Noon avoids the date shifting a day either way when a bare
      // YYYY-MM-DD is parsed as UTC midnight in a western timezone.
      const d = new Date(ev.event_date + 'T12:00:00')
      const dateLabel =
        d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
        (ev.event_time ? ` at ${String(ev.event_time).slice(0, 5)}` : '')

      noticeEvent = { id: ev.id, title: ev.title, dateLabel, location: ev.location }
    }

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
        brand: toLodgeBrand(tenant),
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

    // MM_AND_ABOVE, not an equality test on 'MM'. Since appendant
    // degrees were added, a Royal Arch Mason or a Noble IS a Master
    // Mason — an equality check would have quietly dropped exactly the
    // most senior brethren from a Master-Mason-only notice, and nobody
    // would have noticed until someone asked why he never gets mail.
    if (group === 'mm_only') query = query.in('degree', MM_AND_ABOVE)
    if (group === 'candidates') query = query.in('degree', CANDIDATE_DEGREES)
    if (group === 'dues_outstanding') query = query.eq('dues_status', 'due')

    // Hand-picked brethren. The ids are filtered against THIS lodge's
    // active membership, so an id belonging to another lodge — or to a
    // brother who has been removed — cannot be addressed by pasting it
    // into the request.
    if (group === 'selected') {
      const ids = Array.isArray(memberIds)
        ? memberIds.filter((id: unknown) => typeof id === 'string' && id.length > 0)
        : []
      if (ids.length === 0) {
        return NextResponse.json({ error: 'Choose at least one brother to write to.' }, { status: 400 })
      }
      query = query.in('user_id', ids)
    }

    // 'manual' addresses nobody on the roster, so it starts from an
    // empty roster query rather than the whole lodge.
    if (group === 'manual') {
      query = query.eq('user_id', '00000000-0000-0000-0000-000000000000')
    }

    const { data: members, error: membersError } = await query
    if (membersError) throw membersError

    /**
     * Addresses typed by hand.
     *
     * SUPER ADMIN ONLY, checked against the database here rather than
     * trusted from the request. Every other recipient in this route is
     * a brother the lodge has already vetted and added to its roster;
     * this is the one path that can send from the lodge's verified
     * domain to an address nobody has vetted at all. Held to the
     * platform owner, it is a useful way to include a visiting brother
     * or a Grand Lodge officer. Available to any officer, it is a way
     * to make the lodge's sending domain carry mail to strangers.
     */
    const manualRequested = Array.isArray(extraEmails)
      ? extraEmails
          .map((e: unknown) => String(e ?? '').trim().toLowerCase())
          .filter((e: string) => e.length > 0)
      : []

    const manualRecipients: { email: string; firstName: string }[] = []

    if (manualRequested.length > 0) {
      const { data: callerProfile } = await serviceClient
        .from('profiles')
        .select('platform_role')
        .eq('id', auth.userId)
        .maybeSingle()

      if (callerProfile?.platform_role !== 'super_admin') {
        return NextResponse.json(
          { error: 'Only a platform administrator may send to addresses that are not on the roster.' },
          { status: 403 }
        )
      }

      if (manualRequested.length > MAX_MANUAL_RECIPIENTS) {
        return NextResponse.json(
          { error: `At most ${MAX_MANUAL_RECIPIENTS} typed addresses per notice.` },
          { status: 400 }
        )
      }

      const invalid = manualRequested.filter((e) => !EMAIL_SHAPE.test(e))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Not a valid email address: ${invalid[0]}` },
          { status: 400 }
        )
      }

      // De-duplicated against each other AND against the roster
      // selection, so nobody receives the same notice twice because he
      // was both picked and typed.
      const alreadyGoing = new Set(
        (members ?? []).map((m: any) => (m.profiles?.email ?? '').toLowerCase()).filter(Boolean)
      )
      for (const email of Array.from(new Set(manualRequested))) {
        if (!alreadyGoing.has(email)) manualRecipients.push({ email, firstName: 'Brother' })
      }
    }

    // Validation happens before any network call, so one unusable
    // address can't reject a batch of 100 good ones.
    const { valid, failed: unreachable } = collectRecipients(
      [
        ...(members ?? []).map((m: any) => ({
          email: m.profiles?.email,
          firstName: m.profiles?.first_name,
        })),
        // Hand-typed addresses go through the same validation and the
        // same batch as everyone else — they are not a second send
        // path, just extra rows on this one.
        ...manualRecipients,
      ]
    )

    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'Nobody in that selection has an email address on file.' },
        { status: 400 }
      )
    }

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
      brand: toLodgeBrand(tenant),
      subject,
      body,
      sentByName,
      replyTo: sender?.email ?? undefined,
      scheduledAt: scheduleIso,
      event: noticeEvent,
      meetingUrl: joinUrl,
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
        // For a scheduled notice this records when it was QUEUED.
        // scheduled_for carries when it actually goes out.
        sent_at: new Date().toISOString(),
        scheduled_for: scheduleIso ?? null,
        event_id: eventId || null,
        meeting_url: joinUrl ?? null,
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

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: await actorName(auth.userId),
      action: 'communication.sent',
      summary: scheduleIso
        ? `Scheduled the notice "${subject}" to ${total} recipient(s) for ${scheduleIso}`
        : `Sent the notice "${subject}" to ${sent} of ${total} recipient(s)`,
      entityType: 'communication',
      entityId: (comm as any)?.id ?? null,
      detail: { subject, sent, failed: allFailures.length, total, recipientGroup },
    })

    return NextResponse.json({
      success: sent > 0,
      sent,
      failed: allFailures.length,
      total,
      failedRecipients: allFailures,
      scheduledFor: scheduleIso ?? null,
      communication: comm,
    })
  } catch (error: any) {
    console.error('Send communication error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
