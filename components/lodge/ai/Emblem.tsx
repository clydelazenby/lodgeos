/**
 * The square and compasses, drawn small.
 *
 * The launcher wore a generic four-pointed sparkle — the mark every
 * product in the world puts on an AI button. In an app whose typography
 * is Cinzel and whose colour is lodge gold, that was the one element
 * that said "bolted on". The emblem of the craft costs the same number
 * of pixels and belongs here.
 *
 * Compasses above (apex at the pivot, legs down), square below (vertex
 * at the bottom, arms up) — the arrangement itself, not a photograph of
 * it. `currentColor` so it takes the colour of whatever it sits in.
 */
export function SquareAndCompasses({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Square: vertex at the foot, arms rising outward. */}
      <path d="M4.5 11.5 L12 19 L19.5 11.5" opacity="0.75" />
      {/* Compasses: pivot at the head, legs descending. */}
      <path d="M12 4.6 L5.5 18" />
      <path d="M12 4.6 L18.5 18" />
      <circle cx="12" cy="4" r="1.5" />
    </svg>
  )
}
