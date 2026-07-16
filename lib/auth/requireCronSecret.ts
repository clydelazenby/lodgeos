import { NextResponse } from 'next/server'

/**
 * Authenticates a scheduled-job request via a shared-secret header, not
 * a user session — cron routes run server-to-server with no logged-in
 * user, so requireTenantAdmin() (which expects a Supabase auth cookie)
 * does not apply here.
 *
 * Expects: Authorization: Bearer <CRON_SECRET>
 *
 * Fails closed: if CRON_SECRET is unset, every call is rejected rather
 * than the check being silently skipped.
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const configured = process.env.CRON_SECRET

  if (!configured) {
    console.error('CRON_SECRET is not set — refusing all cron requests until configured.')
    return NextResponse.json({ error: 'Cron endpoint misconfigured' }, { status: 500 })
  }

  const header = request.headers.get('authorization')
  const provided = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (provided !== configured) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
