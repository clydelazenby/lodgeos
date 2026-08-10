import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPlatformAccessRequestAlert } from '@/lib/email'

/**
 * A lodge asking to use LodgeOS. Public and unauthenticated by
 * definition — the requester has no account, and creating one is
 * exactly what they are asking permission to do.
 *
 * This route is what replaced self-serve signup from /start. It
 * deliberately creates NOTHING: no tenant, no auth user, no trial.
 * All it does is record the ask and tell the platform owner, who
 * decides whether to onboard them. That is the whole point of the
 * change — an unvetted stranger can no longer stand up a lodge.
 */

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Anything longer is a paste, a mistake, or an attempt to fill the table. */
const MAX_FIELD = 200
const MAX_MESSAGE = 2000

/**
 * A second request from the same address inside this window is treated
 * as the same ask. Someone who double-taps Submit, or who follows up
 * the next morning because they heard nothing, should not generate a
 * pile of duplicate rows and a pile of duplicate email.
 */
const DUPLICATE_WINDOW_HOURS = 24

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })

    const lodgeName = String(body.lodgeName ?? '').trim()
    const contactName = String(body.contactName ?? '').trim()
    const contactEmail = String(body.contactEmail ?? '').trim().toLowerCase()

    if (!lodgeName || !contactName || !contactEmail) {
      return NextResponse.json(
        { error: 'Lodge name, your name and an email address are all required.' },
        { status: 400 }
      )
    }
    if (!EMAIL_SHAPE.test(contactEmail)) {
      return NextResponse.json({ error: 'That does not look like a valid email address.' }, { status: 400 })
    }
    if (lodgeName.length > MAX_FIELD || contactName.length > MAX_FIELD || contactEmail.length > MAX_FIELD) {
      return NextResponse.json({ error: 'One of those fields is too long.' }, { status: 400 })
    }

    const trim = (value: unknown, max = MAX_FIELD) => {
      const text = String(value ?? '').trim()
      return text ? text.slice(0, max) : null
    }

    // "About 40" and "40 or so" are perfectly reasonable answers to a
    // roster-size question; take the number if there is one and drop it
    // otherwise rather than rejecting the whole request over it.
    const parsedCount = parseInt(String(body.memberCount ?? ''), 10)
    const memberCount = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : null

    const supabase = createServiceClient()

    const since = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3600_000).toISOString()
    const { data: recent } = await supabase
      .from('platform_access_requests')
      .select('id')
      .eq('contact_email', contactEmail)
      .gte('created_at', since)
      .limit(1)

    if (recent && recent.length > 0) {
      // Reported as success: from the requester's side the ask HAS been
      // received, and telling them "duplicate" invites them to submit
      // again through a different address.
      return NextResponse.json({ success: true, duplicate: true })
    }

    const { error: insertError } = await supabase.from('platform_access_requests').insert({
      lodge_name: lodgeName.slice(0, MAX_FIELD),
      lodge_number: trim(body.lodgeNumber, 40),
      jurisdiction: trim(body.jurisdiction),
      contact_name: contactName.slice(0, MAX_FIELD),
      contact_email: contactEmail,
      contact_phone: trim(body.contactPhone, 40),
      contact_role: trim(body.contactRole),
      member_count: memberCount,
      message: trim(body.message, MAX_MESSAGE),
    })

    if (insertError) throw insertError

    // Who to tell. The env var wins so this can be pointed at a shared
    // inbox; otherwise fall back to the platform owner's own account,
    // which is a real row in the database rather than a hardcoded
    // address that rots the moment it changes.
    let notifyEmail = process.env.PLATFORM_ADMIN_EMAIL || null
    if (!notifyEmail) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('email')
        .eq('platform_role', 'super_admin')
        .not('email', 'is', null)
        .limit(1)
        .maybeSingle()
      notifyEmail = owner?.email ?? null
    }

    let notified = false
    if (notifyEmail) {
      try {
        await sendPlatformAccessRequestAlert({
          to: notifyEmail,
          lodgeName,
          lodgeNumber: trim(body.lodgeNumber, 40),
          jurisdiction: trim(body.jurisdiction),
          contactName,
          contactEmail,
          contactPhone: trim(body.contactPhone, 40),
          contactRole: trim(body.contactRole),
          memberCount,
          message: trim(body.message, MAX_MESSAGE),
        })
        notified = true
      } catch (mailErr: any) {
        // The request IS saved. Losing the notification is worth a log
        // line, never an error to the lodge that just submitted it —
        // they did nothing wrong and cannot fix it.
        console.error('Platform access request alert failed:', mailErr?.message)
      }
    } else {
      console.error('Platform access request saved with nobody to notify: no PLATFORM_ADMIN_EMAIL and no super_admin profile.')
    }

    return NextResponse.json({ success: true, notified })
  } catch (error: any) {
    console.error('Platform access request error:', error)
    return NextResponse.json(
      { error: 'That request could not be submitted. Please try again.' },
      { status: 500 }
    )
  }
}
