import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Tool definitions for the AI Secretary. Every tool here is READ-ONLY —
 * it cannot send emails, change dues status, approve petitions, or
 * write anything. It answers using real data fetched live from this
 * tenant's tables, and drafts text for a human to review and send
 * through the app's existing (already-secured) write paths.
 *
 * Every query is scoped by `tenantId` — a value the API route derives
 * from requireTenantAdmin(), never from the request body — so there is
 * no path by which one lodge's Secretary panel could be prompted into
 * reading another lodge's data.
 */

export const SECRETARY_TOOLS = [
  {
    name: 'get_outstanding_dues',
    description: 'Get the list of active members whose dues are currently outstanding (unpaid).',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_roster_summary',
    description: 'Get a summary of the lodge roster: total active members, breakdown by degree (EA/FC/MM), and breakdown by dues status.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_stalled_candidates',
    description: 'Get candidates (EA or FC degree) who have shown no recorded proficiency progress in over 45 days — a signal they may need mentor follow-up.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_upcoming_events',
    description: 'Get lodge events scheduled in the future, with their RSVP headcounts if invites have been sent.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_pending_petitions',
    description: "Get petitions with status 'new' or 'under_review' — applications awaiting the Secretary's or investigation committee's action.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_recent_attendance',
    description: 'Get attendance records for the most recent past event, to see who was present, absent, or excused.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
] as const

type ToolName = typeof SECRETARY_TOOLS[number]['name']

export async function runSecretaryTool(supabase: SupabaseClient, tenantId: string, toolName: ToolName): Promise<unknown> {
  switch (toolName) {
    case 'get_outstanding_dues': {
      const { data } = await supabase
        .from('tenant_members')
        .select('degree, lodge_role, profiles(first_name, last_name, email)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('dues_status', 'due')
      return { count: data?.length ?? 0, members: data }
    }

    case 'get_roster_summary': {
      const { data } = await supabase
        .from('tenant_members')
        .select('degree, dues_status')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
      const byDegree: Record<string, number> = { EA: 0, FC: 0, MM: 0 }
      const byDues: Record<string, number> = { paid: 0, due: 0, exempt: 0 }
      for (const m of data ?? []) {
        byDegree[m.degree] = (byDegree[m.degree] ?? 0) + 1
        byDues[m.dues_status] = (byDues[m.dues_status] ?? 0) + 1
      }
      return { totalActive: data?.length ?? 0, byDegree, byDues }
    }

    case 'get_stalled_candidates': {
      const { data: candidates } = await supabase
        .from('tenant_members')
        .select('user_id, degree, profiles(first_name, last_name)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('degree', ['EA', 'FC'])

      const { data: progress } = await supabase
        .from('degree_progress')
        .select('member_id, degree, conferred_date, proficiency_date')
        .eq('tenant_id', tenantId)

      const progressByKey: Record<string, any> = {}
      for (const p of progress ?? []) progressByKey[`${p.member_id}:${p.degree}`] = p

      const stalled = (candidates ?? []).filter(c => {
        const p = progressByKey[`${c.user_id}:${c.degree}`]
        const dates = [p?.conferred_date, p?.proficiency_date].filter(Boolean)
        if (dates.length === 0) return true
        const mostRecent = dates.sort().at(-1)
        const days = Math.floor((Date.now() - new Date(mostRecent + 'T00:00:00').getTime()) / 86_400_000)
        return days >= 45
      })
      return { count: stalled.length, candidates: stalled }
    }

    case 'get_upcoming_events': {
      const today = new Date().toISOString().slice(0, 10)
      const { data: events } = await supabase
        .from('lodge_events')
        .select('id, title, event_date, event_time, location')
        .eq('tenant_id', tenantId)
        .gte('event_date', today)
        .order('event_date')
      const withCounts = await Promise.all((events ?? []).map(async ev => {
        const { data: rsvps } = await supabase.from('event_rsvps').select('response').eq('event_id', ev.id)
        const counts = { yes: 0, no: 0, maybe: 0 }
        for (const r of rsvps ?? []) counts[r.response as 'yes' | 'no' | 'maybe']++
        return { ...ev, rsvpCounts: counts }
      }))
      return { events: withCounts }
    }

    case 'get_pending_petitions': {
      const { data } = await supabase
        .from('petitions')
        .select('first_name, last_name, status, created_at, referred_by')
        .eq('tenant_id', tenantId)
        .in('status', ['new', 'under_review'])
        .order('created_at', { ascending: false })
      return { count: data?.length ?? 0, petitions: data }
    }

    case 'get_recent_attendance': {
      const { data: lastEvent } = await supabase
        .from('lodge_events')
        .select('id, title, event_date')
        .eq('tenant_id', tenantId)
        .lte('event_date', new Date().toISOString().slice(0, 10))
        .order('event_date', { ascending: false })
        .limit(1)
        .single()
      if (!lastEvent) return { event: null, note: 'No past events found.' }

      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, profiles(first_name, last_name)')
        .eq('event_id', lastEvent.id)
      return { event: lastEvent, attendance }
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
