import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { sendMembershipRemovedEmail, sendBrotherRemovedAlert, APP_URL } from '@/lib/email'
import { recipientsFor, notifyEach } from '@/lib/notifications.server'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'
import { REMOVAL_STATUSES, statusLabel } from '@/lib/membership'
import { recordAudit, actorName } from '@/lib/audit'

// The tiers that count as the lodge's administrative office. Kept as
// one set so the last-officer guard below cannot drift from the list
// of who holds administrative access — if grand_master counted as
// admin-tier everywhere except in the count, a lodge could be left
// with no administrative officer at all.
const ADMIN_TIER_ROLES = new Set(['admin', 'secretary', 'grand_master'])

/**
 * Takes a brother off a lodge roster, and records why.
 *
 * THIS NO LONGER DELETES THE MEMBERSHIP ROW.
 *
 * It used to, and the reasoning above it was half right: attendance,
 * payments and degree history key off profiles.id rather than the
 * membership row, so they survived the delete — which they must.
 * Attendance figures for a past year should not silently change
 * because someone came off the roster today.
 *
 * But the membership itself did not survive, and that was the one fact
 * a Grand Lodge annual return actually asks for: this man was a member,
 * on this date he ceased to be, and this is the reason. Deleting the row
 * threw all three away and left the return to be reconstructed from
 * memory once a year.
 *
 * So the row stays. `is_active` goes false — every existing query and
 * every RLS policy still keys off it, so nothing about access changes —
 * and `membership_status` records which of the four Masonically distinct
 * things happened: a demit, a suspension, an expulsion, a death. Plus
 * 'removed' for a duplicate row or a typo, which is none of them and
 * must not be reported as though it were.
 *
 * A brother who returns is reinstated rather than re-invited, and his
 * history was never detached in the first place.
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
    const {
      tenantId,
      memberId,
      notify = true,
      note,
      status = 'removed',
      statusDate,
      statusNote,
    } = await request.json()

    if (!tenantId || !memberId) {
      return NextResponse.json(
        { error: 'Missing tenantId or memberId.' },
        { status: 400 }
      )
    }

    // Validated against the shared vocabulary, not trusted from the
    // body — the column has a check constraint and a bad value would
    // otherwise surface as an opaque database error at the write.
    if (!REMOVAL_STATUSES.some((s) => s.value === status)) {
      return NextResponse.json(
        { error: `"${status}" is not a reason a brother can be taken off the roster.` },
        { status: 400 }
      )
    }

    const auth = await requireCapability(tenantId, 'roster')
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    // memberId is the tenant_members row id, not the user id — the
    // roster table keys its rows that way. Read it back scoped to this
    // tenant so a valid id from ANOTHER lodge can't be removed by
    // someone who happens to be an officer here.
    const { data: target, error: targetError } = await supabase
      .from('tenant_members')
      .select('id, user_id, tenant_role, profiles(first_name, last_name, email)')
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
    if (ADMIN_TIER_ROLES.has(target.tenant_role)) {
      const { count, error: countError } = await supabase
        .from('tenant_members')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('tenant_role', Array.from(ADMIN_TIER_ROLES))

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

    /**
     * The date the thing happened, not the date it was typed in.
     *
     * A Secretary recording a death three weeks after the funeral needs
     * the date of the death — that is the date the annual return asks
     * for, and defaulting to now() would put the wrong year on it for
     * anything that happened either side of the turn of the year.
     */
    const effectiveDate =
      typeof statusDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(statusDate)
        ? statusDate
        : new Date().toISOString().slice(0, 10)

    const { error: updateError } = await supabase
      .from('tenant_members')
      .update({
        is_active: false,
        membership_status: status,
        status_date: effectiveDate,
        status_note:
          typeof statusNote === 'string' && statusNote.trim()
            ? statusNote.trim().slice(0, 500)
            : null,
        // The office goes with the membership. Leaving a demitted
        // brother listed as Junior Warden would keep him on the Lodge
        // Room floor plan and in the coverage report.
        lodge_role: null,
      })
      .eq('id', memberId)
      .eq('tenant_id', tenantId)

    if (updateError) throw updateError

    const p = (target as any).profiles
    const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : 'That brother'

    /**
     * Telling him.
     *
     * Sent by default, and skippable — `notify: false`. A brother
     * removed after a demit should hear it from the lodge rather than
     * discover it at a locked door; a brother removed because he has
     * DIED should not have an automated message land in the inbox his
     * widow is reading, and a duplicate roster row created by mistake
     * has nobody to notify at all. The Secretary knows which of those
     * he is doing and the database does not, so the choice is his.
     *
     * Best effort: the removal has already happened and is correct. A
     * mail failure is reported alongside the success, never instead of
     * it — otherwise an officer retries a removal that already worked.
     */
    let emailed = false
    let emailError: string | undefined

    if (notify && p?.email) {
      try {
        const { data: tenant } = await supabase
          .from('tenants').select(LODGE_BRAND_COLUMNS).eq('id', tenantId).maybeSingle()

        await sendMembershipRemovedEmail({
          to: p.email,
          firstName: p.first_name || 'Brother',
          lodgeName: tenant ? `${(tenant as any).name} #${(tenant as any).number}` : 'your lodge',
          note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null,
          brand: tenant ? toLodgeBrand(tenant) : undefined,
        })
        emailed = true
      } catch (mailErr: any) {
        emailError = mailErr?.message || 'unknown mail error'
        console.error('Removal notice failed:', emailError)
      }
    }

    const mailNote = !notify
      ? ' No email was sent.'
      : !p?.email
        ? ' No email address on file, so he was not notified.'
        : emailed
          ? ' He has been notified by email.'
          : ` He could NOT be notified by email: ${emailError}`

    const removedByName = await actorName(auth.userId)

    /**
     * Tell the officers.
     *
     * Read fresh rather than reusing the brand row above, which is only
     * fetched when `notify` is on — an officer who removed a brother
     * quietly still needs his fellow officers to know it happened.
     *
     * The removed brother is excluded: he receives the message written
     * for him, not the one written about him.
     */
    const { data: lodge } = await supabase
      .from('tenants').select(`slug, ${LODGE_BRAND_COLUMNS}`).eq('id', tenantId).maybeSingle()

    if (lodge) {
      const recipients = await recipientsFor(tenantId, 'member.removed', memberId)
      await notifyEach(recipients, (officer) =>
        sendBrotherRemovedAlert({
          to: officer.email,
          officerName: officer.name,
          lodgeName: `${(lodge as any).name} #${(lodge as any).number}`,
          brotherName: name,
          statusLabel: statusLabel(status),
          statusDate: effectiveDate,
          note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null,
          removedBy: removedByName,
          membersUrl: `${APP_URL}/lodge/${(lodge as any).slug}/members`,
          brand: toLodgeBrand(lodge),
        })
      )
    }

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: removedByName,
      action: 'member.removed',
      summary: `Took ${name} off the roster as ${statusLabel(status).toLowerCase()}, effective ${effectiveDate}`,
      entityType: 'tenant_member',
      entityId: memberId,
      detail: { status, effectiveDate, notified: emailed },
    })

    return NextResponse.json({
      success: true,
      removed: name,
      status,
      emailed,
      message: `${name} was taken off the roster as ${statusLabel(status).toLowerCase()}, effective ${effectiveDate}. Attendance, dues, and degree history were kept.${mailNote}`,
    })
  } catch (error: any) {
    console.error('Member removal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
