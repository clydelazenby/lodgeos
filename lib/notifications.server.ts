import { createServiceClient } from '@/lib/supabase/server'
import { notifiedByDefault, type RosterEvent } from '@/lib/notifications'

/**
 * Turning the rules in lib/notifications.ts into actual addresses.
 *
 * SERVER ONLY. Split from its own constants because the Notifications
 * board is a client component that needs the labels and the default
 * rule — and a client component that reaches createServiceClient pulls
 * next/headers into the browser bundle, which does not build.
 */

export type Recipient = {
  userId: string
  email: string
  name: string
}

/**
 * Everyone who should receive one particular notice, right now.
 *
 * Resolved at SEND TIME, never stored on the event. A list frozen when
 * the invitation went out would email last year's Secretary about a
 * brother who signed in this year.
 *
 * ACTIVE MEMBERS ONLY, and never the man the notice is about — telling
 * a brother that he himself has been removed, in an officer's words
 * written for officers, is not a message anyone meant to send. He gets
 * his own email from the removal route.
 */
export async function recipientsFor(
  tenantId: string,
  event: RosterEvent,
  excludeUserId?: string | null
): Promise<Recipient[]> {
  const supabase = createServiceClient()

  const [{ data: members }, { data: prefs }] = await Promise.all([
    supabase
      .from('tenant_members')
      .select('user_id, tenant_role, lodge_role, profiles(first_name, last_name, email)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    supabase
      .from('notification_preferences')
      .select('member_id, enabled')
      .eq('tenant_id', tenantId)
      .eq('event_type', event),
  ])

  const preference = new Map<string, boolean>()
  for (const row of prefs ?? []) preference.set((row as any).member_id, (row as any).enabled)

  const out: Recipient[] = []
  for (const m of (members ?? []) as any[]) {
    if (excludeUserId && m.user_id === excludeUserId) continue

    const explicit = preference.get(m.user_id)
    const wanted = explicit !== undefined
      ? explicit
      : notifiedByDefault(m.tenant_role, m.lodge_role)
    if (!wanted) continue

    const email = m.profiles?.email
    // No address, no notice. Silently skipped rather than throwing:
    // one officer with a missing email must not stop the other four
    // hearing that a brother was removed.
    if (!email) continue

    out.push({
      userId: m.user_id,
      email,
      name: `${m.profiles?.first_name ?? ''} ${m.profiles?.last_name ?? ''}`.trim() || 'Brother',
    })
  }
  return out
}

/**
 * Sends one notice to everyone on the list, and never lets the sending
 * break the thing it is reporting.
 *
 * Same rule as lib/audit.ts: an invitation that succeeded must not come
 * back as a failure because a notification bounced, and an officer must
 * never be told to retry something that already worked. Failures are
 * logged and counted, not thrown.
 */
export async function notifyEach(
  recipients: Recipient[],
  send: (recipient: Recipient) => Promise<unknown>
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  for (const recipient of recipients) {
    try {
      await send(recipient)
      sent += 1
    } catch (error) {
      failed += 1
      console.error(`Roster notification to ${recipient.email} failed:`, error)
    }
  }
  return { sent, failed }
}
