import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'

export async function POST(request: Request) {
  try {
    const { tenantId, memberId, notes } = await request.json()
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 })

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { data: updated, error } = await supabase
      .from('tenant_members')
      .update({ notes })
      .eq('tenant_id', tenantId)
      .eq('user_id', memberId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, membership: updated })
  } catch (error: any) {
    console.error('Save member notes error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
