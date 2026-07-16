import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession, getPortalSession } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { tenantId, plan, billing } = await request.json()
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).single()

    const session = await createCheckoutSession({
      tenantId,
      plan,
      billing,
      email: profile?.email ?? '',
      successUrl: `${appUrl}/onboarding/done?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/onboarding/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
