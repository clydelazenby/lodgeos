import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDuesCheckoutSession } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { tenantId, memberId, amount, year } = await request.json()

    const { data: tenant } = await supabase.from('tenants').select('name, number').eq('id', tenantId).single()
    const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', memberId).single()

    if (!tenant || !profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await createDuesCheckoutSession({
      tenantId,
      memberId,
      amount,
      lodgeName: `${tenant.name} #${tenant.number}`,
      memberName: `${profile.first_name} ${profile.last_name}`,
      year,
      successUrl: `${appUrl}/portal/dues?success=true`,
      cancelUrl: `${appUrl}/portal/dues`,
    })

    // Create pending payment record
    await supabase.from('payments').insert({
      tenant_id: tenantId,
      member_id: memberId,
      amount,
      stripe_session_id: session.id,
      status: 'pending',
      dues_year: year,
      description: `Annual dues ${year}`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Dues checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
