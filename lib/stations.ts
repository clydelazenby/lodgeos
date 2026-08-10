/**
 * The officer stations of a lodge, in the order they are worked.
 *
 * WHY THIS FILE EXISTS.
 *
 * `tenant_members.lodge_role` is the office a brother holds, and the
 * Lodge Room floor plan seats him by matching that string EXACTLY
 * against its own hard-coded layout. Until now the only way to set it
 * was a free-text box on the invite form, with "e.g. Senior Warden" as
 * a placeholder — so "Sr. Warden", "senior warden" or a stray space
 * left the man unseated with nothing to explain why, and the roster
 * table showed the office as plain text with no way to change it at
 * all. The Lodge Room's own subtitle told officers to "assign stations
 * from the Members page", and the Members page had no such control.
 *
 * One list, used by the dropdown and by the floor plan, so a station
 * cannot exist in one and not the other.
 *
 * `top` and `left` are the plan's geometry — percentages of the room,
 * laid out like an actual lodge floor: East at the top where the
 * Worshipful Master sits, West at the bottom by the Tyler's post.
 */

export type Station = {
  /** Stored verbatim in tenant_members.lodge_role. */
  name: string
  /** Phone-sized label for the floor plan. */
  short: string
  top: string
  left: string
}

export const STATIONS: Station[] = [
  { name: 'Worshipful Master', short: 'WM', top: '8%', left: '50%' },
  { name: 'Senior Warden', short: 'SW', top: '22%', left: '25%' },
  { name: 'Junior Warden', short: 'JW', top: '22%', left: '75%' },
  { name: 'Treasurer', short: 'Treas', top: '42%', left: '12%' },
  { name: 'Chaplain', short: 'Chap', top: '42%', left: '88%' },
  { name: 'Secretary', short: 'Sec', top: '58%', left: '12%' },
  { name: 'Marshal', short: 'Mar', top: '58%', left: '88%' },
  { name: 'Senior Deacon', short: 'SD', top: '48%', left: '38%' },
  { name: 'Junior Deacon', short: 'JD', top: '48%', left: '62%' },
  { name: 'Senior Steward', short: 'SS', top: '80%', left: '30%' },
  { name: 'Junior Steward', short: 'JS', top: '80%', left: '70%' },
  { name: 'Tyler', short: 'Tyler', top: '94%', left: '50%' },
]

export const STATION_NAMES: string[] = STATIONS.map(s => s.name)

/**
 * Offices a lodge may fill that have no chair on the plan. Selecting
 * one records the office on the roster; it simply does not seat him,
 * because the floor plan has twelve fixed positions and these are not
 * among them.
 */
export const OTHER_OFFICES: string[] = [
  'Past Master',
  'Organist',
  'Historian',
  'Almoner',
  'Trustee',
]

/** Everything the dropdown offers, seated stations first. */
export const ALL_OFFICES: string[] = [...STATION_NAMES, ...OTHER_OFFICES]

/** Sort key for a roster: officers in station order, then the rest. */
export function stationRank(lodgeRole?: string | null): number {
  const i = STATION_NAMES.indexOf((lodgeRole ?? '').trim())
  return i === -1 ? STATION_NAMES.length : i
}
