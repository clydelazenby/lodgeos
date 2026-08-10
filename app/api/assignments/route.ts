import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole, requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { sendAssignmentEmail } from '@/lib/email'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'
import { recordAudit, actorName } from '@/lib/audit'
import { APP_URL } from '@/lib/email/shared'

/**
 * Giving a brother something to do — a single task, or a whole degree
 * plan at once.
 *
 * WHO MAY ASSIGN: the Master, the Secretary and the Wardens, matching
 * the 'assignments' capability. See lib/auth/permissions.ts for why
 * both Wardens are included rather than the Senior Warden alone.
 *
 * WHO MAY COMPLETE depends on what was assigned, and this is the rule
 * the whole feature turns on:
 *
 *   a plain task      — the brother himself. Nobody else can know when
 *                       he has read the bylaws.
 *   a curriculum step — an officer who heard it, and never the
 *                       candidate. That is what a proficiency IS.
 *
 * A curriculum assignment's completion is therefore written to
 * curriculum_progress, not to the assignment row, so the two records
 * cannot disagree about the same fact.
 */

const ASSIGNING_TIERS = ['admin', 'secretary', 'grand_master', 'worshipful_master', 'warden'] as const

/** One brother, one plan, one sitting. Beyond this it is a mistake. */
const MAX_ITEMS_PER_BATCH = 60

