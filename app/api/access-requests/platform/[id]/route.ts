import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  sendLodgeRequestApproved, sendLodgeRequestDeclined, sendLodgeRequestQuestion, APP_URL,
} from '@/lib/email'

/**
 * Deciding on a lodge that has asked to use LodgeOS.
 *
 * SUPER ADMIN ONLY, and checked against the database rather than
 * against anything in the request. This is the platform's own front
 * door: the row it acts on was typed by an anonymous visitor, and the
 * decision made here is who gets to run a lodge on this system.
 *
 * APPROVING DOES NOT CREATE THE LODGE. It records the decision and
 * emails the contact a link to set it up himself. Creating a tenant
 * from an unverified web form would mean a name, a number and a
 * jurisdiction nobody checked becoming a real lodge with a real slug —
 * and the man who typed it owning it. He signs up, he names it, and
 * the onboarding flow that already exists does the rest.
 */

const ACTIONS = new Set(['approve', 'decline', 'question'])

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    const { data: profile } = await service
      .from('profiles').select('platform_role').eq('id', user.id).maybeSingle()

    if ((profile as any)?.platform_role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const action = String(body?.action ?? '')
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 2000) : ''

    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }
    if (action === 'question' && !note) {
      return NextResponse.json(
        { error: 'Say what you need to know — an empty question is worse than none.' },
        { status: 400 }
      )
    }

    const { data: req } = await service
      .from('platform_access_requests').select('*').eq('id', params.id).maybeSingle()

    if (!req) return NextResponse.json({ error: 'That request no longer exists.' }, { status: 404 })

    const r = req as any
    const lodgeName = r.lodge_number ? `${r.lodge_name} #${r.lodge_number}` : r.lodge_name

    /**
     * 'contacted' rather than a decision: asking a question leaves the
     * request open. It has been touched, not settled, and it must stay
     * in the queue — a question that gets no answer is exactly the
     * request that would otherwise be forgotten.
     */
    const status = action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : 'contacted'

    const { error: updateError } = await service
      .from('platform_access_requests')
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq('id', params.id)

    if (updateError) throw updateError

    // Mail is best-effort and reported honestly: the decision is
    // already recorded, and a mail failure must not make a settled
    // request look unsettled.
    let emailed = false
    let warning: string | null = null
    try {
      const common = {
        to: r.contact_email,
        contactName: r.contact_name,
        lodgeName,
      }
      if (action === 'approve') {
        await sendLodgeRequestApproved({ ...common, setupUrl: `${APP_URL}/auth/signup`, note: note || null })
      } else if (action === 'decline') {
        await sendLodgeRequestDeclined({ ...common, note: note || null })
      } else {
        await sendLodgeRequestQuestion({ ...common, question: note })
      }
      emailed = true
    } catch (mailErr: any) {
      warning = `The decision was recorded, but the email to ${r.contact_email} did not send: ${mailErr?.message ?? 'unknown mail error'}`
    }

    return NextResponse.json({ success: true, status, emailed, warning })
  } catch (error: any) {
    console.error('Access request decision error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
