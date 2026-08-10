/**
 * Date helpers for comparing against `date` columns.
 *
 * THE BUG THIS EXISTS TO PREVENT
 *
 * Five places in this app were computing "today" as:
 *
 *     new Date().toISOString().split('T')[0]
 *
 * `toISOString()` always returns UTC. For a lodge in North Carolina
 * (UTC-4 in summer, UTC-5 in winter) that string flips to TOMORROW's
 * date at 8pm local — and lodges meet in the evening. So from 8pm on
 * the night of a stated communication, every "upcoming events" query
 * comparing `event_date >= today` silently dropped that very meeting:
 * it vanished from the dashboard, from the portal, from the public
 * lodge page, and from the Communications event picker, at exactly the
 * hour brothers were most likely to be looking for it.
 *
 * `lodge_events.event_date` is a bare `date` — a calendar day with no
 * time and no zone. The right comparison is therefore the reader's
 * LOCAL calendar day, which is what this returns.
 *
 * Note these run in both server and client components. On the server
 * "local" is the deployment's zone (UTC on Vercel), which is why
 * upcomingSince() below also allows a day of slack — that covers every
 * real timezone offset (max ±14h) without needing per-lodge timezone
 * configuration the schema does not currently carry.
 */

/** Today as YYYY-MM-DD in the runtime's local calendar, not UTC. */
export function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The lower bound for an "upcoming" query, one day back.
 *
 * The slack matters because this is called from server components,
 * where "local" is UTC. Without it a 7pm meeting tonight would be
 * excluded from a server-rendered list once UTC has rolled past
 * midnight. Including yesterday shows a meeting for at most one extra
 * day, which is the right trade: a lodge would far rather see
 * yesterday's meeting listed one day too long than lose tonight's from
 * the dashboard while brothers are on their way to it.
 */
export function upcomingSince(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDateString(d)
}
