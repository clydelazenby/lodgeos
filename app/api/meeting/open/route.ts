import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { openMeetingForEvent } from '@/lib/meeting/openMeeting'

// The open logic (one-meeting-at-a-time check, timestamps, QR token,
// default agenda seeding) now lives in lib/meeting/openMeeting.ts so
// /api/meeting/create can open a meeting the moment it creates one
// without duplicating that invariant.
export async function POST(request: Request) {
  try {
    const { tenantId, eventId } = await request.json()
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

    const auth = await requireCapability(tenantId, 'meetings')
    if (!auth.ok) return auth.response

    const supabase = await createClient()
    const result = await openMeetingForEvent(supabase, tenantId, eventId, auth.userId)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, event: result.event })
  } catch (error: any) {
    console.error('Open meeting error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
