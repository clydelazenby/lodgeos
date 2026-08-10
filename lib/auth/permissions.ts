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

/**
 * Tiers granted each capability, mirroring the route guards exactly.
 *
 * `admin` and `secretary` hold everything: between them they are the
 * lodge's administrative office. The narrower grants below are the
 * interesting ones, and each matches a deliberate decision already made
 * in the corresponding route — a Deacon has real duties in this app,
 * but fining a brother and speaking for the lodge by email are not
 * among them.
 */
const GRANTS: Record<Capability, TenantRole[]> = {
  finance: ['admin', 'secretary', 'treasurer', 'worshipful_master'],
  communications: ['admin', 'secretary', 'worshipful_master'],
  roster: ['admin', 'secretary'],
  documents: ['admin', 'secretary'],
  events: ['admin', 'secretary', 'worshipful_master'],
  meetings: ['admin', 'secretary', 'worshipful_master', 'treasurer', 'warden', 'deacon'],
  settings: ['admin', 'secretary'],
  insight: ['admin', 'secretary', 'worshipful_master', 'treasurer', 'warden', 'deacon'],
}

/**
 * @param role   the brother's tenant_role, or null for a super admin
 *               viewing a lodge he is not a member of
 * @param isSuperAdmin platform administrators see everything, matching
 *               requireTenantRole(), which returns tenantRole:'admin'
 *               for them
 */
export function can(
  role: TenantRole | null | undefined,
  capability: Capability,
  isSuperAdmin = false
): boolean {
  if (isSuperAdmin) return true
  if (!role) return false
  return GRANTS[capability].includes(role)
}

/** Human-readable office title for a tier, for greetings and badges. */
export function roleLabel(role: TenantRole | null | undefined): string {
  if (!role) return 'Member'
  return role
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}
