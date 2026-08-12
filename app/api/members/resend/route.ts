import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail, APP_URL } from '@/lib/email'
import { requireCapability } from '@/lib/auth/capabilities'
import { createInviteLink } from '@/lib/auth/inviteLink'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'
import { recordAudit, actorName } from '@/lib/audit'

export const maxDuration = 30

/**
 * Send a brother's invitation again.
 *
 * WHY THIS EXISTS. The officers' alert already tells them to resend an
 * invitation that produced no sign-in — and until now the only way to
 * do it was to remove the man and invite him afresh, which destroys the
 * roster row, its degree, its office and its audit history to
 * accomplish the sending of an email.
 *
 * A FRESH LINK, NOT THE OLD ONE. Supabase's invitation links expire,
 * and the failure this route is for is usually a man who found the
 * email three weeks later. Re-minting is also what makes this safe to
 * press twice: nothing is consumed by sending, and the newest link is
 * the one that works.
 *
 * ONLY FOR MEN WHO HAVE NEVER SIGNED IN. Once first_signin_at is set
 * the account exists and works; "resending the invitation" to a brother
 * who has a password is not a kindness, it is a confusing email about
 * an account he already has. He wants a password reset, which is on the
 * sign-in page and is his to ask for.
 *
 * THE OFFICERS ARE NOT EMAILED AGAIN. member.invited announces a
 * brother joining the roster, which happened once and is not happening
 * now. An alert per press would train the very officers who most need
 * to read those alerts to ignore them. The act is in the audit trail,
 * and the page shows when it was last sent.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })

    const { tenantId, memberId } = body
    if (!tenantId || !memberId) {
      return NextResponse.json({ error: 'Missing tenantId or memberId.' }, { status: 400 })
    }

    // The same tier that may invite may resend. It is the same act.
    const auth = await requireCapability(tenantId, 'roster', [
      'secretary', 'grand_master', 'worshipful_master', 'admin',
    ])
    if (!auth.ok) return auth.response

    const service = createServiceClient()

    const { data: member } = await service
      .from('tenant_members')
      .select('id, tenant_id, user_id, is_active, first_signin_at, profiles(first_name, last_name, email)')
      .eq('id', memberId)
      // Scoped to the lodge the caller was authorised against, so a
      // member id from another lodge cannot be used to mint a sign-in
      // link for one of their brothers.
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'That brother is not on this lodge’s roster.' }, { status: 404 })
    }

    const profile = (member as any).profiles
    const email = (profile?.email ?? '').trim().toLowerCase()
    const firstName = profile?.first_name ?? ''
    const lastName = profile?.last_name ?? ''
    const name = `${firstName} ${lastName}`.trim() || email

    if (!(member as any).is_active) {
      return NextResponse.json(
        { error: `${name} is not on the roster. Reinstate him first.` },
        { status: 400 }
      )
    }

    if ((member as any).first_signin_at) {
      return NextResponse.json(
        {
          error: `${name} has already signed in, so there is nothing to resend. If he cannot get back in, he should use “forgot password” on the sign-in page.`,
        },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: `There is no email address on file for ${name}, so there is nowhere to send it.` },
        { status: 400 }
      )
    }

    const { data: tenant } = await service
      .from('tenants').select(`id, ${LODGE_BRAND_COLUMNS}`).eq('id', tenantId).maybeSingle()

    if (!tenant) {
      return NextResponse.json({ error: 'The lodge record could not be read.' }, { status: 500 })
    }

    const invite = await createInviteLink(service, {
      email, firstName, lastName, appUrl: APP_URL,
    })

    await sendWelcomeEmail({
      to: email,
      firstName: firstName || 'Brother',
      lodgeName: `${(tenant as any).name} #${(tenant as any).number}`,
      lodgeSlug: (tenant as any).slug,
      loginUrl: `${APP_URL}/auth/login`,
      actionUrl: invite.actionUrl,
      brand: toLodgeBrand(tenant),
    })

    /**
     * Stamped only after the send succeeded. A throw above leaves the
     * column alone, so the page keeps showing the last time an email
     * genuinely went out rather than the last time somebody tried.
     */
    const sentAt = new Date().toISOString()
    await service
      .from('tenant_members')
      .update({ invite_last_sent_at: sentAt })
      .eq('id', memberId)

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: await actorName(auth.userId),
      action: 'member.invite_resent',
      summary: `Sent ${name}'s invitation again, to ${email}`,
      entityType: 'tenant_member',
      entityId: memberId,
      detail: { email, method: invite.method },
    })

    return NextResponse.json({
      success: true,
      sentAt,
      email,
      message: `Invitation sent again to ${email}.`,
      warning: invite.warning ?? null,
    })
  } catch (error: any) {
    console.error('Resend invitation error:', error)
    return NextResponse.json(
      { error: error?.message || 'The invitation could not be sent again.' },
      { status: 500 }
    )
  }
}
