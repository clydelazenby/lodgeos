import { NextResponse } from 'next/server'
import { sendDuesReminderEmail } from '@/lib/email'
import { requireCapability } from '@/lib/auth/capabilities'
import { createClient } from '@/lib/supabase/server'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'

export async function POST(request: Request) {
  try {
    const { tenantId } = await request.json()

    // Financial-adjacent action — restricted to the tiers that actually
    // handle dues, not every officer. A Deacon or Warden shouldn't be
    // able to blast dues reminders even though they're legitimate
    // officers with other real access elsewhere in the app.
    const auth = await requireCapability(tenantId, 'finance')
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    // Get tenant info
    const { data: tenant } = await supabase.from('tenants').select(`dues_amount, ${LODGE_BRAND_COLUMNS}`).eq('id', tenantId).single()
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    // Get all members with outstanding dues
    const { data: dueMembers } = await supabase
      .from('tenant_members')
      .select('user_id, profiles(first_name, email)')
      .eq('tenant_id', tenantId)
      .eq('dues_status', 'due')
      .eq('is_active', true)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let sent = 0
    let failed = 0

    for (const member of dueMembers ?? []) {
      const profile = (member as any).profiles
      if (!profile?.email) continue

      try {
        await sendDuesReminderEmail({
          to: profile.email,
          firstName: profile.first_name ?? 'Brother',
          lodgeName: `${tenant.name} #${tenant.number}`,
          brand: toLodgeBrand(tenant),
          amount: tenant.dues_amount,
          year: new Date().getFullYear(),
          payUrl: `${appUrl}/portal/dues`,
        })
        sent++
      } catch {
        failed++
      }
    }

    return NextResponse.json({ sent, failed, total: dueMembers?.length ?? 0 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
