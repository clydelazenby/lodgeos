import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPortalAccessRequestAlert, APP_URL } from '@/lib/email'

/**
 * An existing brother of a lodge asking his Secretary for a portal
 * login. Public and unauthenticated — that is the whole population
 * this serves: brothers who have no account yet.
 *
 * GRANTS NOTHING. It writes a row and sends the Secretary an email.
 * Nothing here creates an auth user, a profile, or a tenant_members
 * row, and nothing here may: the claims on this form ("I am a Past
 * Master of this lodge") are typed by an anonymous visitor and are not
 * verified by anybody. Only the Secretary, inviting him from the
 * Members page, creates access — and that path already checks his
 * authority to do so.
 */

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MAX_FIELD = 200
const MAX_MESSAGE = 2000
const DUPLICATE_WINDOW_HOURS = 24

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })

    const slug = String(body.slug ?? '').trim()
    const firstName = String(body.firstName ?? '').trim()
    const lastName = String(body.lastName ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()

    if (!slug) return NextResponse.json({ error: 'Missing lodge.' }, { status: 400 })
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'Your first name, last name and email address are all required.' },
        { status: 400 }
      )
    }
    if (!EMAIL_SHAPE.test(email)) {
      return NextResponse.json({ error: 'That does not look like a valid email address.' }, { status: 400 })
    }
    if (firstName.length > MAX_FIELD || lastName.length > MAX_FIELD || email.length > MAX_FIELD) {
      return NextResponse.json({ error: 'One of those fields is too long.' }, { status: 400 })
    }

    const trim = (value: unknown, max = MAX_FIELD) => {
      const text = String(value ?? '').trim()
      return text ? text.slice(0, max) : null
    }

    const supabase = createServiceClient()

    const { data: tenant } = await supabase
      .from('tenants').select('id, name, number, slug, email').eq('slug', slug).maybeSingle()
    if (!tenant) return NextResponse.json({ error: 'Lodge not found.' }, { status: 404 })

    const since = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3600_000).toISOString()
    const { data: recent } = await supabase
      .from('portal_access_requests')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('email', email)
      .gte('created_at', since)
      .limit(1)

    if (recent && recent.length > 0) {
      return NextResponse.json({ success: true, duplicate: true })
    }

    const { error: insertError } = await supabase.from('portal_access_requests').insert({
      tenant_id: tenant.id,
      first_name: firstName.slice(0, MAX_FIELD),
      last_name: lastName.slice(0, MAX_FIELD),
      email,
      phone: trim(body.phone, 40),
      years_a_member: trim(body.yearsAMember, 40),
      lodge_role: trim(body.lodgeRole),
      message: trim(body.message, MAX_MESSAGE),
    })

    if (insertError) throw insertError

    // Same resolution the petition route uses: prefer a real Secretary,
    // fall back to the lodge's general contact address, so a request is
    // never silently unreachable because no Secretary account exists.
    const { data: secretaryMembership } = await supabase
      .from('tenant_members')
      .select('profiles(first_name, email)')
      .eq('tenant_id', tenant.id)
      .eq('lodge_role', 'Secretary')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    const secretaryProfile = (secretaryMembership as any)?.profiles
    const notifyEmail = secretaryProfile?.email || tenant.email

    let notified = false
    if (notifyEmail) {
      try {
        await sendPortalAccessRequestAlert({
          to: notifyEmail,
          secretaryName: secretaryProfile?.first_name || 'Secretary',
          lodgeName: `${tenant.name} #${tenant.number}`,
          requesterName: `${firstName} ${lastName}`,
          requesterEmail: email,
          requesterPhone: trim(body.phone, 40),
          yearsAMember: trim(body.yearsAMember, 40),
          lodgeRole: trim(body.lodgeRole),
          message: trim(body.message, MAX_MESSAGE),
          membersUrl: `${APP_URL}/lodge/${tenant.slug}/members`,
        })
        notified = true
      } catch (mailErr: any) {
        // The row is saved and the Members page will show it, so the
        // request is not lost even when the mail is.
        console.error('Portal access request alert failed:', mailErr?.message)
      }
    } else {
      console.error(`Portal access request saved for ${slug} with nobody to notify.`)
    }

    return NextResponse.json({ success: true, notified })
  } catch (error: any) {
    console.error('Portal access request error:', error)
    return NextResponse.json(
      { error: 'That request could not be submitted. Please try again.' },
      { status: 500 }
    )
  }
}
