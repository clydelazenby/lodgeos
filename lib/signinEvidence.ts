/**
 * Working out whether a brother is arriving, or has been here all along.
 *
 * WHY THIS IS ITS OWN FILE. It is the decision behind an email that
 * must never be wrong, and it needs testing without dragging in a
 * Supabase client — lib/firstSignIn.ts reaches next/headers three hops
 * down, which is the same boundary that broke the build once already.
 * Pure functions, no imports.
 */

/**
 * Longer than a redirect, shorter than a walk to the car.
 *
 * A genuine first sign-in reaches the layout seconds after auth stamps
 * the record. Anything older than this is a man who was already using
 * the app before we started keeping the column — the four brothers who
 * had signed in before first_signin_at existed, and whose next page
 * load would otherwise have announced them as new arrivals.
 */
export const NEWS_WINDOW_MS = 10 * 60 * 1000

/**
 * The earliest moment the auth record can prove this man was ever here.
 *
 * confirmed_at is stamped when an invited brother follows his link,
 * which IS his first sign-in; last_sign_in_at is stamped every time
 * after. The earliest of whatever is present is the closest thing to
 * the truth, and an unparseable or missing value contributes nothing
 * rather than defaulting to now — a guess here becomes a date in the
 * lodge's record.
 */
export function earliestEvidence(user: {
  confirmed_at?: string | null
  email_confirmed_at?: string | null
  last_sign_in_at?: string | null
} | null | undefined): string | null {
  const times = [user?.confirmed_at, user?.email_confirmed_at, user?.last_sign_in_at]
    .map(t => (t ? Date.parse(t) : NaN))
    .filter(t => Number.isFinite(t))
  if (times.length === 0) return null
  return new Date(Math.min(...times)).toISOString()
}

export type SignInVerdict = {
  /** What to write into first_signin_at. */
  stamp: string
  /** Whether the officers should be told. */
  isNews: boolean
}

/**
 * No evidence at all means this really is the first anyone has seen of
 * him, so it is news and the stamp is now. Evidence from moments ago
 * means the same thing. Evidence from last week means the record was
 * simply never written — fill it in, and say nothing.
 */
export function judgeSignIn(
  evidence: string | null,
  now: number = Date.now()
): SignInVerdict {
  if (!evidence) return { stamp: new Date(now).toISOString(), isNews: true }
  const at = Date.parse(evidence)
  if (!Number.isFinite(at)) return { stamp: new Date(now).toISOString(), isNews: true }
  // A clock ahead of ours must not be read as ancient history.
  if (now - at > NEWS_WINDOW_MS) return { stamp: evidence, isNews: false }
  return { stamp: new Date(now).toISOString(), isNews: true }
}
