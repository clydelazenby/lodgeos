import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCronSecret } from '@/lib/auth/requireCronSecret'
import { sendDuesReminderEmail } from '@/lib/email'

/**
 * Automated dues reminder ladder. Meant to run once daily via an
 * external scheduler (Vercel Cron, Supabase pg_cron + pg_net, etc.)
 * hitting this route with:
 *
 *   Authorization: Bearer <CRON_SECRET>
 *
 * VERCEL CRON SPECIFICALLY: Vercel sends this header automatically for
 * routes triggered by its own Cron Jobs feature, using the value of
 * your project's CRON_SECRET environment variable — but only if that
 * env var is set in the Vercel dashboard AND the route path is declared
 * in vercel.json. If CRON_SECRET is missing from the deployed
 * environment, the cron will still fire but without the expected
 * header, so it will 401 every time. Confirm the env var is set in
 * Vercel's dashboard (not just .env.example) and check the Cron Jobs
 * invocation log after the first scheduled run.
 *
 * Does NOT replace the manual "Send Reminders" button on the dues page
 * (/api/dues/remind) — that stays as an on-demand override. This route
 * is the automatic layer running underneath it.
 *
 * Due date model: a tenant's dues are treated as due on the 1st of
 * `dues_due_month` each year (schema.sql only stores the month, not a
 * day — this doesn't invent day-level precision the schema doesn't have).
 *
 * Thresholds: T-30, T-15, T-7 before the due date; overdue-<YYYY-MM>
 * once per calendar month after.
 *
 * Idempotency: `last_dues_reminder` records which threshold was last
 * sent per member, so running this twice in a day (or the scheduler
 * double-firing) can't double-send.
 */

function daysBetween(a: Date, b: Date) {
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}

function dueDateForTenant(duesMonth: number, today: Date): Date {
  return new Date(today.getFullYear(), (duesMonth ?? 1) - 1, 1)
}

export async function POST(request: Request) {
  const authError = requireCronSecret(request)
  if (authError) return authError

  const supabase = createServiceClient() // no user session exists here — service role is correct, same as the Stripe webhook
  const today = new Date()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lodgeos.com'

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, number, dues_amount, dues_due_month')
    .eq('is_active', true)

  let totalSent = 0
  let totalFailed = 0
  let totalSkipped = 0
  const perTenant: Record<string, { sent: number; failed: number; skipped: number }> = {}

  for (const tenant of tenants ?? []) {
    const dueDate = dueDateForTenant(tenant.dues_due_month, new Date(today))
    const daysUntilDue = daysBetween(new Date(today), new Date(dueDate))

    let threshold: string | null = null
    if (daysUntilDue === 30) threshold = 'T-30'
    else if (daysUntilDue === 15) threshold = 'T-15'
    else if (daysUntilDue === 7) threshold = 'T-7'
    else if (daysUntilDue < 0) threshold = `overdue-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

    if (!threshold) continue

    const { data: members } = await supabase
      .from('tenant_members')
      .select('user_id, dues_status, last_dues_reminder, profiles(first_name, email)')
      .eq('tenant_id', tenant.id)
      .eq('dues_status', 'due')
      .eq('is_active', true)

    const stats = { sent: 0, failed: 0, skipped: 0 }

    for (const m of members ?? []) {
      if (m.last_dues_reminder === threshold) { stats.skipped++; continue }

      const profile = (m as any).profiles
      if (!profile?.email) { stats.failed++; continue }

      try {
        await sendDuesReminderEmail({
          to: profile.email,
          firstName: profile.first_name ?? 'Brother',
          lodgeName: `${tenant.name} #${tenant.number}`,
          amount: tenant.dues_amount,
          year: today.getFullYear(),
          payUrl: `${appUrl}/portal/dues`,
          daysOverdue: daysUntilDue < 0 ? Math.abs(daysUntilDue) : undefined,
        })
        await supabase
          .from('tenant_members')
          .update({ last_dues_reminder: threshold })
          .eq('tenant_id', tenant.id)
          .eq('user_id', m.user_id)
        stats.sent++
      } catch {
        stats.failed++
      }
    }

    perTenant[tenant.id] = stats
    totalSent += stats.sent
    totalFailed += stats.failed
    totalSkipped += stats.skipped
  }

  return NextResponse.json({
    ranAt: today.toISOString(),
    tenantsProcessed: tenants?.length ?? 0,
    totalSent,
    totalFailed,
    totalSkipped,
    perTenant,
  })
}
