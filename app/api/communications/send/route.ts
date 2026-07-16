import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { sendLodgeNoticeEmail } from '@/lib/email'

/**
 * Sends a lodge-wide notice and records it in `communications`.
 *
 * Originally, the Communications page inserted directly into the
 * `communications` table from the client and displayed "✓ NOTICE SENT
 * SUCCESSFULLY" immediately after — no email was ever sent. This route
 * is the fix: it resolves the recipient group to real member emails,
 * actually sends via Resend, and only then records the result.
 */
export async function POST(request: Request) {
  try {
    const { tenantId, subject, body, recipientGroup } = await request.json()

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const { data: tenant } = await supabase.from('tenants').select('name, number').eq('id', tenantId).single()
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { data: sender } = await supabase.from('profiles').select('first_name, last_name').eq('id', auth.userId).single()
    const sentByName = sender ? `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() : undefined

    // Resolve recipient_group to an actual filtered member list. Same
    // four group values as the `recipient_group` check constraint in
    // schema.sql and the RecipientGroup type.
    let query = supabase
      .from('tenant_members')
      .select('user_id, dues_status, degree, profiles(first_name, email)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    if (recipientGroup === 'mm_only') query = query.eq('degree', 'MM')
    if (recipientGroup === 'candidates') query = query.in('degree', ['EA', 'FC'])
    if (recipientGroup === 'dues_outstanding') query = query.eq('dues_status', 'due')

    const { data: recipients } = await query

    const lodgeName = `${tenant.name} #${tenant.number}`
    let sent = 0
    let failed = 0

    for (const r of recipients ?? []) {
      const profile = (r as any).profiles
      if (!profile?.email) { failed++; continue }
      try {
        await sendLodgeNoticeEmail({
          to: profile.email,
          firstName: profile.first_name ?? 'Brother',
          lodgeName,
          subject,
          body,
          sentByName,
        })
        sent++
      } catch {
        failed++
      }
    }

    const { data: comm } = await serviceClient
      .from('communications')
      .insert({
        tenant_id: tenantId,
        subject,
        body,
        recipient_group: recipientGroup || 'all',
        sent_by: auth.userId,
        is_draft: false,
        sent_at: new Date().toISOString(),
      })
      .select('*, profiles(first_name, last_name)')
      .single()

    return NextResponse.json({
      success: sent > 0,
      sent,
      failed,
      total: recipients?.length ?? 0,
      communication: comm,
    })
  } catch (error: any) {
    console.error('Send communication error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
