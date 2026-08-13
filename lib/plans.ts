/**
 * What a lodge's plan actually allows, enforced.
 *
 * THE STARTER PLAN SAYS "Up to 30 members" ON THE PRICING PAGE AND
 * NOTHING ANYWHERE CHECKED IT. A promise on a marketing page that the
 * software does not keep is not a generous limit — it is a limit that
 * exists only when someone eventually notices, which is the worst
 * moment to discover it. A lodge on Starter could put three hundred
 * brothers on the roster and would then be told, some time later, that
 * it owed for a plan it thought it was under.
 *
 * WHAT COUNTS. Active members only. A brother who has demitted or been
 * suspended is history the lodge keeps, and charging for history would
 * give a Secretary a reason to delete records rather than mark them —
 * which is precisely the behaviour every other decision in this app is
 * arranged to prevent.
 *
 * WHAT HAPPENS AT THE LIMIT. The 31st invitation is refused with a
 * sentence naming the plan, the number, and the way out. Nothing that
 * is already on the roster is touched: a lodge that crosses the line by
 * an import, or by moving down a plan, keeps every brother it has and
 * simply cannot add another until it upgrades. Taking a man off a
 * roster to fit a billing tier is not a thing software should do on its
 * own.
 *
 * No imports from the server here — this is read by the routes and by
 * the pricing page alike.
 */

export type PlanKey = 'starter' | 'pro' | 'district' | 'trial'

/** null = no ceiling. */
export const PLAN_MEMBER_LIMIT: Record<PlanKey, number | null> = {
  // Matches PLANS in types/index.ts, which is what the pricing page
  // renders. If these two ever disagree, the page is lying.
  starter: 30,
  pro: null,
  district: null,
  // A lodge still being onboarded is not yet on a plan. Given the
  // Starter allowance so a trial is a real trial, not a demo.
  trial: 30,
}

export function memberLimitFor(plan: string | null | undefined): number | null {
  const key = (plan ?? 'trial') as PlanKey
  return key in PLAN_MEMBER_LIMIT ? PLAN_MEMBER_LIMIT[key] : null
}

export type RoomCheck =
  | { ok: true }
  | { ok: false; limit: number; current: number; plan: string; message: string }

/**
 * Is there room for `adding` more active members?
 *
 * `current` is the count of ACTIVE members now. Called before a write,
 * so it answers "may this go ahead", not "did we go over".
 */
export function roomForMembers(
  plan: string | null | undefined,
  current: number,
  adding = 1
): RoomCheck {
  const limit = memberLimitFor(plan)
  if (limit === null) return { ok: true }
  if (current + adding <= limit) return { ok: true }

  const planName = (plan ?? 'trial').replace(/^\w/, c => c.toUpperCase())
  const room = Math.max(0, limit - current)

  return {
    ok: false,
    limit,
    current,
    plan: plan ?? 'trial',
    message:
      adding === 1
        ? `The ${planName} plan covers ${limit} brothers and the roster has ${current}. Upgrade the lodge's plan in Settings to add another — nobody already on the roster is affected.`
        : room === 0
          ? `The ${planName} plan covers ${limit} brothers and the roster already has ${current}. Upgrade the lodge's plan in Settings before importing — nobody already on the roster is affected.`
          : `That would add ${adding} brothers to a roster of ${current}, and the ${planName} plan covers ${limit}. There is room for ${room} more, or upgrade the lodge's plan in Settings.`,
  }
}
