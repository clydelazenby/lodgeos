import { createServiceClient } from '@/lib/supabase/server'
import { recipientsFor, notifyEach } from '@/lib/notifications.server'
import { sendFirstSignInAlert, APP_URL } from '@/lib/email'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'

/**
 * "He got in."
 *
 * THE EVENT NOTHING WAS REPORTING, and the only one that proves an
 * invitation worked. A welcome email that silently fails is invisible:
 * the Secretary believes the brother has been added, the brother never
 * saw anything, and nobody finds out until he turns up at a meeting
 * unable to sign in. Recording the invitation proves only that we tried.
 *
 * WHY A LAYOUT AND NOT THE LOGIN ROUTE. A newly invited brother does
 * not use the login route at all — he arrives on a one-time link minted
 * by lib/auth/inviteLink.ts, which is precisely the case this exists to
 * confirm. Hanging it off the layouts every signed-in person passes
 * through catches every route in, including ones added later.
 *
 * IT RUNS ONCE, EVER, PER BROTHER. The cost is one extra column on a
 * query the layout already makes, and the write is skipped entirely
 * once first_signin_at is set. Only the single page load on which a man
 * first arrives pays for the email.
 */

export async function noteFirstSignIn(tenantId: string, userId: string): Promise<void> {
  try {
    const supabase = createServiceClient()

    /**
     * THE `.is(null)` IN THE FILTER IS THE LOCK.
     *
     * Two tabs opened at once would otherwise both read null, both
     * write, and both send. Making "still null" part of the UPDATE's
     * own WHERE means Postgres settles it: exactly one statement
     * changes a row, and .select() returns rows only to that one. The
     * loser gets an empty array and sends nothing.
     */
    const { data: claimed } = await supabase
      .from('tenant_members')
      .update({ first_signin_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('first_signin_at', null)
      .select('user_id, profiles(first_name, last_name, email)')

    if (!claimed?.length) return

    const row = claimed[0] as any
    const brotherName =
      `${row.profiles?.first_name ?? ''} ${row.profiles?.last_name ?? ''}`.trim() || 'A brother'

    const { data: lodge } = await supabase
      .from('tenants')
      .select(`slug, ${LODGE_BRAND_COLUMNS}`)
      .eq('id', tenantId)
      .maybeSingle()

    if (!lodge) return

    // He is excluded from his own notice — it is written for the
    // officers, about him.
    const recipients = await recipientsFor(tenantId, 'member.first_signin', userId)
    await notifyEach(recipients, (officer) =>
      sendFirstSignInAlert({
        to: officer.email,
        officerName: officer.name,
        lodgeName: `${(lodge as any).name} #${(lodge as any).number}`,
        brotherName,
        brotherEmail: row.profiles?.email ?? '—',
        memberUrl: `${APP_URL}/lodge/${(lodge as any).slug}/members/${userId}`,
        brand: toLodgeBrand(lodge),
      })
    )
  } catch (error) {
    /**
     * Swallowed, like the audit trail and for the same reason: this is
     * called from a LAYOUT. A brother whose first sign-in notice fails
     * must still get his page — throwing here would meet him with an
     * error screen on the one visit that was supposed to prove
     * everything worked.
     */
    console.error('First sign-in notice failed (he is signed in regardless):', error)
  }
}
