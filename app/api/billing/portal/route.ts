import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/stripe'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url))

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id, tenants(stripe_customer_id)')
    .eq('user_id', user.id)
    .in('tenant_role', ['admin', 'secretary'])
    .single()

  const customerId = (membership?.tenants as any)?.stripe_customer_id
  if (!customerId) return NextResponse.redirect(new URL('/portal', request.url))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const session = await getPortalSession(customerId, `${appUrl}/portal`)
  return NextResponse.redirect(session.url)
}
