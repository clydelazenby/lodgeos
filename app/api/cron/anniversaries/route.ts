import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCronSecret } from '@/lib/auth/requireCronSecret'
import { sendServiceAnniversaryEmail } from '@/lib/email'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'
import { anniversariesInMonth, SERVICE_MILESTONES } from '@/lib/anniversaries'
import { recordAudit } from '@/lib/audit'

/**
 * Congratulates brethren on their years of service.
 *
 * Runs daily like the dues ladder, from the same scheduler and behind
 * the same CRON_SECRET header (see /api/cron/dues-reminders for the
 * Vercel setup notes, which apply identically here).
 *
 * WHY DAILY FOR A MONTHLY EVENT. The job is idempotent per brother per
 * year, so running it every day costs one query and sends nothing on
 * the other twenty-nine. Running it monthly would mean a single firing
 * that, if it failed or the deploy was mid-flight, silently skipped
 * every anniversary that month with nobody the wiser until someone
 * complained a year later.
 *
 * WHY THE WHOLE MONTH AND NOT THE DAY. A lodge meets once or twice a
 * month and a fiftieth year is announced at the meeting nearest it, not
 * on the date. Sending on the exact day would produce a private email
 * nobody else hears about, which is the opposite of the point — the
 * lodge's own list is the more important half of this, and the officers
 * get that from the dashboard widget at the start of the month.
 *
 * WHO IS WRITTEN TO. Active brethren with an email address and a
 * recorded raising date. A brother who has come off the roster is not
 * congratulated on his service to a lodge he has left, and a deceased
 * brother is emphatically not written to — both fall out naturally
 * because is_active is false for each.
 */

// Below this, a note is a pleasant surprise; above it, it reads as spam
// generated on a schedule. A brother raised last year does not need an
// email about it.
const MIN_YEARS_FOR_A_NOTE = 5

export const maxDuration = 60

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request)
  if (unauthorized) return unauthorized

  const supabase = createServiceClient()
  const today = new Date()
  const year = today.getFullYear()

  const { data: tenants } = await supabase.from('tenants').select(LODGE_BRAND_COLUMNS + ', id')

  let sent = 0
  let skipped = 0
  const failures: { email: string; reason: string }[] = []

  for (const tenant of tenants ?? []) {
    const tenantId = (tenant as any).id

    const { data: members } = await supabase
      .from('tenant_members')
      .select('user_id, raised_date, profiles(first_name, last_name, email)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('raised_date', 'is', null)

    const due = anniversariesInMonth((members ?? []) as any, today)
      .filter((a) => a.years >= MIN_YEARS_FOR_A_NOTE)
      .filter((a) => a.email)

    for (const anniversary of due) {
      const kind = anniversary.milestone ? String(anniversary.milestone) : 'anniversary'

      /**
       * The unique constraint does the remembering.
       *
       * Inserted BEFORE the send, not after, and this is the one place
       * in the app where that is the right order. If the insert wins
       * and the send then fails, one brother misses a note this year —
       * a small loss. If it were the other way round and the process
       * died between the two, the next daily run would send again, and
       * a man would get the same fiftieth-year letter every morning for
       * a month. The failure modes are not symmetrical.
       */
      const { error: claimError } = await supabase
        .from('milestone_notices')
        .insert({ tenant_id: tenantId, member_id: anniversary.memberId, kind, year })

      if (claimError) {
        // Almost certainly the unique violation, which means it has
        // already gone out this year. That is the normal path on
        // twenty-nine days out of thirty.
        skipped++
        continue
      }

      try {
        await sendServiceAnniversaryEmail({
          to: anniversary.email as string,
          firstName: anniversary.name.split(' ')[0] || 'Brother',
          lodgeName: `${(tenant as any).name} #${(tenant as any).number}`,
          years: anniversary.years,
          raisedDateLabel: new Date(anniversary.raisedDate + 'T12:00:00').toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          }),
          milestone: anniversary.milestone !== null,
          brand: toLodgeBrand(tenant),
        })
        sent++

        if (anniversary.milestone) {
          await recordAudit({
            tenantId,
            action: 'member.milestone',
            summary: `${anniversary.name} reached ${anniversary.milestone} years since his raising`,
            entityType: 'tenant_member',
            entityId: null,
            detail: { years: anniversary.years, raisedDate: anniversary.raisedDate },
          })
        }
      } catch (error: any) {
        failures.push({
          email: anniversary.email as string,
          reason: error?.message ?? 'unknown mail error',
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    month: today.toISOString().slice(0, 7),
    sent,
    alreadySent: skipped,
    failed: failures.length,
    failures,
    milestonesWatched: SERVICE_MILESTONES,
  })
}
