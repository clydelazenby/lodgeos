import { SupabaseClient } from '@supabase/supabase-js'
import { degreeLabel } from '@/lib/degrees'

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
 * reading another lodge's data. The client passed in is the OFFICER'S
 * OWN session client, so RLS applies on top: the assistant can never
 * read anything the officer asking could not read himself.
 *
 * TOOLS TAKE ARGUMENTS. They did not, originally, and that shaped every
 * answer: with no way to ask about one brother or one span of time, the
 * only strategy available was "fetch the whole table and reason about
 * it", which is slow, expensive, and gets worse as a lodge grows. The
 * questions a Secretary actually asks — "has Bro. Smith been coming?",
 * "who has missed the last three?" — could not be answered at all.
 */

/**
 * Ceiling on rows returned to the model. A 300-brother lodge would
 * otherwise put its entire roster into the context window on every
 * question, at a cost paid per turn for the rest of the conversation.
 * Truncation is reported in the payload so the model says "the first
 * 50 of 300" rather than quietly answering from a partial list.
 */
const MAX_ROWS = 50

function cap<T>(rows: T[] | null | undefined): { total: number; returned: T[]; truncated: boolean } {
  const all = rows ?? []
  return {
    total: all.length,
    returned: all.slice(0, MAX_ROWS),
    truncated: all.length > MAX_ROWS,
  }
}

