import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { DEGREE_VALUES, degreeLabel } from '@/lib/degrees'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * A brother's particulars, edited where you are already looking at him.
 *
 * His office was only ever settable from a dropdown in the roster
 * table, his degree likewise, and his address and date of birth were
 * not settable anywhere at all — they arrived with the import or they
 * did not. So the Secretary opened a man's profile, found everything
 * he wanted to correct displayed as plain text, and had to go back to
 * a table to change two of the six.
 *
 * WHAT THIS DOES NOT TOUCH, deliberately:
 *
 * - EMAIL. It is his sign-in. Changing it here would lock him out of
 *   the account with no warning and no way for him to discover why, and
 *   the fix would be a support request to somebody with database
 *   access. If a brother's address is wrong he needs a new invitation,
 *   which is a different act with a different consequence.
 * - platform_role, tenant_role, membership_status. Each is a permission
 *   or a status with its own route, its own guard and its own audit
 *   line. Folding them into a general "save details" would let one
 *   careless form post change what a man is allowed to do.
 *
 * Fields are picked one at a time out of the body below rather than
 * spread onto the row, so a column that is not on this list cannot be
 * written by adding it to the request.
 *
 * Secretary's office — the 'roster' capability, same as the Masonic
 * dates route next door, and delegable to whoever actually keeps the
 * register.
 */

const MEMBER_FIELDS = ['degree', 'lodge_role', 'dues_status', 'joined_date'] as const
const PROFILE_FIELDS = ['first_name', 'last_name', 'phone', 'address', 'city', 'state', 'zip', 'date_of_birth'] as const

const LABEL: Record<string, string> = {
  degree: 'degree',
  lodge_role: 'office',
  dues_status: 'dues status',
  joined_date: 'member since',
  first_name: 'first name',
  last_name: 'last name',
  phone: 'phone',
  address: 'address',
  city: 'city',
  state: 'state',
  zip: 'ZIP',
  date_of_birth: 'date of birth',
}

const DUES_STATUSES = new Set(['paid', 'due', 'exempt'])
const MAX: Record<string, number> = {
  first_name: 80, last_name: 80, phone: 40, address: 200,
  city: 80, state: 40, zip: 20, lodge_role: 80,
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** '' clears a text field to null; anything else is trimmed. */
function text(value: unknown, max: number): string | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  if (!t) return null
  return t.length > max ? undefined : t
}

