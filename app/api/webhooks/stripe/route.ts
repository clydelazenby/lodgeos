import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import {
  sendPaymentReceiptEmail,
  sendWelcomeEmail,
} from '@/lib/email'
import Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  switch (event.type) {

    // ── Dues payment succeeded ──
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.type === 'dues') {
        const { tenant_id, member_id, dues_year } = session.metadata

        // Update payment record
        await supabase.from('payments').update({
          status: 'succeeded',
          receipt_url: session.url,
          stripe_payment_intent_id: session.payment_intent as string,
        }).eq('stripe_session_id', session.id)

        // Update dues status on member
        await supabase.from('tenant_members').update({
          dues_status: 'paid',
          dues_paid_at: new Date().toISOString(),
          dues_year: parseInt(dues_year),
          last_dues_reminder: null, // clear so next cycle's reminders aren't blocked by a stale threshold
        }).eq('tenant_id', tenant_id).eq('user_id', member_id)

        // Get member info for receipt email
        const { data: profile } = await supabase.from('profiles').select('first_name, email').eq('id', member_id).single()
        const { data: tenant } = await supabase.from('tenants').select('name, number').eq('id', tenant_id).single()

        if (profile?.email && tenant) {
          await sendPaymentReceiptEmail({
            to: profile.email,
            firstName: profile.first_name ?? 'Brother',
            lodgeName: `${tenant.name} #${tenant.number}`,
            amount: session.amount_total! / 100,
            year: parseInt(dues_year),
          })
        }
      }

      // Platform subscription checkout
      if (session.metadata?.type !== 'dues' && session.metadata?.tenant_id) {
        const { tenant_id, plan, billing } = session.metadata
        await supabase.from('tenants').update({
          plan,
          billing_cycle: billing,
          stripe_customer_id: session.customer as string,
          subscription_status: 'active',
        }).eq('id', tenant_id)
      }
      break
    }

    // ── Subscription status changes ──
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const tenantId = sub.metadata?.tenant_id
      if (tenantId) {
        await supabase.from('tenants').update({
          subscription_status: sub.status as any,
          stripe_subscription_id: sub.id,
        }).eq('id', tenantId)

        await supabase.from('platform_subscriptions').upsert({
          tenant_id: tenantId,
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer as string,
          status: sub.status as any,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
        }, { onConflict: 'tenant_id' })
      }
      break
    }

    // ── Invoice payment failed (dues past due) ──
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const sub = invoice.subscription
      if (sub) {
        await supabase.from('tenants').update({ subscription_status: 'past_due' })
          .eq('stripe_subscription_id', sub)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
