import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPasswordResetEmail, APP_URL } from '@/lib/email'
import { withTimeout } from '@/lib/auth/inviteLink'

/**
 * Password reset. Public and unauthenticated by definition — someone
 * who could authenticate would not need this.
 *
 * TWO RULES GOVERN THIS ROUTE.
 *
 * 1. IT ALWAYS ANSWERS THE SAME WAY. Whether the address belongs to a
 *    brother, belongs to nobody, or was throttled, the response is an
 *    identical success. Anything else turns this endpoint into a
 *    membership oracle: type addresses, watch which ones come back
 *    "not found", and you have learned who is in this lodge. That is
 *    worth protecting for a fraternal roster, and it costs nothing to
 *    protect. The only failures reported are ones the caller can see
 *    for themselves anyway — a malformed address, or the server
 *    breaking.
 *
 * 2. IT SENDS THROUGH RESEND. generateLink mints the recovery token
 *    without sending anything, exactly as the invitation flow does,
 *    and the lodge delivers it from its own verified domain. Supabase's
 *    built-in mailer is the reason invitations silently never arrived;
 *    a reset nobody receives would be that same bug again.
 */

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ADMIN_CALL_TIMEOUT_MS = 8_000

/**
 * A brother who does not see the email immediately will press the
 * button again, and should get another one — so this is short. It
 * exists to stop an unauthenticated endpoint being used to flood
 * somebody's inbox, not to make a genuine retry wait.
 */
const THROTTLE_SECONDS = 60

/** Matches Supabase's default recovery token lifetime; used for copy only. */
const LINK_EXPIRY_MINUTES = 60

export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !EMAIL_SHAPE.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, email, last_password_reset_at')
      .eq('email', email)
      .maybeSingle()

    // No account. Answer exactly as if there were one.
    if (!profile) {
      return NextResponse.json({ success: true })
    }

    if (profile.last_password_reset_at) {
      const elapsedMs = Date.now() - new Date(profile.last_password_reset_at).getTime()
      if (elapsedMs < THROTTLE_SECONDS * 1000) {
        // Throttled. Same answer again — telling the caller they are
        // being throttled confirms the address exists.
        return NextResponse.json({ success: true })
      }
    }

    const link = await withTimeout(
      supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${APP_URL}/auth/callback` },
      }),
      ADMIN_CALL_TIMEOUT_MS,
      'Supabase Auth'
    )

    const hashedToken = link.data?.properties?.hashed_token
    if (link.error || !hashedToken) {
      // Nothing the person who asked can do about this, and saying so
      // would leak that the address is real. Log it and answer the
      // same as always.
      console.error('Password reset link could not be generated:', link.error?.message ?? 'no token returned')
      return NextResponse.json({ success: true })
    }

    // Verified by our own callback rather than GoTrue's /verify, which
    // would hand the session back in a URL fragment the server never
    // sees. mode=reset only changes the wording on the page.
    const resetUrl =
      `${APP_URL}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}` +
      `&type=recovery&next=${encodeURIComponent('/auth/set-password?mode=reset')}`

    // Stamped BEFORE sending: if the send is slow or fails, the
    // throttle should still have taken effect. Its job is to bound how
    // often this endpoint can be made to send, not to record success.
    await supabase
      .from('profiles')
      .update({ last_password_reset_at: new Date().toISOString() })
      .eq('id', profile.id)

    try {
      await sendPasswordResetEmail({
        to: email,
        firstName: profile.first_name,
        resetUrl,
        expiresInMinutes: LINK_EXPIRY_MINUTES,
      })
    } catch (mailErr: any) {
      console.error('Password reset email failed:', mailErr?.message)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Forgot password error:', error)
    // Even an unexpected failure answers the same way, so a crash on
    // one branch and not another cannot be used to tell real addresses
    // from made-up ones.
    return NextResponse.json({ success: true })
  }
}
