import type { TenantRole } from '@/lib/auth/requireTenantAdmin'

/**
 * What each officer tier can do.
 *
 * THIS IS NOT A SECURITY BOUNDARY.
 *
 * Every rule here duplicates one already enforced server-side by
 * requireTenantRole() in the API routes, and by RLS in the database.
 * Hiding a nav link or a button in the browser stops nothing — anyone
 * can call the endpoint directly. The server checks are the boundary;
 * this exists so the interface stops ADVERTISING tools a brother cannot
 * use and then failing him at the last step.
 *
 * Before this, every officer saw all six nav sections and all seventeen
 * pages. A Deacon could open Dues, read the ledger, fill in "Add
 * Charge" and only then receive a 403. Nothing leaked — the reads are
 * RLS-gated — but it is a poor experience and it misrepresents the
 * lodge's own delegation of authority.
 *
 * KEEP IN SYNC WITH THE ROUTES. Each capability below names the route
 * that actually enforces it, so a change in one has an obvious partner.
 *
 * PER-BROTHER EXCEPTIONS (migration 035) ride on top of the tier map.
 * The tier is still the rule; an exception is an amendment to it for one
 * man, in either direction. Pass them as the fourth argument to can().
 * Server-side they are read and enforced in lib/auth/capabilities.ts —
 * which is the boundary. This file is still not.
 */

export type Capability =
  /** Set the dues rate, levy penalties, send dues reminders.
   *  Enforced by /api/dues/rate, /api/dues/charges, /api/dues/remind. */
  | 'finance'
  /** Send lodge-wide notices. Enforced by /api/communications/send. */
  | 'communications'
  /** Invite and remove brothers. Enforced by /api/members/invite,
   *  /api/members/remove. */
  | 'roster'
  /** Upload and delete documents. Enforced by /api/documents/record,
   *  /api/documents/[id]. */
  | 'documents'
  /** Create/delete events, send invites. Enforced by
   *  /api/meeting/create, /api/events/[eventId]. */
  | 'events'
  /** Open/close the lodge, record attendance, mark degree progress.
   *  Enforced by /api/meeting/*, /api/attendance/*, /api/degrees/*. */
  | 'meetings'
  /** Lodge settings and the annual officer handover. */
  | 'settings'
  /** Read-only analytics, reports, coverage, care register. */
  | 'insight'
  /** Give a brother a task or put a candidate on a degree plan.
   *  Enforced by /api/assignments. */
  | 'assignments'

/**
 * Tiers granted each capability, mirroring the route guards exactly.
 *
 * `admin`, `secretary` and `grand_master` hold everything: the first
 * two are the lodge's administrative office, and the Grand Master
 * outranks all of it when he is present. The narrower grants below are the
 * interesting ones, and each matches a deliberate decision already made
 * in the corresponding route — a Deacon has real duties in this app,
 * but fining a brother and speaking for the lodge by email are not
 * among them.
 */
const GRANTS: Record<Capability, TenantRole[]> = {
  finance: ['admin', 'secretary', 'grand_master', 'treasurer', 'worshipful_master'],
  communications: ['admin', 'secretary', 'grand_master', 'worshipful_master'],
  roster: ['admin', 'secretary', 'grand_master'],
  documents: ['admin', 'secretary', 'grand_master'],
  events: ['admin', 'secretary', 'grand_master', 'worshipful_master'],
  meetings: ['admin', 'secretary', 'grand_master', 'worshipful_master', 'treasurer', 'warden', 'deacon'],
  settings: ['admin', 'secretary', 'grand_master'],
  insight: ['admin', 'secretary', 'grand_master', 'worshipful_master', 'treasurer', 'warden', 'deacon'],
  /**
   * The Master, the Secretary and the Wardens.
   *
   * NOTE ON THE WARDENS. The lodge asked for the SENIOR Warden, and
   * tenant_role cannot express that — 'warden' is one tier covering
   * both Senior and Junior, by the deliberate design recorded above.
   * The exact office lives in lodge_role, which is presentation rather
   * than permission. Rather than invent a second permission axis for
   * one grant, both Wardens can assign; a Junior Warden asking a
   * brother to do something is not an escalation, and the assignment
   * records who gave it. If a lodge wants it narrowed to the Senior
   * Warden specifically, that is a lodge_role check at the route.
   */
  assignments: ['admin', 'secretary', 'grand_master', 'worshipful_master', 'warden'],
}

