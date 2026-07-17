import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient()

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !tenant) {
    return NextResponse.json(
      { error: 'Lodge not found' },
      { status: 404 }
    )
  }

  const { data: members } = await supabase
    .from('tenant_members')
    .select('*, profiles(first_name, last_name, email)')
    .eq('tenant_id', params.id)
    .order('created_at')

  return NextResponse.json({
    tenant,
    members: members ?? [],
  })
}