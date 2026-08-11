import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Per-request deduplicated reads.
 *
 * THE PROBLEM THIS SOLVES
 *
 * Rendering any lodge page used to cost roughly six serialized round
 * trips to Supabase before the page fetched a single thing it actually
 * wanted to display:
 *
 *   middleware.ts          getUser()
 *   lodge/[slug]/layout    getUser(), tenants, tenant_members, profiles
 *   lodge/[slug]/<page>    tenants (again — all 18 pages did this)
 *
 * The layout and the page it wraps are not separate requests. Next.js
 * renders them in a single server pass, so the second `tenants` lookup
 * asked the database a question it had already answered milliseconds
 * earlier, on every navigation.
 *
 * HOW cache() FIXES IT
 *
 * React's cache() memoizes by argument for the lifetime of ONE server
 * render. The layout calls getTenantBySlug('psalms-of-job-1827'), the
 * page calls it again with the same slug, and the second call returns
 * the first call's promise without touching the network. The next
 * request starts with an empty cache, so nothing is ever served stale
 * and no invalidation logic is required.
 *
 * This is deliberately NOT unstable_cache / `revalidate`. Those persist
 * results ACROSS requests, which would be wrong here: these reads are
 * per-user and RLS-filtered, so caching them beyond a single request
 * risks showing one brother another brother's data. Per-request
 * deduplication has no such failure mode — everything below still runs
 * under the caller's own session and RLS every time.
 */

/** The live-verified session user. Safe to call in every layout and page. */
export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

/** A lodge by URL slug. The single most duplicated query in the app. */
export const getTenantBySlug = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single()
  return data
})

/** One user's membership in one lodge, including the officer tier. */
export const getMembership = cache(async (tenantId: string, userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_members')
    .select('tenant_role, lodge_role, degree, is_active, communications_last_read_at, first_signin_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single()
  return data
})

/** Platform-level profile row — carries platform_role and display name. */
export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('platform_role, first_name, last_name, avatar_url')
    .eq('id', userId)
    .single()
  return data
})
