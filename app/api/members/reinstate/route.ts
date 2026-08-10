import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole } from '@/lib/auth/requireTenantAdmin'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * Puts a brother back on the rolls.
 *
 * The counterpart to /api/members/remove, and the reason removal became
 * a status change rather than a delete. A demit is not a deletion and a
 * suspension for non-payment is explicitly reversible — the man pays
 * what he owes and he is restored. Before this the only way back was to
 * invite him again as though he were a stranger, which minted a fresh
 * membership row and made the lodge's own record say he joined twice.
 *
 * His attendance, dues and degree history were never detached, so they
 * simply reappear with him.
 *
 * WHAT IS NOT RESTORED: his office. lodge_role was cleared when he came
 * off the roster, and it should stay cleared — the lodge filled the
 * station in his absence, and quietly reinstating him as Junior Warden
 * would put two men in one chair on the floor plan.
 */
export async function POST(request: Request) {
  try {
    const { tenantId, memberId, note } = await request.json()

    if (!tenantId || !memberId) {
      return NextResponse.json({ error: 'Missing tenantId or memberId.' }, { status: 400 })
    }

    const auth = await requireTenantRole(tenantId, ['admin', 'secretary', 'grand_master'])
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    const { data: target, error: targetError } = await supabase
      .from('tenant_members')
      .select('id, membership_status, is_active, profiles(first_name, last_name)')
      .eq('id', memberId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (targetError) throw targetError
    if (!target) {
      return NextResponse.json({ error: 'No such brother on this lodge roster.' }, { status: 404 })
    }

    if ((target as any).is_active) {
      return NextResponse.json(
        { error: 'That brother is already on the roster.' },
        { status: 400 }
      )
    }

    /**
     * Expulsion is not ours to undo.
     *
     * A demit and a suspension are the lodge's own business and it may
     * reverse either. An expulsion is a Grand Lodge action, and a
     * Secretary clicking a button in his roster is not the process by
     * which a man is restored to Masonry. Refused here rather than
     * quietly allowed, because allowing it would let the lodge's record
     * assert something the Grand Lodge's does not.
     */
    if ((target as any).membership_status === 'expelled') {
      return NextResponse.json(
        {
          error:
            'An expulsion is a Grand Lodge action and cannot be reversed from the roster. Restoration must come through your Grand Lodge; once it has, record it as a new affiliation.',
        },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('tenant_members')
      .update({
        is_active: true,
        membership_status: 'active',
        status_date: new Date().toISOString().slice(0, 10),
        status_note:
          typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null,
      })
      .eq('id', memberId)
      .eq('tenant_id', tenantId)

    if (updateError) throw updateError

    const p = (target as any).profiles
    const name = `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'That brother'

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: await actorName(auth.userId),
      action: 'member.reinstated',
      summary: `Reinstated ${name}, previously recorded as ${(target as any).membership_status}`,
      entityType: 'tenant_member',
      entityId: memberId,
      detail: { previousStatus: (target as any).membership_status },
    })

    return NextResponse.json({
      success: true,
      message: `${name} is back on the roster. His attendance, dues and degree history are as he left them. His office was not restored — set it on the roster if he is to take a station.`,
    })
  } catch (error: any) {
    console.error('Reinstate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
