'use client'

import { STATIONS, OTHER_OFFICES, ALL_OFFICES } from '@/lib/stations'

/**
 * The office a brother holds.
 *
 * Replaces a free-text box whose value had to match the Lodge Room's
 * station names character for character to seat him. "Sr. Warden" left
 * a man standing with nothing to explain why.
 *
 * PRESERVES WHAT IS ALREADY STORED. If a lodge has an office this list
 * does not know about, it is added as an option rather than dropped —
 * a select whose value is absent from its options renders blank, and
 * the next save would have silently wiped an office somebody had
 * deliberately typed.
 */
export function OfficeSelect({
  value,
  onChange,
  style,
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  style?: React.CSSProperties
  ariaLabel?: string
}) {
  const current = (value ?? '').trim()
  const unknown = current.length > 0 && !ALL_OFFICES.includes(current)

  return (
    <select
      value={current}
      onChange={e => onChange(e.target.value)}
      aria-label={ariaLabel ?? 'Lodge office'}
      style={style}
    >
      <option value="">— No office —</option>
      <optgroup label="Stations (seated in the Lodge Room)">
        {STATIONS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
      </optgroup>
      <optgroup label="Other offices">
        {OTHER_OFFICES.map(o => <option key={o} value={o}>{o}</option>)}
      </optgroup>
      {unknown && (
        <optgroup label="Currently recorded">
          <option value={current}>{current}</option>
        </optgroup>
      )}
    </select>
  )
}