function date(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  return DATE.test(value) ? value : undefined
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, memberId, fields } = body

    if (!tenantId || !memberId || typeof fields !== 'object' || fields === null) {
      return NextResponse.json({ error: 'Missing tenantId, memberId or fields.' }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'roster')
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    const { data: current } = await supabase
      .from('tenant_members')
      .select('id, degree, lodge_role, dues_status, joined_date, is_active, profiles(first_name, last_name, phone, address, city, state, zip, date_of_birth)')
      .eq('tenant_id', tenantId)
      .eq('user_id', memberId)
      .maybeSingle()

    if (!current) {
      return NextResponse.json({ error: 'No such brother on this roster.' }, { status: 404 })
    }

    const memberPatch: Record<string, any> = {}
    const profilePatch: Record<string, any> = {}
    const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 })

    for (const field of MEMBER_FIELDS) {
      if (!(field in fields)) continue
      const raw = (fields as any)[field]

      if (field === 'degree') {
        if (typeof raw !== 'string' || !DEGREE_VALUES.includes(raw)) {
          return bad(`'${raw}' is not a degree this app knows.`)
        }
        memberPatch.degree = raw
      } else if (field === 'dues_status') {
        if (typeof raw !== 'string' || !DUES_STATUSES.has(raw)) {
          return bad(`'${raw}' is not a dues status.`)
        }
        memberPatch.dues_status = raw
      } else if (field === 'joined_date') {
        const v = date(raw)
        if (v === undefined) return bad('Member since must be a date in YYYY-MM-DD form, or empty.')
        memberPatch.joined_date = v
      } else {
        const v = text(raw, MAX.lodge_role)
        if (v === undefined) return bad(`That office is too long — ${MAX.lodge_role} characters at most.`)
        memberPatch.lodge_role = v
      }
    }

    for (const field of PROFILE_FIELDS) {
      if (!(field in fields)) continue
      const raw = (fields as any)[field]

      if (field === 'date_of_birth') {
        const v = date(raw)
        if (v === undefined) return bad('Date of birth must be a date in YYYY-MM-DD form, or empty.')
        profilePatch.date_of_birth = v
      } else {
        const v = text(raw, MAX[field])
        if (v === undefined) return bad(`That ${LABEL[field]} is too long — ${MAX[field]} characters at most.`)
        profilePatch[field] = v
      }
    }

    /**
     * A man must keep a name. Everything else may be blank — plenty of
     * lodges hold nothing but a name and a degree for their oldest
     * members — but a roster row rendering as an empty link is not a
     * record of anybody.
     */
    for (const field of ['first_name', 'last_name'] as const) {
      if (field in profilePatch && !profilePatch[field]) {
        return bad(`A brother needs a ${LABEL[field]}.`)
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    if (memberPatch.joined_date && memberPatch.joined_date > today) {
      return bad(`He cannot have joined on ${memberPatch.joined_date}, which has not happened yet.`)
    }
    if (profilePatch.date_of_birth && profilePatch.date_of_birth > today) {
      return bad(`A date of birth in the future (${profilePatch.date_of_birth}) is not a record of anything.`)
    }

    if (!Object.keys(memberPatch).length && !Object.keys(profilePatch).length) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
    }

    // What actually differs, computed BEFORE the write so the audit line
    // can name it. A summary reading "details updated" tells whoever
    // reads the trail next year nothing they could act on.
    const before: Record<string, any> = {
      ...(current as any),
      ...((current as any).profiles ?? {}),
    }
    const changed: string[] = []
    for (const [field, value] of Object.entries({ ...memberPatch, ...profilePatch })) {
      const was = before[field] ?? null
      if ((was ?? null) !== (value ?? null)) changed.push(field)
    }

    if (Object.keys(memberPatch).length) {
      const { error } = await supabase
        .from('tenant_members')
        .update(memberPatch)
        .eq('tenant_id', tenantId)
        .eq('user_id', memberId)
      if (error) throw error
    }

    if (Object.keys(profilePatch).length) {
      const { error } = await supabase
        .from('profiles')
        .update(profilePatch)
        .eq('id', memberId)
      if (error) throw error
    }

    const p = (current as any).profiles
    const name =
      `${profilePatch.first_name ?? p?.first_name ?? ''} ${profilePatch.last_name ?? p?.last_name ?? ''}`.trim() ||
      'a brother'

    if (changed.length) {
      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: await actorName(auth.userId),
        action: 'member.details',
        summary:
          `Updated ${name}'s ${changed.map((f) => LABEL[f] ?? f).join(', ')}` +
          (memberPatch.degree ? ` — now recorded as ${degreeLabel(memberPatch.degree)}` : '') +
          (changed.includes('lodge_role')
            ? ` — office now ${memberPatch.lodge_role ?? 'none'}`
            : ''),
        entityType: 'tenant_member',
        entityId: (current as any).id,
        detail: { changed, member: memberPatch, profile: profilePatch },
      })
    }

    /**
     * TWO MEN IN ONE CHAIR is a warning, not a refusal.
     *
     * The Lodge Room seats by lodge_role and would sit them both down,
     * so it is worth saying out loud. But refusing it would make an
     * ordinary handover impossible: moving the Senior Deacon up to
     * Junior Warden means two men briefly hold the same office, and an
     * officer part-way through that is not making a mistake.
     */
    let warning: string | null = null
    if ('lodge_role' in memberPatch && memberPatch.lodge_role) {
      const { data: others } = await supabase
        .from('tenant_members')
        .select('user_id, profiles(first_name, last_name)')
        .eq('tenant_id', tenantId)
        .eq('lodge_role', memberPatch.lodge_role)
        .eq('is_active', true)
        .neq('user_id', memberId)

      const names = (others ?? [])
        .map((o: any) => `${o.profiles?.first_name ?? ''} ${o.profiles?.last_name ?? ''}`.trim())
        .filter(Boolean)

      if (names.length) {
        warning =
          `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} also recorded as ` +
          `${memberPatch.lodge_role}. The Lodge Room will seat them all — and anything ` +
          `given to that office now reaches ${names.length > 1 ? 'each of them' : 'him'} too.`
      }
    }

    return NextResponse.json({ success: true, changed, warning })
  } catch (error: any) {
    console.error('Save member details error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
