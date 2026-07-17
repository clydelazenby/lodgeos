import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { renderToBuffer } from '@react-pdf/renderer'
import { AnnualReturnDocument, AnnualReturnData } from '@/lib/reports/AnnualReturnDocument'
import React from 'react'

export async function POST(request: Request) {
  try {
    const { tenantId, year } = await request.json()
    if (!tenantId || !year) return NextResponse.json({ error: 'Missing tenantId or year' }, { status: 400 })

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()
    const periodStart = `${year}-01-01`
    const periodEnd = `${year}-12-31`

    const { data: tenant } = await supabase.from('tenants').select('name, number, jurisdiction').eq('id', tenantId).single()
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    // Membership counts. "Start of period" and "end of period" are both
    // approximated from CURRENT is_active state plus join dates, since
    // the schema has no historical snapshot table — a member who joined
    // and became inactive within the same year is counted correctly,
    // but the schema cannot tell us the exact headcount on Jan 1 of a
    // past year if members have since been added or removed. This is a
    // real limitation, not a rounding error to gloss over.
    const { data: allMembers } = await supabase
      .from('tenant_members')
      .select('is_active, joined_date, created_at')
      .eq('tenant_id', tenantId)

    const activeStart = (allMembers ?? []).filter(m => {
      const joined = m.joined_date || m.created_at?.slice(0, 10)
      return joined && joined < periodStart
    }).length
    const activeEnd = (allMembers ?? []).filter(m => m.is_active).length
    const becameInactive = (allMembers ?? []).filter(m => !m.is_active).length // approximation — see PDF note; schema has no "when" for inactivity

    // Degree conferrals within the period.
    const { data: conferrals } = await supabase
      .from('degree_progress')
      .select('degree, conferred_date, tenant_members!inner(profiles(first_name, last_name))')
      .eq('tenant_id', tenantId)
      .gte('conferred_date', periodStart)
      .lte('conferred_date', periodEnd)
      .not('conferred_date', 'is', null)

    const degreesConferredEA = (conferrals ?? []).filter(c => c.degree === 'EA').length
    const degreesConferredFC = (conferrals ?? []).filter(c => c.degree === 'FC').length
    const degreesConferredMM = (conferrals ?? []).filter(c => c.degree === 'MM').length

    const conferralDetail = (conferrals ?? []).map((c: any) => {
      const profile = c.tenant_members?.profiles
      return {
        name: profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : 'Unknown',
        degree: c.degree,
        date: c.conferred_date,
      }
    })

    // Petitions within the period.
    const { data: petitions } = await supabase
      .from('petitions')
      .select('status, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', periodStart)
      .lte('created_at', `${periodEnd}T23:59:59`)

    const petitionsReceived = petitions?.length ?? 0
    const petitionsApproved = (petitions ?? []).filter(p => p.status === 'approved').length
    const petitionsDenied = (petitions ?? []).filter(p => p.status === 'denied').length
    const petitionsPending = (petitions ?? []).filter(p => p.status === 'new' || p.status === 'under_review').length

    // Dues collected within the period.
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'succeeded')
      .gte('created_at', periodStart)
      .lte('created_at', `${periodEnd}T23:59:59`)

    const duesCollectedTotal = (payments ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0)

    const reportData: AnnualReturnData = {
      lodgeName: tenant.name,
      lodgeNumber: tenant.number,
      jurisdiction: tenant.jurisdiction,
      periodStart, periodEnd,
      generatedAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      memberCounts: { activeStart, activeEnd, becameInactive },
      degreesConferredEA, degreesConferredFC, degreesConferredMM,
      petitionsReceived, petitionsApproved, petitionsDenied, petitionsPending,
      duesCollectedTotal,
      conferralDetail,
    }

    const pdfBuffer = await renderToBuffer(
  React.createElement(
    AnnualReturnDocument as any,
    { data: reportData }
  ) as any
)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${tenant.name.replace(/\s+/g, '-')}-Annual-Return-${year}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Annual return generation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
