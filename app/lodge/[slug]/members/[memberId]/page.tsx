

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MemberProfileTabs } from '@/components/lodge/MemberProfileTabs'

export default async function MemberDetailPage({ params }: { params: { slug: string; memberId: string } }) {
  const supabase = await createClient()
  const { data: tenant } = await supabase.from('tenants').select('id, name, number').eq('slug', params.slug).single()
  if (!tenant) notFound()

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('*, profiles(*)')
    .eq('tenant_id', tenant.id)
    .eq('user_id', params.memberId)
    .single()

  if (!membership) notFound()

  const [{ data: attendanceHistory }, { data: paymentHistory }, { data: degreeHistory }] = await Promise.all([
    supabase.from('attendance').select('status, lodge_events(id, title, event_date)').eq('tenant_id', tenant.id).eq('member_id', params.memberId).order('lodge_events(event_date)', { ascending: false }),
    supabase.from('payments').select('*').eq('tenant_id', tenant.id).eq('member_id', params.memberId).eq('status', 'succeeded').order('created_at', { ascending: false }),
    supabase.from('degree_progress').select('*').eq('tenant_id', tenant.id).eq('member_id', params.memberId).order('degree'),
  ])

  return (
    <MemberProfileTabs
      slug={params.slug}
      tenant={tenant}
      membership={membership}
      attendanceHistory={attendanceHistory ?? []}
      paymentHistory={paymentHistory ?? []}
      degreeHistory={degreeHistory ?? []}
    />
  )
}
