import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole } from '@/lib/auth/requireTenantAdmin'

/**
 * Removes a brother from a lodge roster.
 *
 * WHAT THIS DELETES, AND WHAT IT DELIBERATELY DOES NOT
 *
 * This deletes the `tenant_members` row — the brother's membership in
 * THIS lodge. It does not delete their `profiles` row or their auth
 * user, and it does not touch `attendance`, `payments`, or
 * `degree_progress`.
 *
 * That is the correct shape for a lodge, not a shortcut. Those history
 * tables key off profiles.id and tenant_id rather than the membership
 * row, so the records survive removal — which they must. Attendance
 * figures for a past year should not silently change because someone
 * was removed from the roster today, and a payment that was genuinely
 * received is part of the lodge's financial record regardless of who
 * is currently on the rolls. A secretary removing a demitted brother
 * is not asking to rewrite five years of minutes.
 *
 * A brother who leaves and later returns can simply be invited again;
 * their history reattaches, because it was never detached.
 *
 * If a lodge genuinely needs the destructive version — a mistaken
 * duplicate entry, or a legal erasure request — that is a deliberate
 * database operation, not a button in a roster table.
 *
 * GUARDS
 *
 * - secretary/admin only. Roster custody is the secretary's office;
 *   this is not something a Deacon or Warden should reach.
 * - Cannot remove yourself. Prevents an admin locking themselves out of
 *   a lodge they administer with one misclick.
 * - Cannot remove the last remaining admin/secretary. Prevents a lodge
 *   ending up with no one able to administer it, which would require
 *   super-admin intervention to undo.
 */
export async function POST(request: Request) {
  try {
    const { tenantId, memberId } = await request.json()

    if (!tenantId || !memberId) {
      return NextResponse.json(
        { error: 'Missing tenantId or memberId.' },
        { status: 400 }
      )
    }

    const auth = await requireTenantRole(tenantId, ['admin', 'secretary'])
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    // memberId is the tenant_members row id, not the user id — the
    // roster table keys its rows that way. Read it back scoped to this
    // tenant so a valid id from ANOTHER lodge can't be removed by
    // someone who happens to be an officer here.
    const { data: target, error: targetError } = await supabase
      .from('tenant_members')
      .select('id, user_id, tenant_role, profiles(first_name, last_name)')
      .eq('id', memberId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (targetError) throw targetError

    if (!target) {
      return NextResponse.json(
        { error: 'That brother is not on this lodge roster.' },
        { status: 404 }
      )
    }

    if (target.user_id === auth.userId) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the roster. Ask another admin to do it.' },
        { status: 400 }
      )
    }

    // Last-officer check. Only meaningful if the person being removed
    // actually holds one of the administrative tiers.
    if (target.tenant_role === 'admin' || target.tenant_role === 'secretary') {
      const { count, error: countError } = await supabase
        .from('tenant_members')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('tenant_role', ['admin', 'secretary'])

      if (countError) throw countError

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          {
            error:
              'This is the last admin or secretary on the roster. Promote another brother before removing this one, or the lodge would be left with no one able to administer it.',
          },
          { status: 400 }
        )
      }
    }

    const { error: deleteError } = await supabase
      .from('tenant_members')
      .delete()
      .eq('id', memberId)
      .eq('tenant_id', tenantId)

    if (deleteError) throw deleteError

    const p = (target as any).profiles
    const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : 'That brother'

    return NextResponse.json({
      success: true,
      removed: name,
      message: `${name} was removed from the roster. Attendance, dues, and degree history were kept.`,
    })
  } catch (error: any) {
    console.error('Member removal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
