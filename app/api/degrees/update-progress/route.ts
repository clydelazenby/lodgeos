import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { recordAudit, actorName } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    const { tenantId, memberId, degree, proficiencyPassed, notes } = await request.json()
    if (!memberId || !degree) {
      return NextResponse.json({ error: 'Missing memberId or degree' }, { status: 400 })
    }
    if (!['EA', 'FC', 'MM'].includes(degree)) {
      return NextResponse.json({ error: `Invalid degree: ${degree}` }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'meetings')
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
    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: await actorName(auth.userId),
      action: 'degree.progress',
      summary: `Recorded ${degree} proficiency for a candidate as ${proficiencyPassed ? 'passed' : 'not yet passed'}`,
      entityType: 'degree_progress',
      entityId: (updated as any)?.id ?? null,
      detail: { degree, memberId, proficiencyPassed, justPassed },
    })

    return NextResponse.json({ success: true, progress: updated })
  } catch (error: any) {
    console.error('Update degree progress error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
