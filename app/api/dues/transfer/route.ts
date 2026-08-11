import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { sendPaymentReceiptEmail } from '@/lib/email'

/**
 * Dues paid by transfer — Zelle, Cash App or Venmo.
 *
 * TWO PARTIES, DELIBERATELY.
 *
 * POST: the brother states he has sent the money. This writes a PENDING
 * payment and changes nothing about his standing. He cannot mark his
 * own dues paid, which is the whole reason this is not a single button.
 *
 * PATCH: an officer confirms the money arrived. Only this marks him
 * paid, records who confirmed it, and sends the receipt — the same
 * three effects Stripe's webhook produces for a card payment, with a
 * human standing in for the webhook because Zelle has none.
 */

const METHODS = new Set(['zelle', 'cashapp', 'venmo', 'cash', 'check', 'other'])
const FINANCE_TIERS = ['admin', 'secretary', 'grand_master', 'treasurer', 'worshipful_master'] as const

/** Brother: "I've sent my dues." */
export async function POST(request: Request) {
  try {
    const { tenantId, method, amount, year, referenceNote } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!tenantId || !METHODS.has(method)) {
      return NextResponse.json({ error: 'Choose how you sent the payment.' }, { status: 400 })
    }

    const service = createServiceClient()

    // He must be on this lodge's roster. The amount comes from the
    // TENANT, never from the request — otherwise a brother could report
    // paying $1 and have an officer confirm it without noticing.
    const { data: membership } = await service
      .from('tenant_members')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'You are not on this lodge roster.' }, { status: 403 })
    }

    const { data: tenant } = await service
      .from('tenants')
      .select('dues_amount')
      .eq('id', tenantId)
      .single()

    const duesYear = Number(year) || new Date().getFullYear()
    const value = Number(tenant?.dues_amount ?? amount ?? 0)

    // One open report per brother per year. Without this, tapping the
    // button twice would put two identical $60 rows in the Treasurer's
    // queue and he would have no way to tell a double-send from a
    // double-tap.
    const { data: existing } = await service
      .from('payments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('member_id', user.id)
      .eq('dues_year', duesYear)
      .eq('status', 'pending')
      .not('payment_method', 'is', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'You have already reported a payment for this year — the Treasurer is reviewing it.' },
        { status: 409 }
      )
    }

    const { data: payment, error } = await service
      .from('payments')
      .insert({
        tenant_id: tenantId,
        member_id: user.id,
        amount: value,
        status: 'pending',
        payment_method: method,
        dues_year: duesYear,
        reported_at: new Date().toISOString(),
        reference_note: referenceNote?.trim() || null,
        description: `Annual dues ${duesYear} — reported via ${method}`,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      payment,
      message: 'Thank you — the Treasurer will confirm once it lands.',
    })
  } catch (error: any) {
    console.error('Report dues transfer error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Officer: "That money arrived." (or: it never did) */
export async function PATCH(request: Request) {
  try {
    const { tenantId, paymentId, action } = await request.json()

    if (!tenantId || !paymentId) {
      return NextResponse.json({ error: 'Missing tenantId or paymentId.' }, { status: 400 })
    }
    if (action !== 'confirm' && action !== 'reject') {
      return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'finance')
    if (!auth.ok) return auth.response

    const service = createServiceClient()

    // Scoped to the tenant so a payment id from another lodge cannot be
    // confirmed by an officer of this one.
    const { data: payment } = await service
      .from('payments')
      .select('id, member_id, amount, dues_year, status')
      .eq('id', paymentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found for this lodge.' }, { status: 404 })
    }
    if (payment.status !== 'pending') {
      return NextResponse.json({ error: 'That payment has already been settled.' }, { status: 409 })
    }

    if (action === 'reject') {
      const { error } = await service
        .from('payments')
        .update({ status: 'failed', confirmed_by: auth.userId, confirmed_at: new Date().toISOString() })
        .eq('id', paymentId)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Marked as not received.' })
    }

    // Confirm: the same three effects Stripe's webhook has for a card.
    const { error: payError } = await service
      .from('payments')
      .update({
        status: 'succeeded',
        confirmed_by: auth.userId,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', paymentId)

    if (payError) throw payError

    const { error: memberError } = await service
      .from('tenant_members')
      .update({
        dues_status: 'paid',
        dues_paid_at: new Date().toISOString(),
        dues_year: payment.dues_year,
        // Same reason as the Stripe webhook: a stale threshold would
        // block next cycle's reminder ladder.
        last_dues_reminder: null,
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', payment.member_id)

    if (memberError) throw memberError

    // Receipt, best-effort. The dues ARE recorded as paid by this point;
    // a mail failure must not undo that or fail the officer's action.
    try {
      const [{ data: profile }, { data: tenant }] = await Promise.all([
        service.from('profiles').select('first_name, email').eq('id', payment.member_id).single(),
        service.from('tenants').select('name, number').eq('id', tenantId).single(),
      ])

      if (profile?.email && tenant) {
        await sendPaymentReceiptEmail({
          to: profile.email,
          firstName: profile.first_name ?? 'Brother',
          lodgeName: `${tenant.name} #${tenant.number}`,
          amount: Number(payment.amount),
          year: payment.dues_year ?? new Date().getFullYear(),
        })
      }
    } catch (mailErr) {
      console.error('Dues confirmed but receipt email failed:', mailErr)
    }

    return NextResponse.json({ success: true, message: 'Payment confirmed and dues marked paid.' })
  } catch (error: any) {
    console.error('Confirm dues transfer error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
