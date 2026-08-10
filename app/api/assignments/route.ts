import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole, requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { sendAssignmentEmail, sendAssignmentSubmittedEmail, sendAssignmentDeclinedEmail } from '@/lib/email'
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

/**
 * Submitting, signing off, sending back, and withdrawing.
 *
 * THE SHAPE OF THIS IS THE FEATURE. Before, a brother ticked a task and
 * it was simply done, and a curriculum step could only be signed off by
 * an officer with the candidate having no way to say he was ready.
 * Neither told anybody anything.
 *
 *   submit   the brother says he has done it. His claim, not the fact.
 *   signoff  an officer accepts it. THIS is completion.
 *   decline  an officer sends it back with a reason, and the brother is
 *            told. The row is not deleted and nothing is marked done —
 *            he needs to see that it was refused and why.
 *
 * A brother can never sign off his own work, whether it is a
 * proficiency or a task. That is not configuration; it is the point.
 *
 * Where completion LIVES is unchanged: a plain task completes on the
 * assignment row, a curriculum step in curriculum_progress. Submitting
 * is a third fact and gets its own column, so the three cannot be
 * confused for one another.
 */
export async function PATCH(request: Request) {
  try {
    const { tenantId, assignmentId, action, note } = await request.json()
    if (!tenantId || !assignmentId) {
      return NextResponse.json({ error: 'Missing tenantId or assignmentId.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const { data: assignment } = await supabase
      .from('assignments')
      .select('id, assigned_to, assigned_by, step_id, title, completed_at, submitted_at, profiles:assigned_to(first_name, last_name, email)')
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json({ error: 'No such assignment in this lodge.' }, { status: 404 })
    }

    const a = assignment as any
    const mine = a.assigned_to === user.id
    const brother = a.profiles
    const brotherName = `${brother?.first_name ?? ''} ${brother?.last_name ?? ''}`.trim() || 'A brother'

    const brandFor = async () => {
      const { data: tenant } = await supabase
        .from('tenants').select(LODGE_BRAND_COLUMNS).eq('id', tenantId).maybeSingle()
      return {
        lodgeName: tenant ? `${(tenant as any).name} #${(tenant as any).number}` : 'your lodge',
        brand: tenant ? toLodgeBrand(tenant) : undefined,
      }
    }

    // ── The brother says he has done it ──
    if (action === 'submit' || action === 'unsubmit') {
      if (!mine) {
        return NextResponse.json(
          { error: 'Only the brother it was given to can say he has done it.' },
          { status: 403 }
        )
      }

      if (action === 'unsubmit') {
        await supabase.from('assignments')
          .update({ submitted_at: null })
          .eq('id', assignmentId).eq('tenant_id', tenantId)
        return NextResponse.json({ success: true, submitted: false })
      }

      const { error } = await supabase
        .from('assignments')
        .update({
          submitted_at: new Date().toISOString(),
          // A resubmission is a fresh claim, not an argument with the
          // last refusal.
          declined_at: null,
          decline_note: null,
          declined_by_name: null,
        })
        .eq('id', assignmentId)
        .eq('tenant_id', tenantId)

      if (error) throw error

      /**
       * Tell the officer who gave it to him. Best effort — the
       * submission has happened and is correct whether or not the mail
       * gets through, and a brother must never be told his proficiency
       * failed to register because an inbox was full.
       */
      let emailed = false
      if (a.assigned_by) {
        try {
          const { data: officer } = await supabase
            .from('profiles').select('first_name, email').eq('id', a.assigned_by).maybeSingle()

          if ((officer as any)?.email) {
            const { lodgeName, brand } = await brandFor()
            await sendAssignmentSubmittedEmail({
              to: (officer as any).email,
              officerFirstName: (officer as any).first_name || 'Brother',
              brotherName,
              lodgeName,
              title: a.title,
              isDegreeWork: !!a.step_id,
              reviewUrl: `${APP_URL}/lodge/${(await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()).data?.slug ?? ''}/assignments`,
              brand,
            })
            emailed = true
          }
        } catch (mailErr: any) {
          console.error('Submission notice failed:', mailErr?.message)
        }
      }

      return NextResponse.json({
        success: true,
        submitted: true,
        emailed,
        message: emailed
          ? 'Sent for sign-off. The officer who asked you has been told.'
          : 'Sent for sign-off.',
      })
    }

    // ── An officer decides ──
    if (action === 'signoff' || action === 'decline') {
      const officer = await requireTenantAdmin(tenantId)
      if (!officer.ok) return officer.response

      /**
       * Not his own, ever. A Deacon working toward his own Master Mason
       * degree is an ordinary situation, not an exotic one, and the
       * whole meaning of a proficiency is that somebody else heard it.
       */
      if (mine) {
        return NextResponse.json(
          { error: 'You cannot sign off your own work. Another officer must hear it.' },
          { status: 403 }
        )
      }

      const officerName = await actorName(officer.userId)

      if (action === 'decline') {
        const { error } = await supabase
          .from('assignments')
          .update({
            declined_at: new Date().toISOString(),
            declined_by_name: officerName,
            decline_note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null,
            // Cleared: he is no longer waiting on anybody, the ball is
            // back with him.
            submitted_at: null,
            completed_at: null,
          })
          .eq('id', assignmentId)
          .eq('tenant_id', tenantId)

        if (error) throw error

        if (brother?.email) {
          try {
            const { lodgeName, brand } = await brandFor()
            await sendAssignmentDeclinedEmail({
              to: brother.email,
              firstName: brother.first_name || 'Brother',
              lodgeName,
              title: a.title,
              note: typeof note === 'string' && note.trim() ? note.trim() : null,
              officerName,
              portalUrl: `${APP_URL}/portal/assignments`,
              brand,
            })
          } catch (mailErr: any) {
            console.error('Decline notice failed:', mailErr?.message)
          }
        }

        await recordAudit({
          tenantId,
          actorId: officer.userId,
          actorName: officerName,
          action: 'assignment.declined',
          summary: `Sent "${a.title}" back to ${brotherName}`,
          entityType: 'assignment',
          entityId: assignmentId,
          detail: { note: note ?? null },
        })

        return NextResponse.json({ success: true, declined: true })
      }

      /**
       * SIGN-OFF WRITES TO WHICHEVER PLACE OWNS THE ANSWER.
       *
       * Degree work completes in curriculum_progress, where it has
       * always lived and where the Degrees page reads it. A plain task
       * completes on the assignment row. Writing both would give the
       * lodge two records of one fact.
       */
      if (a.step_id) {
        const { error } = await supabase
          .from('curriculum_progress')
          .upsert(
            {
              tenant_id: tenantId,
              member_id: a.assigned_to,
              step_id: a.step_id,
              completed_on: new Date().toISOString().slice(0, 10),
              signed_off_by: officer.userId,
              signed_off_by_name: officerName,
            },
            { onConflict: 'member_id,step_id' }
          )
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('assignments')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', assignmentId)
          .eq('tenant_id', tenantId)
        if (error) throw error
      }

      // Either way the claim has been answered, and any old refusal is
      // no longer the current state of things.
      await supabase.from('assignments')
        .update({ submitted_at: null, declined_at: null, decline_note: null, declined_by_name: null })
        .eq('id', assignmentId).eq('tenant_id', tenantId)

      await recordAudit({
        tenantId,
        actorId: officer.userId,
        actorName: officerName,
        action: 'assignment.signed_off',
        summary: `Signed off "${a.title}" for ${brotherName}`,
        entityType: 'assignment',
        entityId: assignmentId,
        detail: { degreeWork: !!a.step_id },
      })

      return NextResponse.json({ success: true, signedOff: true })
    }

    // ── Withdrawn by an officer ──
    if (action === 'cancel') {
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

    return NextResponse.json(
      { error: `Unknown action "${action}". Expected submit, signoff, decline or cancel.` },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Update assignment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
