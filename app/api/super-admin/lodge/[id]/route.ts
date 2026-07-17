import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log('API PARAMS:', params)

  const id = String(params.id).replace(/"/g, '').trim()

  console.log('API ID:', id)

  const supabase = createServiceClient()

  const tenantResult = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)

  console.log('TENANT RESULT:', tenantResult)

  const tenant = tenantResult.data?.[0]

  if (!tenant) {
    return NextResponse.json(
      {
        error: 'Lodge not found',
        id,
        result: tenantResult,
      },
      { status: 404 }
    )
  }

  const { data: members } = await supabase
    .from('tenant_members')
    .select('*, profiles(first_name, last_name, email)')
    .eq('tenant_id', id)
    .order('created_at')

  return NextResponse.json({
    tenant,
    members: members ?? [],
  })
}