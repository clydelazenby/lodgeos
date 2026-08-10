import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail, APP_URL } from '@/lib/email'
import { requireTenantRole, TenantRole } from '@/lib/auth/requireTenantAdmin'
import { createInviteLink } from '@/lib/auth/inviteLink'
import { upsertProfilePreservingIdentity } from '@/lib/auth/profile'

const ADMIN_TIER_ROLES = new Set<TenantRole>(['admin', 'secretary', 'grand_master'])

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Two Supabase Admin calls, a couple of table writes and one Resend
 * send. Comfortably under this in practice — the ceiling exists so a
 * slow dependency surfaces as a JSON error the Members page can render,
 * rather than a platform timeout whose HTML body the page cannot parse.
 */
export const maxDuration = 30

/**
 * Invite a brother to the lodge.
 *
 * ORDERING MATTERS HERE — read before rearranging.
 *
 * This route used to await `inviteUserByEmail()` first, which asked
 * Supabase to send the invitation over its own mailer (see
 * lib/auth/inviteLink.ts for why that never arrived). Because it came
 * first and its failure threw, one unreachable SMTP host meant the
 * brother was never added to the roster AND the lodge's own welcome
 * email was never attempted.
 *
 * Now the roster write is what the route is really for, and it is
 * committed before any mail is sent. Mail is best-effort and reported
 * honestly: the response says whether the email went out, so the
 * Secretary is never told "invitation sent" when it wasn't.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
    }

    const { tenantId, email, firstName, lastName, degree, lodgeRole, tenantRole } = body

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!cleanEmail || !EMAIL_SHAPE.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'A valid email address is required to create portal access.' },
        { status: 400 }
      )
    }

    // Inviting new members/officers is a Secretary-level administrative
    // action, not something every officer tier should do.
    const auth = await requireTenantRole(tenantId, ['secretary', 'grand_master', 'worshipful_master', 'admin'])
    if (!auth.ok) return auth.response

    // A Worshipful Master calling this route could otherwise assign the
    // invitee a 'secretary' or 'admin' tenantRole in the request body,
    // handing out full administrative access despite not holding that
    // access themselves. Only an existing admin/secretary can grant
    // admin-tier roles to someone else.
    if (tenantRole && ADMIN_TIER_ROLES.has(tenantRole) && !ADMIN_TIER_ROLES.has(auth.tenantRole)) {
      return NextResponse.json({ error: `Only a Secretary, Grand Master or admin can assign the '${tenantRole}' role` }, { status: 403 })
    }

    const serviceClient = createServiceClient()

    // Creates the auth user and mints a sign-in link. Sends nothing —
    // the lodge's own welcome email below is the only message this
    // brother receives, and it goes through Resend's verified domain.
    const invite = await createInviteLink(serviceClient, {
      email: cleanEmail,
      firstName,
      lastName,
      appUrl: APP_URL,
    })

    // A brother who already had an auth account may come back without a
    // user payload; his profile row still tells us who he is.
    let profileId = invite.userId
    if (!profileId) {
      const { data: existingProfile } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle()
      profileId = existingProfile?.id ?? null
    }

    if (!profileId) {
      return NextResponse.json(
        { error: 'Could not create an account for that email address. Nothing was changed.' },
        { status: 502 }
      )
    }

    // The profiles row is normally created by a signup trigger; this
    // works whether or not that has fired yet, and lets the names the
    // Secretary typed fill BLANKS ONLY — a brother already known to
    // another lodge must not be renamed there by this invitation.
    await upsertProfilePreservingIdentity(serviceClient, {
      id: profileId,
      email: cleanEmail,
      firstName,
      lastName,
    })

    const { error: memberError } = await serviceClient.from('tenant_members').upsert({
      tenant_id: tenantId,
      user_id: profileId,
      degree: degree || 'EA',
      lodge_role: lodgeRole,
      tenant_role: tenantRole || 'member',
      dues_status: 'due',
      is_active: true,
    }, { onConflict: 'tenant_id,user_id' })

    if (memberError) throw memberError

    // ---- Mail: best effort, reported honestly -------------------
    //
    // The brother is on the roster from here on. A mail failure is
    // worth telling the Secretary about, but it is not a reason to
    // return an error for work that already succeeded — that would
    // have him invite the same brother again and again.

    const { data: tenant } = await serviceClient
      .from('tenants').select('name, number, slug').eq('id', tenantId).maybeSingle()

    let emailed = false
    let warning = invite.warning

    if (!tenant) {
      warning = 'The brother was added, but the lodge record could not be read, so no welcome email was sent.'
    } else {
      try {
        await sendWelcomeEmail({
          to: cleanEmail,
          firstName: firstName || 'Brother',
          lodgeName: `${tenant.name} #${tenant.number}`,
          lodgeSlug: tenant.slug,
          loginUrl: `${APP_URL}/auth/login`,
          actionUrl: invite.actionUrl,
        })
        emailed = true
      } catch (mailErr: any) {
        warning = `${firstName || 'The brother'} was added to the roster, but the welcome email could not be sent: ${mailErr?.message || 'unknown mail error'}`
      }
    }

    return NextResponse.json({
      success: true,
      emailed,
      // 'magiclink' means he already had an account and was sent a
      // sign-in link rather than a fresh invitation.
      method: invite.method,
      warning,
    })
  } catch (error: any) {
    console.error('Invite member error:', error)
    return NextResponse.json(
      { error: error?.message || 'The invitation could not be completed.' },
      { status: 500 }
    )
  }
}
