/**
 * Why a brother is, or is no longer, on the rolls.
 *
 * The database had a boolean. A boolean cannot tell an annual return
 * whether a man demitted in good standing, was suspended for
 * non-payment, was expelled by the Grand Lodge, or died — and those are
 * the four the return asks about separately, because they mean entirely
 * different things and carry different consequences.
 *
 * Single source of truth for the vocabulary: migration 025 constrains
 * the column to exactly these values, and the annual return groups by
 * them.
 */

export type MembershipStatus =
  | 'active'
  | 'demitted'
  | 'suspended'
  | 'expelled'
  | 'deceased'
  | 'removed'
  | 'inactive_unspecified'

export type StatusDefinition = {
  value: MembershipStatus
  label: string
  /** Shown under the label when the Secretary is choosing. */
  hint: string
  /** Whether the brother remains on the roster and keeps portal access. */
  onRoster: boolean
  /**
   * Whether it is decent to send this man an automated email.
   *
   * The removal notice defaults on, and for a demit that is right — a
   * brother should hear it from his lodge rather than discover it at a
   * locked door. For a death it is not: the inbox is being read by his
   * widow. The Secretary can always override, but the default should
   * never have to be corrected in that particular case.
   */
  notifyByDefault: boolean
  /** Counted in the Grand Lodge return's losses breakdown. */
  countedAsLoss: boolean
}

export const MEMBERSHIP_STATUSES: StatusDefinition[] = [
  {
    value: 'active',
    label: 'Active',
    hint: 'On the rolls and in good standing.',
    onRoster: true,
    notifyByDefault: false,
    countedAsLoss: false,
  },
  {
    value: 'demitted',
    label: 'Demitted',
    hint: 'Left of his own accord, in good standing. May affiliate elsewhere or return.',
    onRoster: false,
    notifyByDefault: true,
    countedAsLoss: true,
  },
  {
    value: 'suspended',
    label: 'Suspended',
    hint: 'Non-payment of dues, or under discipline. Reversible.',
    onRoster: false,
    notifyByDefault: true,
    countedAsLoss: true,
  },
  {
    value: 'expelled',
    label: 'Expelled',
    hint: 'Removed by Grand Lodge action.',
    onRoster: false,
    notifyByDefault: false,
    countedAsLoss: true,
  },
  {
    value: 'deceased',
    label: 'Deceased',
    hint: 'Passed to the Grand Lodge above. No automated mail is sent.',
    onRoster: false,
    notifyByDefault: false,
    countedAsLoss: true,
  },
  {
    value: 'removed',
    label: 'Removed in error',
    hint: 'A duplicate row, a typo, a test entry. Not a Masonic status and not reported.',
    onRoster: false,
    notifyByDefault: false,
    countedAsLoss: false,
  },
  {
    value: 'inactive_unspecified',
    label: 'Inactive — reason not recorded',
    hint: 'Went inactive before the lodge began recording reasons.',
    onRoster: false,
    notifyByDefault: false,
    countedAsLoss: false,
  },
]

const BY_VALUE = new Map(MEMBERSHIP_STATUSES.map((s) => [s.value, s]))

/**
 * The statuses a Secretary may CHOOSE when taking a brother off the
 * roster. 'active' is not a removal reason, and the two housekeeping
 * values are not things anyone should be able to pick deliberately —
 * 'inactive_unspecified' exists only as the honest backfill for history
 * that predates this feature.
 */
export const REMOVAL_STATUSES = MEMBERSHIP_STATUSES.filter(
  (s) => !s.onRoster && s.value !== 'inactive_unspecified'
)

/** Statuses that count as a loss during the year, for the annual return. */
export const LOSS_STATUSES = MEMBERSHIP_STATUSES.filter((s) => s.countedAsLoss).map((s) => s.value)

export function statusLabel(value: string | null | undefined): string {
  if (!value) return 'Active'
  return BY_VALUE.get(value as MembershipStatus)?.label ?? value
}

export function statusDefinition(value: string | null | undefined): StatusDefinition | undefined {
  return BY_VALUE.get((value ?? 'active') as MembershipStatus)
}

export function isOnRoster(value: string | null | undefined): boolean {
  return statusDefinition(value)?.onRoster ?? false
}

/**
 * Pill colour, reusing the classes the rest of the app already defines
 * rather than inventing a parallel palette for one table.
 *
 * Deceased is deliberately not red. Red is the app's colour for a
 * problem — an expulsion, a bounced address, an overdue account — and a
 * brother who has died is not a problem. It takes the neutral pill.
 */
export function statusPillClass(value: string | null | undefined): string {
  switch (value) {
    case 'active':
      return 'pill-active'
    case 'expelled':
    case 'suspended':
      return 'pill-absent'
    case 'deceased':
      return 'pill-new'
    default:
      return 'pill-excused'
  }
}
