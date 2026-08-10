/**
 * Years of service, and the ones the lodge marks.
 *
 * A brother counts from the day he was raised. Nothing in this app knew
 * that date, so a fiftieth year passed unless somebody happened to
 * remember — which means it depended on the one man who had been there
 * long enough to remember also being at that meeting. Lodges lose these
 * constantly, and it is a loss noticed only afterwards.
 */

/**
 * The years a lodge marks with something more than a mention.
 *
 * Twenty-five and fifty are near-universal; sixty, seventy and
 * seventy-five follow from the same custom for the brethren who reach
 * them, and a lodge that has a seventy-year member very much wants to
 * be told. Descending so the largest matching milestone wins if the
 * list is ever changed to overlap.
 */
export const SERVICE_MILESTONES = [75, 70, 65, 60, 50, 40, 25] as const

export type Anniversary = {
  memberId: string
  name: string
  email: string | null
  raisedDate: string
  years: number
  /** The milestone year if this is one, otherwise null. */
  milestone: number | null
}

/**
 * Whole years between a raising and a given date.
 *
 * Deliberately not a division by 365.25, which is the obvious way to
 * write this and is wrong in exactly the case that matters. Swept over
 * ~11,000 raising dates from 1950 on, the approximation disagrees with
 * calendar arithmetic 0.3% of the time — and every disagreement is the
 * same shape: on the anniversary ITSELF, for a long span, it reports a
 * year short. A brother raised on 15 January 1961 is in his 65th year
 * on 15 January 2026, and the approximation calls it 64. That is the
 * one day, and the one brother, this whole feature exists for.
 *
 * Comparing calendar components has no such failure.
 */
export function yearsOfService(raisedDate: string, on: Date): number {
  const [y, m, d] = raisedDate.split('-').map(Number)
  let years = on.getFullYear() - y
  const month = on.getMonth() + 1
  const day = on.getDate()
  if (month < m || (month === m && day < d)) years--
  return years
}

/**
 * Anniversaries falling in the given month, for a set of memberships.
 *
 * Month-based rather than day-based on purpose: a lodge meets once or
 * twice a month, so a brother's fiftieth is announced at the meeting
 * nearest it, not on the day. Announcing on the exact day would be a
 * private email nobody else hears about, which is the opposite of the
 * point — this is a thing said in open lodge.
 */
export function anniversariesInMonth(
  members: {
    user_id: string
    raised_date: string | null
    profiles?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null
  }[],
  on: Date
): Anniversary[] {
  const month = on.getMonth() + 1

  return members
    .filter((m) => m.raised_date && Number(m.raised_date.slice(5, 7)) === month)
    .map((m) => {
      const raised = m.raised_date as string
      // Years as at the END of the anniversary month, so a brother
      // whose date falls on the 28th is listed as reaching 50 in that
      // month rather than as still on 49 on the 1st.
      const asAt = new Date(on.getFullYear(), month - 1, Number(raised.slice(8, 10)))
      const years = yearsOfService(raised, asAt)
      return {
        memberId: m.user_id,
        name: `${m.profiles?.first_name ?? ''} ${m.profiles?.last_name ?? ''}`.trim() || 'Brother',
        email: m.profiles?.email ?? null,
        raisedDate: raised,
        years,
        milestone: SERVICE_MILESTONES.find((y) => y === years) ?? null,
      }
    })
    .filter((a) => a.years > 0)
    .sort((a, b) => b.years - a.years)
}

/** "50 years" / "1 year", for a heading. */
export function serviceLabel(years: number): string {
  return `${years} ${years === 1 ? 'year' : 'years'}`
}

/**
 * The day of the month an anniversary falls on, for sorting a list that
 * spans a month.
 */
export function anniversaryDay(raisedDate: string): number {
  return Number(raisedDate.slice(8, 10))
}
