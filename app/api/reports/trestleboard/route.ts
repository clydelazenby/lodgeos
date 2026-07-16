import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { renderToBuffer } from '@react-pdf/renderer'
import { TrestleboardDocument, TrestleboardData } from '@/lib/reports/TrestleboardDocument'
import React from 'react'

export async function POST(request: Request) {
  try {
    const { tenantId, month, year, announcement } = await request.json()
    if (!tenantId || !month || !year) return NextResponse.json({ error: 'Missing tenantId, month, or year' }, { status: 400 })

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { data: tenant } = await supabase.from('tenants').select('name, number, meeting_schedule').eq('id', tenantId).single()
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const monthPadded = String(month).padStart(2, '0')
    const periodStart = `${year}-${monthPadded}-01`
    const lastDay = new Date(year, month, 0).getDate() // day 0 of next month = last day of this month
    const periodEnd = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`

    const { data: events } = await supabase
      .from('lodge_events')
      .select('title, event_date, event_time, location')
      .eq('tenant_id', tenantId)
      .gte('event_date', periodStart)
      .lte('event_date', periodEnd)
      .order('event_date')

    // Birthday matching compares month+day only, ignoring year — a
    // birthday is a recurring annual date, not a one-time event, so a
    // naive string-range comparison against full dates would only ever
    // match members born in this exact calendar year, which is wrong.
    const { data: members } = await supabase
      .from('tenant_members')
      .select('profiles(first_name, last_name, date_of_birth)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    const birthdays = (members ?? [])
      .map((m: any) => m.profiles)
      .filter((p: any) => p?.date_of_birth)
      .filter((p: any) => new Date(p.date_of_birth + 'T00:00:00').getMonth() + 1 === Number(month))
      .map((p: any) => ({
        name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        date: new Date(p.date_of_birth + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        sortDay: new Date(p.date_of_birth + 'T00:00:00').getDate(),
      }))
      .sort((a, b) => a.sortDay - b.sortDay)
      .map(({ name, date }) => ({ name, date }))

    const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const reportData: TrestleboardData = {
      lodgeName: tenant.name,
      lodgeNumber: tenant.number,
      monthLabel,
      meetingSchedule: tenant.meeting_schedule,
      events: (events ?? []).map(e => ({
        title: e.title,
        date: new Date(e.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: e.event_time,
        location: e.location,
      })),
      birthdays,
      announcement: announcement || '',
      generatedAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    }

    const pdfBuffer = await renderToBuffer(React.createElement(TrestleboardDocument, { data: reportData }))

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${tenant.name.replace(/\s+/g, '-')}-Trestleboard-${monthLabel.replace(/\s+/g, '-')}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Trestleboard generation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
