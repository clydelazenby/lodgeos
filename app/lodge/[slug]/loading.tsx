import { PageSkeleton } from '@/components/ui/RouteFallbacks'

/**
 * Streams the lodge chrome (header, nav, AI panel) immediately while
 * the page's own queries resolve underneath.
 *
 * This sits INSIDE lodge/[slug]/layout.tsx, so the layout's own auth
 * and tenant lookups still block first — which is correct, since the
 * nav can't render before we know the lodge exists and the visitor is
 * allowed in. What it removes is the wait for whatever the individual
 * page is fetching on top of that: the dashboard's year of attendance
 * records, the dues ledger, the analytics aggregations.
 */
export default function LodgeLoading() {
  return <PageSkeleton cards={4} />
}
