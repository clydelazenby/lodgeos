import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'

/**
 * Bulk historical attendance import.
 *
 * WHY THIS EXISTS
 *
 * The dashboard attendance heatmap, the analytics trends, and the
 * officer participation figures are all computed from the `attendance`
 * table. A lodge adopting LodgeOS starts with that table empty, so
 * every one of those views renders blank until a full year of meetings
 * has been recorded through the app one meeting at a time. The data to
 * fill it already exists — it's in the secretary's minute book — there
 * was simply no path to get it in.
 *
 * FORMAT
 *
 *   event_date,event_title,member_email,status
 *   2025-01-15,Stated Communication,jsmith@example.com,present
 *   2025-01-15,Stated Communication,bjones@example.com,excused
 *
 * Header row required; column order is read from it, so columns may
 * appear in any order. `status` is optional and defaults to present,
 * since a minute book usually lists who WAS there rather than who
 * wasn't.
 *
 * SAFETY
 *
 * - Restricted to secretary/admin, not the full officer set. Rewriting
 *   years of attendance history is a records-custodian action, and the
 *   secretary is the officer actually responsible for the minutes.
 * - `dryRun: true` returns the full report — including every warning —
 *   without writing anything. The UI runs this first and makes the
 *   secretary confirm, because a mis-mapped column would otherwise
 *   silently write hundreds of wrong rows.
 * - Idempotent. Events are matched on (tenant_id, event_date, title)
 *   and reused if already present; attendance upserts on the existing
 *   unique(event_id, member_id) constraint. Importing the same file
 *   twice produces the same result as importing it once.
 */

const VALID_STATUSES = new Set(['present', 'absent', 'excused'])
const MAX_ROWS = 5000

type ImportRow = {
  line: number
  eventDate: string
  eventTitle: string
  memberEmail: string
  status: string
}

