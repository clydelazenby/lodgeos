import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * Records when a brother was initiated, passed and raised.
 *
 * These are copied off the old lodge register, which is why they are
 * editable at all rather than being derived from degree_progress:
 * that table only knows about candidates who progressed through this
 * lodge WHILE it was using LodgeOS, so it is empty for nearly everyone
 * — and emptiest of all for the men whose fiftieth year is approaching,
 * who are the whole reason this exists.
 *
 * Secretary's office only. This is register work, and a raising date is
 * what a service jewel is struck against; it is not something a Deacon
 * should be able to change from a phone.
 */

const FIELDS = ['initiated_date', 'passed_date', 'raised_date'] as const
type Field = typeof FIELDS[number]

const LABEL: Record<Field, string> = {
  initiated_date: 'initiated',
  passed_date: 'passed',
  raised_date: 'raised',
}

/** An empty string clears the date; anything else must be YYYY-MM-DD. */
function normalise(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

export async function POST(request: Request) {
  try {
    const { tenantId, memberId, dates } = await request.json()
    if (!tenantId || !memberId || typeof dates !== 'object' || dates === null) {
      return NextResponse.json({ error: 'Missing tenantId, memberId or dates.' }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'roster')
    if (!auth.ok) return auth.response

    const patch: Record<string, string | null> = {}
    for (const field of FIELDS) {
      if (!(field in dates)) continue
      const value = normalise((dates as any)[field])
      if (value === undefined) {
        return NextResponse.json(
          { error: `${field} must be a date in YYYY-MM-DD form, or empty to clear it.` },
          { status: 400 }
        )
      }
      patch[field] = value
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No dates given.' }, { status: 400 })
    }

    /**
     * A man cannot be raised before he was initiated.
     *
     * Checked against the merged result rather than the submitted
     * fields alone, so correcting one date is validated against the two
     * already on file. Refused rather than silently stored: a raising
     * date is what the anniversary and every service jewel counts from,
     * and one entered as 1876 instead of 1976 would put a brother in
     * his hundred-and-fiftieth year on the dashboard.
     */
    const supabase = await createClient()

    const { data: current, error: readError } = await supabase
      .from('tenant_members')
      .select('initiated_date, passed_date, raised_date, profiles(first_name, last_name)')
      .eq('tenant_id', tenantId)
      .eq('user_id', memberId)
      .maybeSingle()

    if (readError) throw readError
    if (!current) {
      return NextResponse.json({ error: 'No such brother on this roster.' }, { status: 404 })
    }

    const merged = { ...(current as any), ...patch }
    const order: Field[] = ['initiated_date', 'passed_date', 'raised_date']
    for (let i = 1; i < order.length; i++) {
      const earlier = merged[order[i - 1]]
      const later = merged[order[i]]
      if (earlier && later && later < earlier) {
        return NextResponse.json(
          {
            error: `He cannot have been ${LABEL[order[i]]} on ${later}, before he was ${LABEL[order[i - 1]]} on ${earlier}. Check the dates against the register.`,
          },
          { status: 400 }
        )
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    for (const field of order) {
      if (merged[field] && merged[field] > today) {
        return NextResponse.json(
          { error: `A date in the future (${merged[field]}) is not a record of something that happened.` },
          { status: 400 }
        )
      }
    }

    const { data: updated, error } = await supabase
      .from('tenant_members')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('user_id', memberId)
      .select('initiated_date, passed_date, raised_date')
      .single()

    if (error) throw error

    const p = (current as any).profiles
    const name = `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'a brother'

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: await actorName(auth.userId),
      action: 'member.dates',
      summary: `Recorded Masonic dates for ${name}: ${Object.entries(patch)
        .map(([f, v]) => `${LABEL[f as Field]} ${v ?? '(cleared)'}`)
        .join(', ')}`,
      entityType: 'tenant_member',
      entityId: null,
      detail: patch,
    })

    return NextResponse.json({ success: true, dates: updated })
  } catch (error: any) {
    console.error('Save Masonic dates error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
