/**
 * Who hears when the roster changes.
 *
 * THIS FILE MUST STAY FREE OF SERVER IMPORTS. The Notifications board
 * is a client component and reads EVENT_META and notifiedByDefault to
 * render, so anything reaching lib/supabase/server from here drags
 * next/headers into the browser bundle and the build fails outright —
 * which is exactly how this file was first written. Resolving actual
 * recipients lives in lib/notifications.server.ts.
 *
 * THE DEFAULT SET, and why it is two rules rather than one:
 *
 *   by TIER    admin, secretary, grand_master — "anyone with admin
 *              access", which is a permission question and lives on
 *              tenant_role.
 *
 *   by OFFICE  Worshipful Master, Senior Warden — which tenant_role
 *              genuinely cannot express. Both Wardens sit on 'warden',
 *              both Deacons on 'deacon', and a lodge may put a Warden on
 *              the Master's tier (this one has, which is exactly the
 *              case that made a tier-only rule reach the wrong man).
 *              lodge_role holds the actual chair.
 *
 * Doing it by office also means these notices follow the CHAIR through
 * the annual handover instead of following the man out of it — the same
 * reasoning as the per-office permissions in migration 036.
 *
 * AN EXPLICIT PREFERENCE OVERRULES BOTH, in either direction. Anyone
 * may silence his own; anyone may be added who no rule covers. A
 * notification nobody can stop is one people filter away unread, which
 * is worse than not sending it — it teaches them to ignore the channel
 * you will eventually need.
 */

export const ROSTER_EVENTS = [
  'member.invited',
  'member.first_signin',
  'member.removed',
] as const

export type RosterEvent = typeof ROSTER_EVENTS[number]

export const EVENT_META: Record<RosterEvent, { label: string; blurb: string }> = {
  'member.invited': {
    label: 'A brother is invited',
    blurb: 'Sent when an invitation goes out, with the address it went to.',
  },
  'member.first_signin': {
    label: 'He signs in for the first time',
    blurb:
      'The only proof an invitation actually worked. Without it a failed invite is invisible until he turns up at a meeting unable to sign in.',
  },
  'member.removed': {
    label: 'A brother is removed',
    blurb: 'Sent when someone comes off the roster, with the reason recorded.',
  },
}

/** Tiers that hear by default — "anyone with admin access". */
const NOTIFIED_TIERS = new Set(['admin', 'secretary', 'grand_master'])

/**
 * Chairs that hear by default, matched against lodge_role verbatim.
 *
 * SENIOR WARDEN, NOT SENIOR DEACON. The lodge asked for "the Senior
 * Deacon" and meant the man in that seat — who is the Senior Warden.
 * Recorded here as the CHAIR rather than as his name, so it passes to
 * whoever holds it after the December handover instead of following him
 * out of it; and either way any individual can be switched on or off by
 * hand on the Notifications page.
 */
const NOTIFIED_OFFICES = new Set(['Worshipful Master', 'Senior Warden'])

export function notifiedByDefault(
  tenantRole: string | null | undefined,
  lodgeRole: string | null | undefined
): boolean {
  if (tenantRole && NOTIFIED_TIERS.has(tenantRole)) return true
  return NOTIFIED_OFFICES.has((lodgeRole ?? '').trim())
}

/** Why he is on the list, for the interface to say so. */
export function defaultReason(
  tenantRole: string | null | undefined,
  lodgeRole: string | null | undefined
): string | null {
  if (tenantRole && NOTIFIED_TIERS.has(tenantRole)) return 'Administrative access'
  const office = (lodgeRole ?? '').trim()
  if (NOTIFIED_OFFICES.has(office)) return office
  return null
}
