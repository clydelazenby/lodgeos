'use client'
import { useParams } from 'next/navigation'
import { LodgeRoomView } from '@/components/lodge/LodgeRoomView'

/**
 * The Lodge Room — a real floor-plan visualization of officer stations,
 * matching the reference image's spatial layout (WM centered at the
 * East, Wardens flanking, Deacons/Tyler near the West entrance).
 *
 * This is deliberately the STATIC version the design-patterns research
 * recommended over a full drag-and-drop seating engine: positions are
 * fixed by traditional lodge geometry, not draggable. A member is
 * assigned to a station by setting their Lodge Role on the Members
 * page (same source of truth as the Dashboard's station panel and the
 * Officer Coverage page) — this page only VISUALIZES that assignment
 * spatially, it doesn't introduce a second place assignments live.
 *
 * What genuinely is interactive here: selecting a real meeting and
 * seeing who actually attended, using the real attendance table — not
 * a static mockup of presence, real per-event data.
 *
 * The plan itself now lives in components/lodge/LodgeRoomView so the
 * brother portal can show it too. This page is the officer view of it:
 * interactive, with the meeting picker and the station modal.
 */
export default function LodgeRoomPage() {
  const params = useParams()
  const slug = params.slug as string

  return <LodgeRoomView slug={slug} interactive showHeading />
}
