import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin, requireTenantRole } from '@/lib/auth/requireTenantAdmin'
import { recordAudit, actorName } from '@/lib/audit'
import { CURRICULUM_DEGREES, STARTER_OUTLINE, type CurriculumDegree } from '@/lib/curriculum'

/**
 * Defining a degree's work, and recording who has done it.
 *
 * Two different acts with two different guards:
 *
 * - Writing the curriculum is setting lodge policy, so it is the
 *   Secretary's office (and the Master).
 * - Signing off a candidate's step is mentor work, which every seated
 *   officer does — requireTenantAdmin has covered wardens and deacons
 *   since 022, and a Deacon is very often the man actually hearing the
 *   catechism.
 *
 * A candidate can never sign off his own step. That is not a
 * configuration choice; it is the point of a proficiency.
 */

const MAX_STEPS_PER_DEGREE = 60

function isDegree(value: unknown): value is CurriculumDegree {
  return typeof value === 'string' && CURRICULUM_DEGREES.includes(value)
}

/** Create a step, or lay down the starter outline for a whole degree. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, degree, action } = body

    if (!tenantId || !isDegree(degree)) {
      return NextResponse.json({ error: 'That is not a degree this app knows.' }, { status: 400 })
    }

    const auth = await requireTenantRole(tenantId, [
      'admin', 'secretary', 'grand_master', 'worshipful_master',
    ])
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { count } = await supabase
      .from('curriculum_steps')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('degree', degree)

    const existing = count ?? 0

    if (action === 'seed') {
      /**
       * Only onto an empty degree. Laying the outline over an existing
       * curriculum would duplicate every step, and the officer who
       * clicks this a second time by accident is exactly the person who
       * would not notice until a candidate saw fourteen items.
       */
      if (existing > 0) {
        return NextResponse.json(
          { error: `The ${degree} curriculum already has ${existing} steps. Clear them first if you want to start again from the outline.` },
          { status: 400 }
        )
      }

      /**
       * Only the Blue Lodge has an outline. Beyond the third degree the
       * app has no business inventing what the Scottish Rite requires —
       * those steps are written by the lodge or not written.
       */
      const outline = STARTER_OUTLINE[degree]
      if (!outline) {
        return NextResponse.json(
          { error: `There is no standard outline for ${degree} — the app does not presume to know what the appendant bodies require. Add the steps yourself.` },
          { status: 400 }
        )
      }

      const rows = outline.map((s, i) => ({
        tenant_id: tenantId,
        degree,
        title: s.title,
        description: s.description,
        required: s.required,
        sort_order: (i + 1) * 10,
      }))

      const { data, error } = await supabase.from('curriculum_steps').insert(rows).select()
      if (error) throw error

      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: await actorName(auth.userId),
        action: 'curriculum.seeded',
        summary: `Started the ${degree} curriculum from the standard outline (${rows.length} steps)`,
        entityType: 'curriculum',
      })

      return NextResponse.json({ success: true, steps: data })
    }

    // Otherwise: a single new step.
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'A step needs a title.' }, { status: 400 })

    if (existing >= MAX_STEPS_PER_DEGREE) {
      return NextResponse.json(
        { error: `A degree can hold ${MAX_STEPS_PER_DEGREE} steps. That is already far more than any jurisdiction asks for.` },
        { status: 400 }
      )
    }

    // Sorted in tens so a step can later be dropped between two others
    // without renumbering the whole list.
    const { data: last } = await supabase
      .from('curriculum_steps')
      .select('sort_order')
      .eq('tenant_id', tenantId)
      .eq('degree', degree)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('curriculum_steps')
      .insert({
        tenant_id: tenantId,
        degree,
        title: title.slice(0, 200),
        description: typeof body.description === 'string' && body.description.trim()
          ? body.description.trim().slice(0, 1000)
          : null,
        document_id: body.documentId || null,
        required: body.required !== false,
        sort_order: ((last as any)?.sort_order ?? 0) + 10,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, step: data })
  } catch (error: any) {
    console.error('Curriculum create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Edit a step, or move it up or down. */
export async function PATCH(request: Request) {
  try {
    const { tenantId, stepId, title, description, documentId, required, move } = await request.json()
    if (!tenantId || !stepId) {
      return NextResponse.json({ error: 'Missing tenantId or stepId.' }, { status: 400 })
    }

    const auth = await requireTenantRole(tenantId, [
      'admin', 'secretary', 'grand_master', 'worshipful_master',
    ])
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { data: step } = await supabase
      .from('curriculum_steps')
      .select('id, degree, sort_order')
      .eq('id', stepId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!step) return NextResponse.json({ error: 'No such step in this lodge.' }, { status: 404 })

    /**
     * Reordering swaps sort_order with the neighbour rather than
     * rewriting the whole list. Two rows change; everything else is
     * untouched, so two officers reordering different parts of the same
     * curriculum cannot clobber each other's work.
     */
    if (move === 'up' || move === 'down') {
      const { data: neighbour } = await supabase
        .from('curriculum_steps')
        .select('id, sort_order')
        .eq('tenant_id', tenantId)
        .eq('degree', (step as any).degree)
        [move === 'up' ? 'lt' : 'gt']('sort_order', (step as any).sort_order)
        .order('sort_order', { ascending: move !== 'up' })
        .limit(1)
        .maybeSingle()

      // Already at the end of the list. Not an error — the button simply
      // had nothing to do.
      if (!neighbour) return NextResponse.json({ success: true, moved: false })

      await supabase.from('curriculum_steps')
        .update({ sort_order: (neighbour as any).sort_order })
        .eq('id', stepId).eq('tenant_id', tenantId)
      await supabase.from('curriculum_steps')
        .update({ sort_order: (step as any).sort_order })
        .eq('id', (neighbour as any).id).eq('tenant_id', tenantId)

      return NextResponse.json({ success: true, moved: true })
    }

    const patch: Record<string, any> = {}
    if (typeof title === 'string' && title.trim()) patch.title = title.trim().slice(0, 200)
    if (description !== undefined) {
      patch.description = typeof description === 'string' && description.trim()
        ? description.trim().slice(0, 1000)
        : null
    }
    if (documentId !== undefined) patch.document_id = documentId || null
    if (required !== undefined) patch.required = !!required

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('curriculum_steps')
      .update(patch)
      .eq('id', stepId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, step: data })
  } catch (error: any) {
    console.error('Curriculum update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { tenantId, stepId } = await request.json()
    if (!tenantId || !stepId) {
      return NextResponse.json({ error: 'Missing tenantId or stepId.' }, { status: 400 })
    }

    const auth = await requireTenantRole(tenantId, [
      'admin', 'secretary', 'grand_master', 'worshipful_master',
    ])
    if (!auth.ok) return auth.response

    const supabase = await createClient()
    const { error } = await supabase
      .from('curriculum_steps')
      .delete()
      .eq('id', stepId)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Curriculum delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Signing a candidate off a step, or taking the sign-off back.
 *
 * PUT rather than POST because it is idempotent: signing off a step
 * that is already signed off is not an error and must not create a
 * second row. The unique constraint on (member_id, step_id) enforces
 * that at the database, and this upserts against it.
 */
export async function PUT(request: Request) {
  try {
    const { tenantId, memberId, stepId, completed, completedOn, notes } = await request.json()
    if (!tenantId || !memberId || !stepId) {
      return NextResponse.json({ error: 'Missing tenantId, memberId or stepId.' }, { status: 400 })
    }

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    /**
     * A man cannot sign off his own proficiency.
     *
     * Refused here rather than left to custom, because the whole
     * meaning of a proficiency is that somebody else heard it. An
     * officer who is also a candidate is not a strange case — a Deacon
     * working toward his Master Mason degree is ordinary.
     */
    if (memberId === auth.userId) {
      return NextResponse.json(
        { error: 'A brother cannot sign off his own step. Another officer must hear it.' },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    const { data: step } = await supabase
      .from('curriculum_steps')
      .select('id, title, degree')
      .eq('id', stepId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!step) return NextResponse.json({ error: 'No such step in this lodge.' }, { status: 404 })

    if (completed === false) {
      const { error } = await supabase
        .from('curriculum_progress')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('member_id', memberId)
        .eq('step_id', stepId)
      if (error) throw error
      return NextResponse.json({ success: true, completed: false })
    }

    const name = await actorName(auth.userId)

    const { data, error } = await supabase
      .from('curriculum_progress')
      .upsert(
        {
          tenant_id: tenantId,
          member_id: memberId,
          step_id: stepId,
          completed_on:
            typeof completedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(completedOn)
              ? completedOn
              : new Date().toISOString().slice(0, 10),
          signed_off_by: auth.userId,
          signed_off_by_name: name,
          notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : null,
        },
        { onConflict: 'member_id,step_id' }
      )
      .select()
      .single()

    if (error) throw error

    await recordAudit({
      tenantId,
      actorId: auth.userId,
      actorName: name,
      action: 'curriculum.signed_off',
      summary: `Signed off "${(step as any).title}" (${(step as any).degree}) for a candidate`,
      entityType: 'curriculum_progress',
      entityId: (data as any).id,
      detail: { memberId, stepId },
    })

    return NextResponse.json({ success: true, completed: true, progress: data })
  } catch (error: any) {
    console.error('Curriculum sign-off error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