export async function POST(request: Request) {
  try {
    const { tenantId, memberId, title, description, dueDate, documentId, degree, notify = true } =
      await request.json()

    if (!tenantId || !memberId) {
      return NextResponse.json({ error: 'Missing tenantId or memberId.' }, { status: 400 })
    }

    const auth = await requireTenantRole(tenantId, [...ASSIGNING_TIERS])
    if (!auth.ok) return auth.response

    const supabase = await createClient()
    const byName = await actorName(auth.userId)

    // The brother must be on THIS roster. Without this a valid profile
    // id from another lodge could be given work by an officer here, and
    // he would receive an email from a lodge he does not belong to.
    const { data: target } = await supabase
      .from('tenant_members')
      .select('user_id, profiles(first_name, last_name, email)')
      .eq('tenant_id', tenantId)
      .eq('user_id', memberId)
      .eq('is_active', true)
      .maybeSingle()

    if (!target) {
      return NextResponse.json({ error: 'That brother is not on this lodge roster.' }, { status: 404 })
    }

    let rows: any[] = []

    if (degree) {
      /**
       * A WHOLE PLAN. Every step of the degree, in order, skipping any
       * he already has — the unique index on (assigned_to, step_id)
       * would reject the batch otherwise, and an officer re-running
       * this to add newly-written steps should get exactly the new
       * ones rather than an error.
       */
      const { data: steps } = await supabase
        .from('curriculum_steps')
        .select('id, title, description, document_id')
        .eq('tenant_id', tenantId)
        .eq('degree', degree)
        .order('sort_order')

      if (!steps?.length) {
        return NextResponse.json(
          { error: `No ${degree} curriculum has been written yet. Set one up under Documents → Degree Curriculum first.` },
          { status: 400 }
        )
      }

      const { data: already } = await supabase
        .from('assignments')
        .select('step_id')
        .eq('tenant_id', tenantId)
        .eq('assigned_to', memberId)
        .not('step_id', 'is', null)

      const have = new Set((already ?? []).map((a: any) => a.step_id))
      const fresh = steps.filter((s: any) => !have.has(s.id))

      if (fresh.length === 0) {
        return NextResponse.json(
          { error: 'He is already on every step of that plan.' },
          { status: 400 }
        )
      }

      rows = fresh.slice(0, MAX_ITEMS_PER_BATCH).map((s: any) => ({
        tenant_id: tenantId,
        assigned_to: memberId,
        assigned_by: auth.userId,
        assigned_by_name: byName,
        title: s.title,
        description: s.description,
        step_id: s.id,
        document_id: s.document_id,
        due_date: dueDate || null,
      }))
    } else {
      if (typeof title !== 'string' || !title.trim()) {
        return NextResponse.json({ error: 'A task needs a title.' }, { status: 400 })
      }
      rows = [{
        tenant_id: tenantId,
        assigned_to: memberId,
        assigned_by: auth.userId,
        assigned_by_name: byName,
        title: title.trim().slice(0, 200),
        description: typeof description === 'string' && description.trim()
          ? description.trim().slice(0, 1000)
          : null,
        document_id: documentId || null,
        due_date: dueDate || null,
      }]
    }

    const { data: created, error } = await supabase.from('assignments').insert(rows).select()
    if (error) throw error

    /**
     * Telling him — ONE email for the batch.
     *
     * Putting a candidate on the Entered Apprentice plan assigns seven
     * steps; seven emails arriving together is how a lodge teaches its
     * brethren to filter its mail.
     *
     * Best effort, and notified_at is only stamped on success, so a
     * failed send stays visibly unsent rather than being assumed
     * delivered. The assignment itself has already happened and is
     * correct either way.
     */
    const p = (target as any).profiles
    let emailed = false
    let emailError: string | undefined

    if (notify && p?.email) {
      try {
        const { data: tenant } = await supabase
          .from('tenants').select(LODGE_BRAND_COLUMNS).eq('id', tenantId).maybeSingle()

        await sendAssignmentEmail({
          to: p.email,
          firstName: p.first_name || 'Brother',
          lodgeName: tenant ? `${(tenant as any).name} #${(tenant as any).number}` : 'your lodge',
          assignedByName: byName,
          items: rows.map((r) => ({ title: r.title, description: r.description })),
          dueDate: dueDate || null,
          portalUrl: `${APP_URL}/portal/assignments`,
          brand: tenant ? toLodgeBrand(tenant) : undefined,
        })
        emailed = true

        const service = createServiceClient()
        await service
          .from('assignments')
          .update({ notified_at: new Date().toISOString() })
          .in('id', (created ?? []).map((c: any) => c.id))
      } catch (mailErr: any) {
        emailError = mailErr?.message || 'unknown mail error'
        console.error('Assignment notice failed:', emailError)
      }
    }

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: byName,
      action: 'assignment.created',
      summary: degree
        ? `Put a brother on the ${degree} plan (${rows.length} ${rows.length === 1 ? 'step' : 'steps'})`
        : `Asked a brother to "${rows[0].title}"`,
      entityType: 'assignment',
      entityId: (created?.[0] as any)?.id ?? null,
      detail: { memberId, count: rows.length, degree: degree || null, emailed },
    })

    return NextResponse.json({
      success: true,
      created: created?.length ?? 0,
      emailed,
      message: `${rows.length} ${rows.length === 1 ? 'item' : 'items'} assigned.` +
        (!notify
          ? ' No email was sent.'
          : !p?.email
            ? ' He has no email address on file, so he was not told.'
            : emailed
              ? ' He has been emailed.'
              : ` He could NOT be emailed: ${emailError}`),
    })
  } catch (error: any) {
    console.error('Create assignment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Mark done, reopen, or withdraw. */
export async function PATCH(request: Request) {
  try {
    const { tenantId, assignmentId, completed, cancel } = await request.json()
    if (!tenantId || !assignmentId) {
      return NextResponse.json({ error: 'Missing tenantId or assignmentId.' }, { status: 400 })
    }

    // Any member may reach this — a brother completing his own task is
    // the ordinary case. Authority is decided per-assignment below.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const { data: assignment } = await supabase
      .from('assignments')
      .select('id, assigned_to, step_id, title, completed_at')
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json({ error: 'No such assignment in this lodge.' }, { status: 404 })
    }

    const mine = (assignment as any).assigned_to === user.id
    const isCurriculum = !!(assignment as any).step_id

    // Withdrawing is the officer's act — a brother cannot cancel work he
    // was asked to do.
    if (cancel) {
      const officer = await requireTenantRole(tenantId, [...ASSIGNING_TIERS])
      if (!officer.ok) return officer.response

      const { error } = await supabase
        .from('assignments')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', assignmentId)
        .eq('tenant_id', tenantId)
      if (error) throw error
      return NextResponse.json({ success: true, cancelled: true })
    }

    /**
     * A CURRICULUM STEP IS NOT COMPLETED HERE.
     *
     * Its completion belongs in curriculum_progress, signed off by an
     * officer who heard it — which is the whole meaning of a
     * proficiency. Sending it to the right door rather than quietly
     * writing a completed_at that would then disagree with the
     * curriculum tracker.
     */
    if (isCurriculum) {
      return NextResponse.json(
        {
          error: mine
            ? 'This is part of your degree work. An officer signs it off once he has heard it — it is not something you can mark done yourself.'
            : 'Sign this off on the Degrees page, where it is recorded against his curriculum.',
        },
        { status: 400 }
      )
    }

    if (!mine) {
      const officer = await requireTenantAdmin(tenantId)
      if (!officer.ok) return officer.response
    }

    const { error } = await supabase
      .from('assignments')
      .update({ completed_at: completed === false ? null : new Date().toISOString() })
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return NextResponse.json({ success: true, completed: completed !== false })
  } catch (error: any) {
    console.error('Update assignment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
