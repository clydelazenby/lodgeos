/**
 * "Is this lodge already here?" — asked in a way that survives more
 * than one jurisdiction.
 *
 * WHY THIS EXISTS. The check shipped with the request queue matched on
 * a loose substring of the lodge's name and nothing else. That was
 * right for the case it was written for — a Senior Warden of the ONE
 * lodge on the platform asking to sign that same lodge up again — and
 * wrong the moment there are two.
 *
 * Lodge names are not distinctive. St John's, Solomon's, Hiram,
 * Corinthian, Widow's Son — every jurisdiction has one, sometimes
 * several, and they are different lodges entirely. A loose name match
 * across a growing platform produces a warning on almost every genuine
 * new signup, and a warning that is usually wrong is a warning nobody
 * reads. That is worse than no warning at all, because the one time it
 * matters it will be skimmed past with the rest.
 *
 * WHAT ACTUALLY IDENTIFIES A LODGE: its number within its jurisdiction.
 * "1827" alone is not unique; "1827 under the Grand Lodge of North
 * Carolina" very nearly is. So the number carries the match, the
 * jurisdiction confirms it, and the name is the weakest of the three
 * rather than the only one.
 *
 * Pure — no imports, so both the request route and the review page can
 * ask the same question and get the same answer.
 */

export type LodgeLike = {
  name?: string | null
  number?: string | null
  jurisdiction?: string | null
}

/** Lower case, no punctuation, no "lodge", no "no."/"#", collapsed. */
export function normaliseLodgeName(raw: string | null | undefined): string {
  return (raw ?? '')
    .toLowerCase()
    // Apostrophes go first and vanish rather than becoming spaces:
    // "Widow's Son" and "Widows Son" are one lodge, and splitting on
    // the apostrophe would make them two.
    .replace(/['\u2019]/g, '')
    .replace(/[#\u2116]/g, ' ')
    .replace(/\bno\.?\b/g, ' ')
    // \block?ge\b was a typo for \blodges?\b and matched "locge" —
    // so the word this function exists to remove was never removed,
    // and "Hiram" never matched "Hiram Lodge".
    .replace(/\blodges?\b/g, ' ')
    .replace(/\b(f&am|f\.?\s*&\s*a\.?\s*m\.?|a\.?f\.?&a\.?m\.?|pha)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    // The name frequently repeats the number. It is carried in its own
    // field, so here it only stops "Psalms of Job Lodge No. 1827" from
    // matching "Psalms of Job".
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Digits only: "No. 1827", "#1827" and "1827" are one number. */
export function normaliseLodgeNumber(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D+/g, '')
}

/**
 * Jurisdictions are typed by hand and arrive as "Unglnc North
 * Carolina", "MWPHGL of NC", "Grand Lodge of North Carolina". Reduced
 * to the words that carry meaning so two spellings of one Grand Lodge
 * can still agree.
 */
export function normaliseJurisdiction(raw: string | null | undefined): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/\b(grand|lodge|of|the|most|worshipful|prince|hall|affiliated|gl|mwphgl|free|accepted|masons?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** "north carolina" -> "nc", so an abbreviation can be recognised. */
function initials(value: string): string {
  const words = value.split(' ').filter(Boolean)
  return words.length >= 2 ? words.map(w => w[0]).join('') : value
}

export type MatchStrength = 'same-lodge' | 'possible' | 'none'

/**
 * How confident are we that these are the same lodge?
 *
 *   same-lodge — the number matches AND (the jurisdiction agrees or the
 *                name does). Worth stopping for.
 *   possible   — the name matches exactly and there is no number to
 *                separate them. Worth mentioning, not worth alarm.
 *   none       — everything else, including a shared word like "St
 *                John's" between two genuinely different lodges.
 */
export function lodgeMatchStrength(a: LodgeLike, b: LodgeLike): MatchStrength {
  const numberA = normaliseLodgeNumber(a.number)
  const numberB = normaliseLodgeNumber(b.number)
  const nameA = normaliseLodgeName(a.name)
  const nameB = normaliseLodgeName(b.name)
  const jurA = normaliseJurisdiction(a.jurisdiction)
  const jurB = normaliseJurisdiction(b.jurisdiction)

  const sameNumber = !!numberA && numberA === numberB
  const sameName = !!nameA && nameA === nameB
  // One jurisdiction naming the other's state counts: "north carolina"
  // and "unglnc north carolina" are the same place said twice.
  const sameJurisdiction =
    !!jurA && !!jurB && (
      jurA === jurB ||
      // One naming the other's state: "north carolina" inside "unglnc
      // north carolina".
      jurA.includes(jurB) || jurB.includes(jurA) ||
      // Or one abbreviating it. "NC" is not a substring of "north
      // carolina", so initials are compared as initials.
      initials(jurA) === jurB || initials(jurB) === jurA
    )

  if (sameNumber && (sameJurisdiction || sameName)) return 'same-lodge'
  if (sameName && !numberA && !numberB) return 'possible'
  return 'none'
}

/** The one worth interrupting a decision for. */
export function isSameLodge(a: LodgeLike, b: LodgeLike): boolean {
  return lodgeMatchStrength(a, b) === 'same-lodge'
}
