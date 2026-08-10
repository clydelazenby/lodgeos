'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Stamps the current officer's membership as having read notices up to
 * now, clearing the header envelope badge.
 *
 * Called from the Communications page once it has loaded. Deliberately
 * a server action rather than an API route: it takes no meaningful
 * input, and deriving the user from the session means a caller cannot
 * mark somebody ELSE's notices read by passing their id.
 */
export async function markNoticesRead(tenantId: string) {
  if (!tenantId) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Service client for the write: tenant_members is managed by
  // is_tenant_admin() under RLS, so a Deacon or Warden updating his own
  // read timestamp would otherwise be refused. The row is pinned to the
  // session's own user id, so this cannot touch anyone else's.
  const service = createServiceClient()
  await service
    .from('tenant_members')
    .update({ communications_last_read_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)

  // The badge is rendered by the lodge layout, which is a server
  // component — without this the count would keep showing until the
  // next full navigation.
  revalidatePath('/lodge', 'layout')
}
