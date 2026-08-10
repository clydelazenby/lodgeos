import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole } from '@/lib/auth/requireTenantAdmin'
import { revalidatePath } from 'next/cache'

/**
 * Sets the lodge's annual dues rate.
 *
 * The rate already existed on `tenants.dues_amount` but could only be
 * changed from the Settings page, buried among branding and contact
 * fields — an odd place for the one number the Dues page is entirely
 * built around. This lets the treasurer set it where he is already
 * looking at it.
 *
 * IT DOES NOT REPRICE WHAT IS ALREADY PAID.
 * The Dues page computes each brother's amount from the CURRENT rate,
 * so raising it mid-year changes what outstanding brothers appear to
 * owe. That is the intended behaviour for an annual rate change, but it
 * is worth knowing: brothers already marked paid keep their `payments`
 * rows at the amount actually received, so the payment history stays
 * truthful even when the rate moves.
 */

const MAX_RATE = 5000

export async function POST(request: Request) {
  try {
    const { tenantId, duesAmount } = await request.json()

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId.' }, { status: 400 })
    }

    const value = Number(duesAmount)
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'Enter a dues amount of zero or more.' }, { status: 400 })
    }
    if (value > MAX_RATE) {
      return NextResponse.json(
        { error: `$${value.toLocaleString()} looks like a typo. The maximum is $${MAX_RATE.toLocaleString()}.` },
        { status: 400 }
      )
    }

    const auth = await requireTenantRole(tenantId, [
      'admin', 'secretary', 'treasurer', 'worshipful_master',
    ])
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    const { data: tenant, error } = await supabase
      .from('tenants')
      .update({ dues_amount: Math.round(value * 100) / 100 })
      .eq('id', tenantId)
      .select('slug, dues_amount')
      .single()

    if (error) throw error

    // The public lodge page is statically regenerated and may show dues
    // information, so purge it rather than leaving a stale figure up for
    // an hour.
    if (tenant?.slug) revalidatePath(`/${tenant.slug}`)

    return NextResponse.json({ success: true, duesAmount: tenant.dues_amount })
  } catch (error: any) {
    console.error('Update dues rate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
