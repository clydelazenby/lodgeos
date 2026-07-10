import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendNewPetitionAlert } from '@/lib/email'

/**
 * Public, unauthenticated petition submission. Deliberately no auth
 * check — a prospective member has no account yet by definition, so
 * requireTenantAdmin() doesn't apply (that guards actions taken BY a
 * lodge admin, not received FROM the public).
 *
 * Replaces a client-side raw insert that saved the row but never
 * notified anyone — sendNewPetitionAlert() already existed in
 * lib/email/index.ts and was completely unused before this route.
 *
 * Uses the service-role client since an anonymous visitor has no
 * authenticated Supabase session for RLS to key off.
 */
export async function POST(request: Request) {
  try {
    const { slug, ...form } = await request.json()
    if (!slug) return NextResponse.json({ error: 'Missing lodge slug' }, { status: 400 })

    const required = ['first_name', 'last_name', 'email', 'phone', 'age', 'occupation', 'believes_in_supreme_being', 'reason']
    for (const field of required) {
      if (form[field] === undefined || form[field] === '') {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const supabase = createServiceClient()

    const { data: tenant } = await supabase.from('tenants').select('id, name, number, email').eq('slug', slug).single()
    if (!tenant) return NextResponse.json({ error: 'Lodge not found' }, { status: 404 })

    const { data: petition, error: insertError } = await supabase
      .from('petitions')
      .insert({
        tenant_id: tenant.id,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        age: parseInt(form.age),
        occupation: form.occupation,
        believes_in_supreme_being: form.believes_in_supreme_being === 'yes' || form.believes_in_supreme_being === true,
        reason: form.reason,
        referred_by: form.referred_by || null,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Prefer the Secretary if one exists, otherwise the lodge's general
    // contact email, so a petition is never silently unreachable just
    // because no Secretary account has been set up yet.
    const { data: secretaryMembership } = await supabase
      .from('tenant_members')
      .select('user_id, profiles(first_name, last_name, email)')
      .eq('tenant_id', tenant.id)
      .eq('lodge_role', 'Secretary')
      .eq('is_active', true)
      .limit(1)
      .single()

    const secretaryProfile = (secretaryMembership as any)?.profiles
    const notifyEmail = secretaryProfile?.email || tenant.email
    const notifyName = secretaryProfile?.first_name || 'Secretary'

    let notified = false
    if (notifyEmail) {
      try {
        await sendNewPetitionAlert({
          to: notifyEmail,
          secretaryName: notifyName,
          lodgeName: `${tenant.name} #${tenant.number}`,
          petitionerName: `${form.first_name} ${form.last_name}`,
          petitionerEmail: form.email,
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lodgeos.com'}/lodge/${slug}/petitions`,
        })
        notified = true
      } catch (emailError) {
        // The petition is already saved at this point — a notification
        // failure shouldn't make the applicant think their submission
        // was lost. Log it and let the Secretary discover it on their
        // next dashboard visit instead of erroring out to the public form.
        console.error('Petition saved but notification email failed:', emailError)
      }
    }

    return NextResponse.json({ success: true, petition, notified })
  } catch (error: any) {
    console.error('Petition submission error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