/** Every capability, in the order the permissions editor lists them. */
export const CAPABILITIES = Object.keys(GRANTS) as Capability[]

/**
 * What each one is called and what it lets a man do, in the words an
 * officer would use standing in front of the brother concerned.
 *
 * These strings are the interface. A toggle labelled `finance` tells
 * nobody what they are about to hand over; "Dues & money — set the
 * dues rate, add charges, send dues reminders" does.
 */
export const CAPABILITY_META: Record<Capability, { label: string; blurb: string }> = {
  finance: {
    label: 'Dues & money',
    blurb: 'Set the dues rate, add or waive charges, send dues reminders.',
  },
  communications: {
    label: 'Notices',
    blurb: 'Write and send notices to the lodge in its name.',
  },
  roster: {
    label: 'The roster',
    blurb: 'Invite brothers, take them off the roster, and keep their Masonic dates.',
  },
  documents: {
    label: 'Documents',
    blurb: 'Upload, replace and delete anything in the document library.',
  },
  events: {
    label: 'Events',
    blurb: 'Call meetings and events, and send the invitations.',
  },
  meetings: {
    label: 'Running a meeting',
    blurb: 'Open and close the lodge, record attendance, write minutes, mark degree progress.',
  },
  settings: {
    label: 'Lodge settings',
    blurb: 'Lodge details and branding, the annual officer handover, and permissions like these.',
  },
  insight: {
    label: 'Reports & analytics',
    blurb: 'Read the analytics, the reports, coverage and the care register.',
  },
  assignments: {
    label: 'Giving out work',
    blurb: 'Give a brother a task, or put a candidate on a degree plan.',
  },
}

/**
 * One brother's exceptions to his tier, as stored in
 * member_capabilities. An absent key means no exception — his tier
 * decides. See the migration for why that is not the same as false.
 */
export type CapabilityOverrides = Partial<Record<Capability, boolean>>

/**
 * @param role   the brother's tenant_role, or null for a super admin
 *               viewing a lodge he is not a member of
 * @param isSuperAdmin platform administrators see everything, matching
 *               requireTenantRole(), which returns tenantRole:'admin'
 *               for them
 * @param overrides his per-brother exceptions, if they have been loaded.
 *               Omitting them falls back to the tier defaults — which is
 *               correct for a caller that has not read them, and is why
 *               the browser is not the boundary.
 *
 * PRECEDENCE: super admin, then the brother's own exception, then his
 * tier. A platform administrator is deliberately above the exception
 * layer — he is the man a lodge calls when it has locked itself out,
 * and a lodge that could revoke his access could do so by accident and
 * then have nobody to call.
 */
export function can(
  role: TenantRole | null | undefined,
  capability: Capability,
  isSuperAdmin = false,
  overrides?: CapabilityOverrides | null
): boolean {
  if (isSuperAdmin) return true
  const exception = overrides?.[capability]
  if (exception !== undefined) return exception
  if (!role) return false
  return GRANTS[capability].includes(role)
}

/** Whether a tier grants this on its own, ignoring any exception. */
export function tierGrants(role: TenantRole | null | undefined, capability: Capability): boolean {
  if (!role) return false
  return GRANTS[capability].includes(role)
}

/** The tiers that hold a capability by default — shown in the editor. */
export function grantedTiers(capability: Capability): TenantRole[] {
  return GRANTS[capability]
}

/** Human-readable office title for a tier, for greetings and badges. */
export function roleLabel(role: TenantRole | null | undefined): string {
  if (!role) return 'Member'
  return role
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}
