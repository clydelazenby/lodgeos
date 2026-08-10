import type { SupabaseClient } from '@supabase/supabase-js'
import type { LodgeBrand } from './layout'

/**
 * The columns the stationery needs, in one place.
 *
 * Every route that sends mail was already fetching the tenant row for
 * its name and number; this is the same read widened to the branding
 * columns, so nobody has to remember which six fields the footer wants.
 */
export const LODGE_BRAND_COLUMNS =
  'name, number, slug, logo_url, tagline, motto, email, phone, website'

/** Shapes a tenants row into what the templates take. */
export function toLodgeBrand(tenant: any): LodgeBrand {
  return {
    name: tenant?.name ?? 'Your Lodge',
    number: tenant?.number ?? null,
    logoUrl: tenant?.logo_url ?? null,
    tagline: tenant?.tagline ?? null,
    motto: tenant?.motto ?? null,
    email: tenant?.email ?? null,
    phone: tenant?.phone ?? null,
    website: tenant?.website ?? null,
  }
}

/**
 * Fetches a lodge's branding. Returns a usable brand even when the read
 * fails — an email that goes out with a plain header beats one that
 * does not go out because the logo could not be looked up.
 */
export async function getLodgeBrand(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LodgeBrand> {
  const { data } = await supabase
    .from('tenants')
    .select(LODGE_BRAND_COLUMNS)
    .eq('id', tenantId)
    .maybeSingle()

  return toLodgeBrand(data)
}
