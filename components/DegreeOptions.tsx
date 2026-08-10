'use client'

import { DEGREE_GROUPS, degreesInGroup, degreeShortLabel } from '@/lib/degrees'

/**
 * The degree dropdown's contents, grouped by body.
 *
 * Rendered as <optgroup>s so a Secretary opening the list sees Blue
 * Lodge, York Rite, Scottish Rite and Shrine as separate headings
 * rather than seventeen undifferentiated lines.
 *
 * Exists so the roster table, the invite form and the document access
 * selector cannot drift apart. They were three hand-written copies of
 * the same three <option>s, which is exactly how a list grows a
 * fourth, inconsistent copy.
 *
 * `mode`:
 *   'assign' — picking a brother's own degree.
 *   'access' — picking the FLOOR for a document, so it leads with
 *              "All Brothers" and reads "… and above". Access has
 *              always been a floor; the old selector said "Master
 *              Mason only", which described the opposite of what the
 *              download route enforces.
 */
export function DegreeOptions({
  mode = 'assign',
  short = false,
}: { mode?: 'assign' | 'access'; short?: boolean }) {
  return (
    <>
      {mode === 'access' && <option value="all">All Brothers</option>}
      {DEGREE_GROUPS.map(group => (
        <optgroup key={group} label={group}>
          {degreesInGroup(group).map(degree => (
            <option key={degree.value} value={degree.value}>
              {short
                ? degreeShortLabel(degree.value)
                : mode === 'access'
                  ? `${degree.label} and above`
                  : degree.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}
