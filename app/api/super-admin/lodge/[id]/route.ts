import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin'

/**
 * SECURITY FIX: this route previously had NO authentication check
 * whatsoever — any unauthenticated request to this URL returned a
 * lodge's full record plus every member's name and email. Added the
 * same requireSuperAdmin() guard used by every other platform-level
 * route in this app. Also removed debug console.logs and stopped
 * returning the raw Supabase query result object in the 404 response
 * (it could leak internal query shape/error details to the caller).
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const id = String(params.id).replace(/"/g, '').trim()

  const supabase = createServiceClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: 'Lodge not found' }, { status: 404 })
  }

  const { data: members } = await supabase
    .from('tenant_members')
    .select('*, profiles(first_name, last_name, email)')
    .eq('tenant_id', id)
    .order('created_at')

  return NextResponse.json({
    tenant,
    members: members ?? [],
  })
}