const fullName = (p: any) => `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim()

export const SECRETARY_TOOLS = [
  {
    name: 'get_outstanding_dues',
    description: 'List active members whose dues are currently outstanding (unpaid), with the amount the lodge charges.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_roster_summary',
    description: 'Summary of the lodge roster: total active members, breakdown by degree (Blue Lodge and appendant bodies), by dues status, and how many hold an office.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'find_member',
    description:
      "Look up one brother by name and return his degree, office, dues status, contact details, attendance record and any outstanding charges. Use this whenever a question names a particular brother, rather than fetching the whole roster.",
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Full or partial name, e.g. "Smith" or "John Smith".' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_attendance_summary',
    description:
      'Attendance across recent meetings: how many of the last N events each active brother attended, sorted by who has attended least. Use for "who has stopped coming" or "how is attendance trending".',
    input_schema: {
      type: 'object' as const,
      properties: {
        events: { type: 'number', description: 'How many recent past events to look across. Default 6, maximum 24.' },
      },
      required: [],
    },
  },
  {
    name: 'get_stalled_candidates',
    description: 'Candidates (Entered Apprentice or Fellowcraft) with no recorded proficiency progress in over 45 days — a signal they may need mentor follow-up.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_upcoming_events',
    description: 'Lodge events scheduled in the future, with RSVP headcounts where invitations have gone out.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_pending_petitions',
    description: "Petitions with status 'new' or 'under_review' — applications awaiting the Secretary's or investigation committee's action.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_recent_attendance',
    description: 'Who was present, absent or excused at one past meeting. Defaults to the most recent.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_meeting_record',
    description:
      'Everything recorded about one past meeting: its agenda as worked through, who was present, absent and excused, and which visiting brethren signed the register. Use this to DRAFT MINUTES — it is the lodge\'s own record of the evening, so minutes built from it do not depend on the officer retyping his notes. Defaults to the most recent past meeting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        eventId: { type: 'string', description: 'A specific meeting id, when one is known. Otherwise the most recent past meeting is used.' },
      },
      required: [],
    },
  },
] as const

type ToolName = typeof SECRETARY_TOOLS[number]['name']

export async function runSecretaryTool(
  supabase: SupabaseClient,
  tenantId: string,
  toolName: ToolName,
  input: Record<string, any> = {}
): Promise<unknown> {
  switch (toolName) {
    case 'get_outstanding_dues': {
      const [{ data }, { data: tenant }] = await Promise.all([
        supabase
          .from('tenant_members')
          .select('degree, lodge_role, profiles(first_name, last_name, email)')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .eq('dues_status', 'due'),
        supabase.from('tenants').select('dues_amount').eq('id', tenantId).maybeSingle(),
      ])

      const { total, returned, truncated } = cap(data)
      return {
        count: total,
        duesAmount: (tenant as any)?.dues_amount ?? null,
        truncated,
        members: returned.map((m: any) => ({
          name: fullName(m.profiles),
          email: m.profiles?.email ?? null,
          degree: degreeLabel(m.degree),
          office: m.lodge_role ?? null,
        })),
      }
    }

    case 'get_roster_summary': {
      const { data } = await supabase
        .from('tenant_members')
        .select('degree, dues_status, lodge_role')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)

      const byDegree: Record<string, number> = {}
      const byDues: Record<string, number> = {}
      let officers = 0
      for (const m of data ?? []) {
        // Keyed by the readable label, not the stored code: the model
        // reads "Master Mason", not "MM", and appendant degrees exist
        // now — a fixed EA/FC/MM shape would have hidden every Noble
        // and Royal Arch Mason behind an undefined bucket.
        const label = degreeLabel((m as any).degree)
        byDegree[label] = (byDegree[label] ?? 0) + 1
        byDues[(m as any).dues_status] = (byDues[(m as any).dues_status] ?? 0) + 1
        if ((m as any).lodge_role?.trim()) officers++
      }
      return { totalActive: data?.length ?? 0, byDegree, byDues, officersSeated: officers }
    }

    case 'find_member': {
      const query = String(input.name ?? '').trim()
      if (!query) return { error: 'A name is required.' }

      const { data: roster } = await supabase
        .from('tenant_members')
        .select('user_id, degree, lodge_role, dues_status, profiles(first_name, last_name, email, phone)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)

      const needle = query.toLowerCase()
      const matches = (roster ?? []).filter((m: any) =>
        fullName(m.profiles).toLowerCase().includes(needle)
      )

      if (matches.length === 0) return { found: 0, note: `No active brother matching "${query}".` }
      if (matches.length > 1) {
        return {
          found: matches.length,
          note: 'Several brothers match. Ask which is meant.',
          candidates: matches.map((m: any) => fullName(m.profiles)),
        }
      }

      const m: any = matches[0]
      const [{ data: attendance }, { data: charges }] = await Promise.all([
        supabase
          .from('attendance')
          .select('status, lodge_events(title, event_date)')
          .eq('tenant_id', tenantId)
          .eq('member_id', m.user_id)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('member_charges')
          .select('amount, reason, status, created_at')
          .eq('tenant_id', tenantId)
          .eq('member_id', m.user_id)
          .eq('status', 'outstanding'),
      ])

      return {
        found: 1,
        name: fullName(m.profiles),
        degree: degreeLabel(m.degree),
        office: m.lodge_role ?? null,
        duesStatus: m.dues_status,
        email: m.profiles?.email ?? null,
        phone: m.profiles?.phone ?? null,
        recentAttendance: (attendance ?? []).map((a: any) => ({
          event: a.lodge_events?.title ?? 'Meeting',
          date: a.lodge_events?.event_date ?? null,
          status: a.status,
        })),
        outstandingCharges: (charges ?? []).map((c: any) => ({
          amount: Number(c.amount), reason: c.reason, since: c.created_at,
        })),
      }
    }

    case 'get_attendance_summary': {
      const requested = Number(input.events)
      const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 24) : 6
      const today = new Date().toISOString().slice(0, 10)

      const { data: events } = await supabase
        .from('lodge_events')
        .select('id, title, event_date')
        .eq('tenant_id', tenantId)
        .lte('event_date', today)
        .order('event_date', { ascending: false })
        .limit(limit)

      if (!events || events.length === 0) return { events: 0, note: 'No past meetings recorded.' }

      const [{ data: roster }, { data: attendance }] = await Promise.all([
        supabase
          .from('tenant_members')
          .select('user_id, lodge_role, profiles(first_name, last_name)')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        // One query for every event, not one per event.
        supabase
          .from('attendance')
          .select('member_id, status, event_id')
          .eq('tenant_id', tenantId)
          .in('event_id', events.map((e: any) => e.id)),
      ])

      const presentBy = new Map<string, number>()
      for (const a of attendance ?? []) {
        if ((a as any).status === 'present') {
          const id = (a as any).member_id
          presentBy.set(id, (presentBy.get(id) ?? 0) + 1)
        }
      }

      const rows = (roster ?? [])
        .map((m: any) => ({
          name: fullName(m.profiles),
          office: m.lodge_role ?? null,
          attended: presentBy.get(m.user_id) ?? 0,
          of: events.length,
        }))
        .sort((a, b) => a.attended - b.attended)

      const { returned, truncated } = cap(rows)
      return {
        meetingsConsidered: events.length,
        dateRange: { from: events[events.length - 1].event_date, to: events[0].event_date },
        truncated,
        // Least-attending first: that is the list an officer acts on.
        brethren: returned,
      }
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

      const stalled = (candidates ?? [])
        .filter((c: any) => {
          const p = progressByKey[`${c.user_id}:${c.degree}`]
          const dates = [p?.conferred_date, p?.proficiency_date].filter(Boolean)
          if (dates.length === 0) return true
          const mostRecent = dates.sort().at(-1)
          const days = Math.floor((Date.now() - new Date(mostRecent + 'T00:00:00').getTime()) / 86_400_000)
          return days >= 45
        })
        .map((c: any) => ({ name: fullName(c.profiles), degree: degreeLabel(c.degree) }))

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
        .limit(MAX_ROWS)

      if (!events || events.length === 0) return { events: [] }

      // One RSVP query for all of them. This was a query per event —
      // twenty upcoming events meant twenty sequential round trips
      // before the model saw a single word.
      const { data: rsvps } = await supabase
        .from('event_rsvps')
        .select('event_id, response')
        .in('event_id', events.map((e: any) => e.id))

      const counts = new Map<string, { yes: number; no: number; maybe: number }>()
      for (const r of rsvps ?? []) {
        const id = (r as any).event_id
        if (!counts.has(id)) counts.set(id, { yes: 0, no: 0, maybe: 0 })
        const bucket = counts.get(id)!
        const answer = (r as any).response as 'yes' | 'no' | 'maybe'
        if (answer in bucket) bucket[answer]++
      }

      return {
        events: events.map((e: any) => ({
          ...e,
          rsvpCounts: counts.get(e.id) ?? { yes: 0, no: 0, maybe: 0 },
        })),
      }
    }

    case 'get_pending_petitions': {
      const { data } = await supabase
        .from('petitions')
        .select('first_name, last_name, status, created_at, referred_by')
        .eq('tenant_id', tenantId)
        .in('status', ['new', 'under_review'])
        .order('created_at', { ascending: false })
        .limit(MAX_ROWS)
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
        .maybeSingle()

      if (!lastEvent) return { event: null, note: 'No past events found.' }

      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, profiles(first_name, last_name)')
        .eq('event_id', (lastEvent as any).id)

      return {
        event: lastEvent,
        attendance: (attendance ?? []).map((a: any) => ({
          name: fullName(a.profiles), status: a.status,
        })),
      }
    }

    case 'get_meeting_record': {
      /**
       * The material a set of minutes is actually made of.
       *
       * Before this, drafting minutes meant the Secretary retyping his
       * notes into the panel — while the lodge had already recorded the
       * agenda as it was worked through, who answered the roll, and who
       * visited. The draft should be built from the record, not from
       * the officer's memory of it an hour later.
       */
      let eventId = typeof input.eventId === 'string' ? input.eventId : null

      if (!eventId) {
        const { data: recent } = await supabase
          .from('lodge_events')
          .select('id')
          .eq('tenant_id', tenantId)
          .lte('event_date', new Date().toISOString().slice(0, 10))
          .order('event_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        eventId = (recent as any)?.id ?? null
      }

      if (!eventId) return { event: null, note: 'No past meetings recorded.' }

      const [{ data: event }, { data: agenda }, { data: attendance }, { data: visitors }, { data: existing }] =
        await Promise.all([
          supabase
            .from('lodge_events')
            .select('id, title, event_date, event_time, location, event_type, opened_at, closed_at')
            .eq('id', eventId)
            .eq('tenant_id', tenantId)
            .maybeSingle(),
          supabase
            .from('meeting_agenda_items')
            .select('label, completed, notes, sort_order')
            .eq('event_id', eventId)
            .eq('tenant_id', tenantId)
            .order('sort_order'),
          supabase
            .from('attendance')
            .select('status, profiles(first_name, last_name), tenant_members!inner(lodge_role)')
            .eq('event_id', eventId)
            .eq('tenant_id', tenantId),
          supabase
            .from('event_visitors')
            .select('name, title, visiting_from, jurisdiction')
            .eq('event_id', eventId)
            .eq('tenant_id', tenantId)
            .order('created_at'),
          supabase
            .from('meeting_minutes')
            .select('status, approved_on')
            .eq('event_id', eventId)
            .eq('tenant_id', tenantId)
            .maybeSingle(),
        ])

      if (!event) return { event: null, note: 'That meeting does not belong to this lodge.' }

      const named = (rows: any[], status: string) =>
        rows.filter((a) => a.status === status).map((a) => fullName(a.profiles)).filter(Boolean)

      const all = attendance ?? []

      return {
        event,
        // Reported so the model says "minutes already exist for this
        // meeting" rather than cheerfully drafting a second set.
        existingMinutes: existing ? { status: (existing as any).status, approvedOn: (existing as any).approved_on } : null,
        agenda: (agenda ?? []).map((a: any) => ({
          item: a.label,
          completed: a.completed,
          note: a.notes ?? null,
        })),
        attendance: {
          present: named(all, 'present'),
          absent: named(all, 'absent'),
          excused: named(all, 'excused'),
          presentCount: all.filter((a: any) => a.status === 'present').length,
        },
        // The minutes of a stated communication traditionally name the
        // visitors, and until the register existed they could not.
        visitors: (visitors ?? []).map((v: any) => ({
          name: v.title ? `${v.title} ${v.name}` : v.name,
          from: v.visiting_from ?? null,
          jurisdiction: v.jurisdiction ?? null,
        })),
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
