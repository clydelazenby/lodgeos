import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Resend delivery webhooks.
 *
 * WHAT THIS ADDS OVER `sent_count`
 *
 * The send route records how many messages Resend ACCEPTED. Acceptance
 * happens in milliseconds and says nothing about arrival. The events
 * that actually matter to a secretary all arrive later, out of band:
 *
 *   email.delivered       the receiving server took it
 *   email.bounced         permanently undeliverable — this brother has
 *                         silently stopped receiving every lodge notice
 *   email.complained      marked as spam, which damages the sending
 *                         domain's reputation for the whole lodge
 *   email.delivery_delayed temporary failure, still retrying
 *   email.opened          requires open tracking enabled in Resend
 *   email.clicked         requires click tracking enabled in Resend
 *
 * AUTHENTICATION
 *
 * Resend signs webhooks with Svix. This endpoint is public — there is no
 * session, no cookie, and no tenant context on the request — so the
 * signature IS the authentication. Anyone who can POST here could
 * otherwise fabricate delivery results, or mark every brother's address
 * as bounced.
 *
 * Verification uses the official svix library rather than a hand-rolled
 * HMAC. It handles the parts that are easy to get subtly wrong: constant
 * -time comparison, the timestamp tolerance that prevents replay, and
 * multiple signatures during secret rotation.
 *
 * Fails closed: with no RESEND_WEBHOOK_SECRET configured, every request
 * is rejected rather than the check being skipped.
 *
 * ORDERING IS NOT GUARANTEED
 *
 * Webhooks can arrive out of order and more than once. 'opened' commonly
 * beats 'delivered'. So status only ever moves FORWARD through
 * STATUS_RANK — a late 'delivered' can never erase a 'bounced', and a
 * duplicate delivery of the same event is a no-op.
 */

// Raw body is required for signature verification, so this route must
// not run on the edge runtime where the body may be transformed.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Higher rank wins. Terminal problem states (bounced, complained) sit
 * above engagement states deliberately: if a message was opened and then
 * the address hard-bounced on a later send... that's a different row.
 * Within ONE message, a bounce is the most important fact about it, and
 * must not be overwritten by a stray open event arriving afterwards.
 */
const STATUS_RANK: Record<string, number> = {
  sent: 1,
  delayed: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  // `failed` sits ABOVE the delivery states, not at 0.
  //
  // It doubles as the status written at send time for messages Resend
  // never accepted — but those rows have a null resend_email_id, so no
  // webhook can ever match them and their rank is irrelevant. What DOES
  // matter is the live case: a row already marked `sent` (rank 1) that
  // later receives email.failed. Ranked at 0 that event would have been
  // silently discarded as stale, and the notice would have shown as
  // successfully sent to a brother who never got it.
  failed: 6,
  bounced: 7,
  complained: 8,
}

const EVENT_TO_STATUS: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  // Resend could not send it at all.
  'email.failed': 'failed',
  // Blocked before sending because the address is on the account's
  // suppression list — normally from an earlier bounce or complaint.
  // The brother did not receive this notice, so it must not be counted
  // as sent, and the secretary needs to see the address is suppressed:
  // it will keep silently dropping every future notice until cleared.
  'email.suppressed': 'failed',
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET

  if (!secret) {
    console.error('RESEND_WEBHOOK_SECRET is not set — rejecting all Resend webhooks until configured.')
    return NextResponse.json({ error: 'Webhook endpoint misconfigured' }, { status: 500 })
  }

  // Must be the raw string exactly as sent; parsing and re-serializing
  // would change the bytes and invalidate the signature.
  const payload = await request.text()

  const svixHeaders = {
    'svix-id': request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  }

  let event: any
  try {
    event = new Webhook(secret).verify(payload, svixHeaders)
  } catch (err: any) {
    console.error('Resend webhook signature verification failed:', err?.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const status = EVENT_TO_STATUS[event?.type]

  // Unknown event types are acknowledged, not rejected. Returning a
  // non-2xx would make Resend retry an event we will never understand,
  // and repeated failures can get the endpoint disabled entirely —
  // taking the events we DO care about down with it.
  if (!status) {
    return NextResponse.json({ received: true, ignored: event?.type })
  }

  const emailId = event?.data?.email_id
  if (!emailId) {
    return NextResponse.json({ received: true, ignored: 'no email_id' })
  }

  const supabase = createServiceClient()

  const { data: row, error: lookupError } = await supabase
    .from('communication_recipients')
    .select('id, status')
    .eq('resend_email_id', emailId)
    .maybeSingle()

  if (lookupError) {
    console.error('Resend webhook lookup failed:', lookupError)
    // A 500 asks Resend to retry, which is right for a transient
    // database problem.
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }

  // Not one of ours — transactional mail (invites, receipts, dues
  // reminders) isn't tracked per-recipient. Acknowledge and move on.
  if (!row) {
    return NextResponse.json({ received: true, ignored: 'untracked message' })
  }

  const currentRank = STATUS_RANK[row.status] ?? 0
  const incomingRank = STATUS_RANK[status] ?? 0

  if (incomingRank <= currentRank) {
    // Out-of-order or duplicate. Acknowledged so Resend stops retrying.
    return NextResponse.json({ received: true, ignored: 'stale event' })
  }

  // Bounce and complaint payloads carry the provider's own explanation.
  // "mailbox full" and "user unknown" call for very different responses
  // from a secretary, so the text is kept verbatim.
  const detail =
    event?.data?.bounce?.message ??
    event?.data?.bounce?.subType ??
    (status === 'complained' ? 'Recipient marked this message as spam' : null)

  const { error: updateError } = await supabase
    .from('communication_recipients')
    .update({
      status,
      detail,
      last_event_at: event?.created_at ?? new Date().toISOString(),
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('Resend webhook update failed:', updateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // The rolled-up counts on `communications` are maintained by the
  // trigger installed in migration 012, not here — so they stay correct
  // regardless of what writes to this table.
  return NextResponse.json({ received: true, status })
}
