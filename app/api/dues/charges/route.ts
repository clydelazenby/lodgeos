import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { sendChargeAddedEmail, APP_URL } from '@/lib/email'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * Levying, waiving and settling per-brother charges.
 *
 * Restricted to the officers who actually handle lodge money —
 * secretary, treasurer, worshipful_master, admin. Deliberately narrower
 * than requireTenantAdmin's full officer set: a Deacon has real duties
 * elsewhere in this app, but fining a brother is not one of them. This
 * mirrors the tier list already used by /api/dues/remind.
 */

const FINANCE_TIERS = ['admin', 'secretary', 'grand_master', 'treasurer', 'worshipful_master'] as const

const CHARGE_TYPES = new Set([
  'penalty', 'late_fee', 'degree_fee', 'reinstatement', 'assessment', 'other',
])

// A guard against a slipped decimal point, not a policy on what a lodge
// may charge. $10,000 is far beyond any real lodge penalty, so hitting
// it means a typo — most likely cents entered as dollars.
const MAX_AMOUNT = 10000

/** Levy a new charge. */
export async function POST(request: Request) {
  try {
    const { tenantId, memberId, amount, chargeType, reason, dueDate } = await request.json()

    if (!tenantId || !memberId) {
      return NextResponse.json({ error: 'Missing tenantId or memberId.' }, { status: 400 })
    }

    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 })
    }
    if (value > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `$${value.toLocaleString()} looks like a typo. The maximum single charge is $${MAX_AMOUNT.toLocaleString()}.` },
        { status: 400 }
      )
    }
    if (!reason?.trim()) {
      return NextResponse.json(
        { error: 'A reason is required — a brother is entitled to know what he is being charged for.' },
        { status: 400 }
      )
    }
    if (chargeType && !CHARGE_TYPES.has(chargeType)) {
      return NextResponse.json({ error: `Unknown charge type "${chargeType}".` }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'finance')
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    // The brother must actually be on this lodge's roster. Without this
    // an officer could levy a charge against any profile id in the
    // platform, including a member of another lodge.
    const { data: membership } = await supabase
      .from('tenant_members')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', memberId)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'That brother is not on this lodge roster.' }, { status: 404 })
    }

    const { data: charge, error } = await supabase
      .from('member_charges')
      .insert({
        tenant_id: tenantId,
        member_id: memberId,
        // Round explicitly: 12.005 entered in a number field should not
        // become 12.00 or 12.01 depending on Postgres' mood.
        amount: Math.round(value * 100) / 100,
        charge_type: chargeType || 'penalty',
        reason: reason.trim(),
        due_date: dueDate || null,
        created_by: auth.userId,
      })
      .select('*, profiles!member_charges_member_id_fkey(first_name, last_name, email)')
      .single()

    if (error) throw error

    /**
     * Telling him.
     *
     * No opt-out, unlike a removal notice. A charge a brother does not
     * know about is one he cannot pay: the first he would otherwise
     * hear of it is a dues reminder for more than he expects, or a
     * conversation at the door. The route already refuses a charge with
     * no reason — "a brother is entitled to know what he is being
     * charged for" — and an unsent notice defeats that just as surely
     * as an empty reason field would.
     *
     * Best effort. The charge is recorded and correct; a mail failure
     * is reported alongside it rather than instead of it, so nobody
     * levies the same charge twice trying to make the email go out.
     */
    let emailed = false
    let emailError: string | undefined
    const chargedProfile = (charge as any)?.profiles

    if (chargedProfile?.email) {
      try {
        const { data: tenant } = await supabase
          .from('tenants').select(LODGE_BRAND_COLUMNS).eq('id', tenantId).maybeSingle()

        await sendChargeAddedEmail({
          to: chargedProfile.email,
          firstName: chargedProfile.first_name || 'Brother',
          lodgeName: tenant ? `${(tenant as any).name} #${(tenant as any).number}` : 'your lodge',
          amount: Number((charge as any).amount),
          reason: (charge as any).reason,
          chargeType: (charge as any).charge_type,
          payUrl: `${APP_URL}/portal/dues`,
          brand: tenant ? toLodgeBrand(tenant) : undefined,
        })
        emailed = true
      } catch (mailErr: any) {
        emailError = mailErr?.message || 'unknown mail error'
        console.error('Charge notice failed:', emailError)
      }
    }

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: await actorName(auth.userId),
      action: 'dues.charged',
      summary: `Charged ${`${chargedProfile?.first_name ?? ''} ${chargedProfile?.last_name ?? ''}`.trim() || 'a brother'} $${Number((charge as any).amount)} — ${(charge as any).reason}`,
      entityType: 'member_charge',
      entityId: (charge as any).id,
      detail: {
        amount: Number((charge as any).amount),
        reason: (charge as any).reason,
        chargeType: (charge as any).charge_type,
      },
    })

    return NextResponse.json({
      success: true,
      charge,
      emailed,
      warning: chargedProfile?.email
        ? (emailed ? undefined : `The charge was recorded, but he could not be notified: ${emailError}`)
        : 'The charge was recorded. He has no email address on file, so he has not been told.',
    })
  } catch (error: any) {
    console.error('Create charge error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Waive a charge, or mark it settled outside Stripe (cash, cheque). */
export async function PATCH(request: Request) {
  try {
    const { tenantId, chargeId, action, waivedReason } = await request.json()

    if (!tenantId || !chargeId) {
      return NextResponse.json({ error: 'Missing tenantId or chargeId.' }, { status: 400 })
    }
    if (action !== 'waive' && action !== 'mark_paid' && action !== 'reopen') {
      return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'finance')
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    // Scoped to the tenant so a charge id from another lodge cannot be
    // altered by an officer of this one.
    const { data: existing } = await supabase
      .from('member_charges')
      .select('id, status')
      .eq('id', chargeId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Charge not found for this lodge.' }, { status: 404 })
    }

    if (action === 'waive' && !waivedReason?.trim()) {
      return NextResponse.json(
        { error: 'Give a reason for waiving. Forgiving a debt should be as attributable as levying one.' },
        { status: 400 }
      )
    }

    const patch =
      action === 'waive'
        ? { status: 'waived', waived_by: auth.userId, waived_reason: waivedReason.trim(), paid_at: null }
        : action === 'mark_paid'
          ? { status: 'paid', paid_at: new Date().toISOString() }
          : { status: 'outstanding', paid_at: null, waived_by: null, waived_reason: null }

    const { data: charge, error } = await supabase
      .from('member_charges')
      .update(patch)
      .eq('id', chargeId)
      .eq('tenant_id', tenantId)
      .select('*, profiles!member_charges_member_id_fkey(first_name, last_name, email)')
      .single()

    if (error) throw error

    /**
     * Telling him.
     *
     * No opt-out, unlike a removal notice. A charge a brother does not
     * know about is one he cannot pay: the first he would otherwise
     * hear of it is a dues reminder for more than he expects, or a
     * conversation at the door. The route already refuses a charge with
     * no reason — "a brother is entitled to know what he is being
     * charged for" — and an unsent notice defeats that just as surely
     * as an empty reason field would.
     *
     * Best effort. The charge is recorded and correct; a mail failure
     * is reported alongside it rather than instead of it, so nobody
     * levies the same charge twice trying to make the email go out.
     */
    let emailed = false
    let emailError: string | undefined
    const chargedProfile = (charge as any)?.profiles

    if (chargedProfile?.email) {
      try {
        const { data: tenant } = await supabase
          .from('tenants').select(LODGE_BRAND_COLUMNS).eq('id', tenantId).maybeSingle()

        await sendChargeAddedEmail({
          to: chargedProfile.email,
          firstName: chargedProfile.first_name || 'Brother',
          lodgeName: tenant ? `${(tenant as any).name} #${(tenant as any).number}` : 'your lodge',
          amount: Number((charge as any).amount),
          reason: (charge as any).reason,
          chargeType: (charge as any).charge_type,
          payUrl: `${APP_URL}/portal/dues`,
          brand: tenant ? toLodgeBrand(tenant) : undefined,
        })
        emailed = true
      } catch (mailErr: any) {
        emailError = mailErr?.message || 'unknown mail error'
        console.error('Charge notice failed:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      charge,
      emailed,
      warning: chargedProfile?.email
        ? (emailed ? undefined : `The charge was recorded, but he could not be notified: ${emailError}`)
        : 'The charge was recorded. He has no email address on file, so he has not been told.',
    })
  } catch (error: any) {
    console.error('Update charge error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
