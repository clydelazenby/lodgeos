/**
 * Every degree a brother can be assigned, in one place.
 *
 * This is the single source of truth for the roster dropdown, the
 * invite form, the document access selector, and every server-side
 * check. It exists because the degree list was previously inlined as a
 * three-option <select> in two components and a `check (degree in
 * ('EA','FC','MM'))` constraint in the schema, which meant adding a
 * degree touched five files and silently missed the ones nobody
 * remembered.
 *
 * ON RANK, AND WHAT IT HONESTLY MEANS.
 *
 * `rank` drives document access, which has always worked as a FLOOR: a
 * document marked MM is visible to MM and anything beyond it, because
 * a Master Mason does not lose the right to read Master Mason material
 * by joining the Shrine.
 *
 * Within the Blue Lodge (EA → FC → MM) that ordering is real: a
 * Fellowcraft genuinely has not taken the Master Mason degree. Beyond
 * it, the ordering is NOMINAL. A Knight Templar is not "below" a 32°,
 * and a Noble is not "above" either — the York Rite, Scottish Rite and
 * Shrine are parallel bodies, not rungs of one ladder. What IS true,
 * and what the ordering encodes correctly, is that every appendant
 * degree here requires the Master Mason degree first, so all of them
 * rank above MM.
 *
 * The practical consequence: restrict documents by the Blue Lodge
 * floors (all / EA / FC / MM) and they behave exactly as expected.
 * Restricting one to, say, Knight Templar will hide it from a 32° who
 * is not a Templar — but will also show it to every degree ranked
 * above it, which is not the same thing as "Knights Templar only".
 * There is no way to express "this body only" in a single ranked
 * field; that needs per-body affiliations, which is a different shape
 * of change than the one this file makes.
 */

export type DegreeGroup = 'Blue Lodge' | 'York Rite' | 'Scottish Rite' | 'Shrine'

export type Degree = {
  value: string
  label: string
  group: DegreeGroup
  /** Higher includes lower. See the caveat above about cross-body ordering. */
  rank: number
}

export const DEGREES: Degree[] = [
  { value: 'EA', label: 'Entered Apprentice', group: 'Blue Lodge', rank: 1 },
  { value: 'FC', label: 'Fellowcraft', group: 'Blue Lodge', rank: 2 },
  { value: 'MM', label: 'Master Mason', group: 'Blue Lodge', rank: 3 },

  { value: 'MARK_MASTER', label: 'Mark Master', group: 'York Rite', rank: 4 },
  { value: 'PAST_MASTER', label: 'Past Master (Virtual)', group: 'York Rite', rank: 5 },
  { value: 'MOST_EXCELLENT_MASTER', label: 'Most Excellent Master', group: 'York Rite', rank: 6 },
  { value: 'ROYAL_ARCH', label: 'Royal Arch Mason', group: 'York Rite', rank: 7 },
  { value: 'ROYAL_MASTER', label: 'Royal Master', group: 'York Rite', rank: 8 },
  { value: 'SELECT_MASTER', label: 'Select Master', group: 'York Rite', rank: 9 },
  { value: 'SUPER_EXCELLENT_MASTER', label: 'Super Excellent Master', group: 'York Rite', rank: 10 },
  { value: 'KNIGHT_TEMPLAR', label: 'Knight Templar', group: 'York Rite', rank: 11 },

  { value: 'SR_14', label: '14° — Lodge of Perfection', group: 'Scottish Rite', rank: 12 },
  { value: 'SR_18', label: '18° — Rose Croix', group: 'Scottish Rite', rank: 13 },
  { value: 'SR_30', label: '30° — Council of Kadosh', group: 'Scottish Rite', rank: 14 },
  { value: 'SR_32', label: '32° — Master of the Royal Secret', group: 'Scottish Rite', rank: 15 },
  { value: 'SR_33', label: '33° — Inspector General Honorary', group: 'Scottish Rite', rank: 16 },

  { value: 'NOBLE', label: 'Noble of the Mystic Shrine', group: 'Shrine', rank: 17 },
]

export const DEGREE_VALUES: string[] = DEGREES.map(d => d.value)

export const DEGREE_RANK: Record<string, number> =
  Object.fromEntries(DEGREES.map(d => [d.value, d.rank]))

const LABELS: Record<string, string> =
  Object.fromEntries(DEGREES.map(d => [d.value, d.label]))

/** Order matters — it is the order the dropdown renders its groups in. */
export const DEGREE_GROUPS: DegreeGroup[] = ['Blue Lodge', 'York Rite', 'Scottish Rite', 'Shrine']

export function degreesInGroup(group: DegreeGroup): Degree[] {
  return DEGREES.filter(d => d.group === group)
}

/**
 * Human label for a stored value. Falls back to the raw value so a
 * degree written before this list existed, or one removed from it
 * later, still renders as something rather than blank.
 */
export function degreeLabel(value?: string | null): string {
  if (!value) return '—'
  return LABELS[value] ?? value
}

/** Short form for pills and tables, where the full label will not fit. */
export function degreeShortLabel(value?: string | null): string {
  if (!value) return '—'
  const degree = DEGREES.find(d => d.value === value)
  if (!degree) return value
  if (degree.group === 'Blue Lodge') return degree.value
  // "14° — Lodge of Perfection" → "14°", "Knight Templar" → "Knight Templar"
  return degree.label.split('—')[0].trim()
}

export function degreeRank(value?: string | null): number {
  if (!value) return 0
  return DEGREE_RANK[value] ?? 0
}

/**
 * Does a brother holding `held` meet a requirement of `required`?
 * 'all' (or nothing) means no requirement at all.
 */
export function meetsDegree(held?: string | null, required?: string | null): boolean {
  if (!required || required === 'all') return true
  return degreeRank(held) >= degreeRank(required)
}

/**
 * CSS class for the degree pill.
 *
 * Not `pill-${value.toLowerCase()}` — that was fine while the only
 * values were ea/fc/mm and there was a rule for each, but it silently
 * produces an unstyled pill for every degree added since (there is no
 * `.pill-sr_32`). One class per body instead, so the list can grow
 * without needing a new rule each time.
 */
export function degreePillClass(value?: string | null): string {
  const degree = DEGREES.find(d => d.value === value)
  if (!degree) return 'pill-new'
  switch (degree.group) {
    case 'Blue Lodge': return `pill-${degree.value.toLowerCase()}`
    case 'York Rite': return 'pill-york'
    case 'Scottish Rite': return 'pill-scottish'
    case 'Shrine': return 'pill-shrine'
  }
}

/** Master Mason and every degree that requires it. Used for MM-only mail. */
export const MM_AND_ABOVE: string[] =
  DEGREES.filter(d => d.rank >= DEGREE_RANK.MM).map(d => d.value)

/** Brothers still progressing through the Blue Lodge. */
export const CANDIDATE_DEGREES: string[] = ['EA', 'FC']
