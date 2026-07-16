import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const PLAN_PRICES = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY!,
    annual: process.env.STRIPE_STARTER_ANNUAL!,
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY!,
    annual: process.env.STRIPE_PRO_ANNUAL!,
  },
  district: {
    monthly: process.env.STRIPE_DISTRICT_MONTHLY!,
    annual: process.env.STRIPE_DISTRICT_ANNUAL!,
  },
}

export async function createCheckoutSession({
  tenantId,
  plan,
  billing,
  email,
  successUrl,
  cancelUrl,
}: {
  tenantId: string
  plan: string
  billing: 'monthly' | 'annual'
  email: string
  successUrl: string
  cancelUrl: string
}) {
  const priceId = PLAN_PRICES[plan as keyof typeof PLAN_PRICES]?.[billing]
  if (!priceId) throw new Error('Invalid plan')

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenant_id: tenantId, plan, billing },
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenant_id: tenantId },
    },
  })
  return session
}

export async function createDuesCheckoutSession({
  tenantId,
  memberId,
  amount,
  lodgeName,
  memberName,
  year,
  successUrl,
  cancelUrl,
}: {
  tenantId: string
  memberId: string
  amount: number
  lodgeName: string
  memberName: string
  year: number
  successUrl: string
  cancelUrl: string
}) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${lodgeName} Annual Dues ${year}`,
          description: `Lodge dues for ${memberName}`,
        },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenant_id: tenantId, member_id: memberId, dues_year: year, type: 'dues' },
  })
  return session
}

export async function getPortalSession(customerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}
