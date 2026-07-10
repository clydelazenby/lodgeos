import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'

export async function POST(request: Request) {
  try {
    const { tenantId, memberId, degree, proficiencyPassed, notes } = await request.json()
    if (!memberId || !degree) {
      return NextResponse.json({ error: 'Missing memberId or degree' }, { status: 400 })
    }
    if (!['EA', 'FC', 'MM'].includes(degree)) {
      return NextResponse.json({ error: `Invalid degree: ${degree}` }, { status: 400 })
    }

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('degree_progress')
      .select('proficiency_passed')
      .eq('tenant_id', tenantId)
      .eq('member_id', memberId)
      .eq('degree', degree)
      .single()

    const justPassed = proficiencyPassed && !existing?.proficiency_passed

    const { data: updated, error } = await supabase
      .from('degree_progress')
      .upsert(
        {
          tenant_id: tenantId,
          member_id: memberId,
          degree,
          proficiency_passed: proficiencyPassed,
          ...(justPassed ? { proficiency_date: new Date().toISOString().slice(0, 10) } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
        { onConflict: 'tenant_id,member_id,degree' }
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, progress: updated })
  } catch (error: any) {
    console.error('Update degree progress error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
