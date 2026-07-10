import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'
import { requireTenantRole, TenantRole } from '@/lib/auth/requireTenantAdmin'

const ADMIN_TIER_ROLES = new Set<TenantRole>(['admin', 'secretary'])

export async function POST(request: Request) {
  try {
    const { tenantId, email, firstName, lastName, degree, lodgeRole, tenantRole } = await request.json()

    // Inviting new members/officers is a Secretary-level administrative
    // action, not something every officer tier should do.
    const auth = await requireTenantRole(tenantId, ['secretary', 'worshipful_master', 'admin'])
    if (!auth.ok) return auth.response

    // A Worshipful Master calling this route could otherwise assign the
    // invitee a 'secretary' or 'admin' tenantRole in the request body,
    // handing out full administrative access despite not holding that
    // access themselves. Only an existing admin/secretary can grant
    // admin-tier roles to someone else.
    if (tenantRole && ADMIN_TIER_ROLES.has(tenantRole) && !ADMIN_TIER_ROLES.has(auth.tenantRole)) {
      return NextResponse.json({ error: `Only a Secretary or admin can assign the '${tenantRole}' role` }, { status: 403 })
    }

    const supabase = await createClient()
    const serviceClient = createServiceClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Invite user via Supabase Auth
    const { data: inviteData, error: inviteErr } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: { first_name: firstName, last_name: lastName },
      redirectTo: `${appUrl}/auth/callback`,
    })

    if (inviteErr && !inviteErr.message.includes('already registered')) {
      throw inviteErr
    }

    // Get or create profile
    let profileId = inviteData?.user?.id
    if (!profileId) {
      const { data: existingProfile } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()
      profileId = existingProfile?.id
    }

    if (profileId) {
      // Add to tenant
      await serviceClient.from('tenant_members').upsert({
        tenant_id: tenantId,
        user_id: profileId,
        degree: degree || 'EA',
        lodge_role: lodgeRole,
        tenant_role: tenantRole || 'member',
        dues_status: 'due',
        is_active: true,
      }, { onConflict: 'tenant_id,user_id' })
    }

    // Get lodge info for email
    const { data: tenant } = await supabase.from('tenants').select('name, number, slug').eq('id', tenantId).single()

    if (tenant) {
      await sendWelcomeEmail({
        to: email,
        firstName: firstName || 'Brother',
        lodgeName: `${tenant.name} #${tenant.number}`,
        lodgeSlug: tenant.slug,
        loginUrl: `${appUrl}/auth/login`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Invite member error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