/**
 * Minimal RFC-4180-ish parser: handles quoted fields and escaped ""
 * inside them, which is enough for spreadsheet exports (a lodge name
 * like "Stated Communication, Annual" would otherwise split in two).
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      out.push(field.trim())
      field = ''
    } else {
      field += char
    }
  }

  out.push(field.trim())
  return out
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request) {
  try {
    const { tenantId, csv, dryRun } = await request.json()

    if (!tenantId || typeof csv !== 'string' || !csv.trim()) {
      return NextResponse.json(
        { error: 'Missing tenantId or csv content.' },
        { status: 400 }
      )
    }

    const auth = await requireCapability(tenantId, 'roster')
    if (!auth.ok) return auth.response

    // ---- Parse -------------------------------------------------

    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'File needs a header row and at least one data row.' },
        { status: 400 }
      )
    }

    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))
    const col = {
      date: header.indexOf('event_date'),
      title: header.indexOf('event_title'),
      email: header.indexOf('member_email'),
      status: header.indexOf('status'),
    }

    const missing = (['date', 'title', 'email'] as const).filter((k) => col[k] === -1)
    if (missing.length) {
      return NextResponse.json(
        {
          error: `Missing required column(s): ${missing
            .map((m) => (m === 'date' ? 'event_date' : m === 'title' ? 'event_title' : 'member_email'))
            .join(', ')}. Found: ${header.join(', ')}`,
        },
        { status: 400 }
      )
    }

    const dataLines = lines.slice(1)
    if (dataLines.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `File has ${dataLines.length} rows; the limit is ${MAX_ROWS} per import. Split it by year.` },
        { status: 400 }
      )
    }

    const warnings: string[] = []
    const rows: ImportRow[] = []

    dataLines.forEach((line, i) => {
      const lineNo = i + 2 // 1-indexed, and the header occupies line 1
      const cells = parseCsvLine(line)

      const eventDate = cells[col.date] ?? ''
      const eventTitle = cells[col.title] ?? ''
      const memberEmail = (cells[col.email] ?? '').toLowerCase()
      const status = (col.status !== -1 ? cells[col.status] : '')?.toLowerCase() || 'present'

      if (!ISO_DATE.test(eventDate)) {
        warnings.push(`Line ${lineNo}: skipped — event_date "${eventDate}" is not YYYY-MM-DD.`)
        return
      }
      if (Number.isNaN(new Date(eventDate).getTime())) {
        warnings.push(`Line ${lineNo}: skipped — "${eventDate}" is not a real date.`)
        return
      }
      if (!eventTitle) {
        warnings.push(`Line ${lineNo}: skipped — event_title is empty.`)
        return
      }
      if (!memberEmail) {
        warnings.push(`Line ${lineNo}: skipped — member_email is empty.`)
        return
      }
      if (!VALID_STATUSES.has(status)) {
        warnings.push(`Line ${lineNo}: skipped — status "${status}" must be present, absent, or excused.`)
        return
      }

      rows.push({ line: lineNo, eventDate, eventTitle, memberEmail, status })
    })

    if (!rows.length) {
      return NextResponse.json(
        { error: 'No valid rows found.', warnings },
        { status: 400 }
      )
    }

    // ---- Resolve members ---------------------------------------
    //
    // Service client: this reads profiles rows for the whole lodge in
    // one shot, which the caller's own RLS view would also permit
    // (they're a member of the same lodge) — done here in a single
    // query rather than one lookup per row.

    const supabase = createServiceClient()

    const { data: members, error: membersError } = await supabase
      .from('tenant_members')
      .select('user_id, profiles(email)')
      .eq('tenant_id', tenantId)

    if (membersError) throw membersError

    const idByEmail = new Map<string, string>()
    for (const m of members ?? []) {
      const email = (m as any).profiles?.email?.toLowerCase()
      if (email) idByEmail.set(email, (m as any).user_id)
    }

    const unmatchedEmails = new Set<string>()
    const resolved = rows.filter((r) => {
      if (idByEmail.has(r.memberEmail)) return true
      unmatchedEmails.add(r.memberEmail)
      return false
    })

    // Array.from rather than iterating the Set directly — this project
    // targets ES5, where for..of over a Set needs downlevelIteration.
    Array.from(unmatchedEmails).forEach((email) => {
      warnings.push(`No member of this lodge has the email "${email}" — those rows were skipped.`)
    })

    if (!resolved.length) {
      return NextResponse.json(
        {
          error: 'None of the emails in this file match a member of this lodge.',
          warnings,
        },
        { status: 400 }
      )
    }

    // ---- Resolve events ----------------------------------------

    const eventKey = (date: string, title: string) => `${date}::${title.toLowerCase()}`
    const neededEvents = new Map<string, { date: string; title: string }>()
    for (const r of resolved) {
      neededEvents.set(eventKey(r.eventDate, r.eventTitle), {
        date: r.eventDate,
        title: r.eventTitle,
      })
    }

    const dates = Array.from(new Set(resolved.map((r) => r.eventDate)))
    const { data: existingEvents, error: eventsError } = await supabase
      .from('lodge_events')
      .select('id, title, event_date')
      .eq('tenant_id', tenantId)
      .in('event_date', dates)

    if (eventsError) throw eventsError

    const eventIdByKey = new Map<string, string>()
    for (const e of existingEvents ?? []) {
      eventIdByKey.set(eventKey((e as any).event_date, (e as any).title), (e as any).id)
    }

    const toCreate = Array.from(neededEvents.entries())
      .filter(([key]) => !eventIdByKey.has(key))
      .map(([, v]) => v)

    // ---- Dry run stops here ------------------------------------

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        rowsParsed: rows.length,
        rowsToImport: resolved.length,
        rowsSkipped: rows.length - resolved.length + (dataLines.length - rows.length),
        eventsMatched: neededEvents.size - toCreate.length,
        eventsToCreate: toCreate.length,
        newEventTitles: toCreate.slice(0, 20).map((e) => `${e.date} — ${e.title}`),
        membersMatched: new Set(resolved.map((r) => r.memberEmail)).size,
        unmatchedEmails: Array.from(unmatchedEmails),
        warnings,
      })
    }

    // ---- Write --------------------------------------------------

    if (toCreate.length) {
      const { data: created, error: createError } = await supabase
        .from('lodge_events')
        .insert(
          toCreate.map((e) => ({
            tenant_id: tenantId,
            title: e.title,
            event_date: e.date,
            // Historical records, not announcements — these must not
            // surface on the public lodge page alongside upcoming
            // meetings.
            is_public: false,
          }))
        )
        .select('id, title, event_date')

      if (createError) throw createError

      for (const e of created ?? []) {
        eventIdByKey.set(eventKey((e as any).event_date, (e as any).title), (e as any).id)
      }
    }

    // Deduplicate within the file itself. Two rows naming the same
    // member at the same meeting would otherwise make Postgres reject
    // the whole batch: an upsert cannot touch the same conflict target
    // twice in one statement. Last occurrence wins.
    const byPair = new Map<string, { tenant_id: string; event_id: string; member_id: string; status: string }>()

    for (const r of resolved) {
      const eventId = eventIdByKey.get(eventKey(r.eventDate, r.eventTitle))
      const memberId = idByEmail.get(r.memberEmail)
      if (!eventId || !memberId) continue

      byPair.set(`${eventId}:${memberId}`, {
        tenant_id: tenantId,
        event_id: eventId,
        member_id: memberId,
        status: r.status,
      })
    }

    const attendanceRows = Array.from(byPair.values())

    const { error: upsertError } = await supabase
      .from('attendance')
      .upsert(attendanceRows, { onConflict: 'event_id,member_id' })

    if (upsertError) throw upsertError

    return NextResponse.json({
      success: true,
      imported: attendanceRows.length,
      eventsCreated: toCreate.length,
      membersMatched: new Set(resolved.map((r) => r.memberEmail)).size,
      unmatchedEmails: Array.from(unmatchedEmails),
      warnings,
    })
  } catch (error: any) {
    console.error('Attendance import error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
