import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * WHY THIS EXISTS — read before changing.
 *
 * Inviting a brother used to call `auth.admin.inviteUserByEmail()`,
 * which does two things at once: it creates the auth user AND asks
 * Supabase to SEND the invitation itself, over Supabase's own mailer.
 * That coupling was the reason no brother ever received an invite:
 *
 * 1. A project without custom SMTP configured falls back to Supabase's
 *    built-in email service, which is rate limited to a couple of
 *    messages an hour and is not intended for production traffic. Once
 *    that limit is hit the call fails — or, when the SMTP host simply
 *    doesn't answer, hangs until the serverless function is killed.
 * 2. It was the FIRST thing awaited in the invite route, so when it
 *    failed the brother was never added to the roster and the lodge's
 *    own welcome email — sent through Resend, from a verified domain
 *    that demonstrably works — was never even attempted.
 *
 * `generateLink` is the fix. It mints exactly the same invitation
 * token, creates the same auth user, and returns the link WITHOUT
 * sending anything. The lodge then delivers that link itself through
 * Resend, which is the path every other email in this app already
 * takes and the only mail path with a verified sending domain.
 *
 * We return the `hashed_token` rather than the raw `action_link`
 * Supabase builds. The action_link points at GoTrue's /verify endpoint,
 * which bounces the brother back with tokens in a URL FRAGMENT (the
 * implicit flow — a server-generated link has no PKCE code verifier).
 * A fragment never reaches the server, so app/auth/callback, which
 * reads `?code=`, would have failed on it. Handing the token_hash to
 * our own callback and calling verifyOtp there keeps the exchange
 * server-side, where the session cookie can actually be written.
 */

/**
 * Supabase Admin calls are given a hard ceiling so a single
 * unresponsive dependency can never consume the whole function budget.
 * Without this the route hangs until the platform kills it, which
 * returns a non-JSON gateway error and leaves the officer staring at a
 * button that says "Sending invitation..." forever.
 */
const ADMIN_CALL_TIMEOUT_MS = 8_000

/** Supabase words this differently across versions and error codes. */
const ALREADY_REGISTERED = /already[ _-]?(been[ _-]?)?(registered|exists)|email_exists|user_already_exists/i

export type InviteLink = {
  /** The auth user, when Supabase returned one. */
  userId: string | null
  /** Ready-to-click URL for the welcome email, or null if none could be minted. */
  actionUrl: string | null
  method: 'invite' | 'magiclink' | 'none'
  /**
   * Set when the brother can be added to the roster but the email
   * cannot carry a working link. The caller surfaces this rather than
   * reporting a clean success.
   */
  warning?: string
}

export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} did not respond within ${Math.round(ms / 1000)}s.`)),
      ms
    )
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) }
    )
  })
}

/**
 * Creates the auth user if needed and returns a link that signs the
 * brother in. Sends no email — the caller does that through Resend.
 *
 * Throws only when Supabase Auth is genuinely unreachable or refuses
 * the request for a reason other than "this brother already has an
 * account"; that case is handled here by falling back to a magic link.
 */
export async function createInviteLink(
  admin: SupabaseClient,
  {
    email,
    firstName,
    lastName,
    appUrl,
  }: { email: string; firstName?: string; lastName?: string; appUrl: string }
): Promise<InviteLink> {
  const callbackUrl = (hashedToken: string, type: 'invite' | 'magiclink', next: string) =>
    `${appUrl}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}` +
    `&type=${type}&next=${encodeURIComponent(next)}`

  const invite = await withTimeout(
    admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { first_name: firstName, last_name: lastName },
        redirectTo: `${appUrl}/auth/callback`,
      },
    }),
    ADMIN_CALL_TIMEOUT_MS,
    'Supabase Auth'
  )

  if (!invite.error) {
    const hashedToken = invite.data?.properties?.hashed_token
    return {
      userId: invite.data?.user?.id ?? null,
      // A brand new brother has no password yet, so the link takes him
      // to set one. Landing him straight in the portal would give him a
      // session he could never re-establish after signing out.
      actionUrl: hashedToken ? callbackUrl(hashedToken, 'invite', '/auth/set-password') : null,
      method: 'invite',
      warning: hashedToken
        ? undefined
        : 'Supabase Auth returned no invitation token, so the email cannot include a sign-in link.',
    }
  }

  if (!ALREADY_REGISTERED.test(invite.error.message ?? '')) {
    throw invite.error
  }

  // The brother already has a LodgeOS account — being added to another
  // lodge, or re-invited after an earlier attempt created the user.
  // 'invite' refuses an existing address, so send him a sign-in link
  // instead. He keeps whatever password he already set.
  const magic = await withTimeout(
    admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    }),
    ADMIN_CALL_TIMEOUT_MS,
    'Supabase Auth'
  )

  if (magic.error) {
    return {
      userId: null,
      actionUrl: null,
      method: 'none',
      warning: `This brother already has an account, and a sign-in link could not be created: ${magic.error.message}`,
    }
  }

  const hashedToken = magic.data?.properties?.hashed_token
  return {
    userId: magic.data?.user?.id ?? null,
    actionUrl: hashedToken ? callbackUrl(hashedToken, 'magiclink', '/portal') : null,
    method: 'magiclink',
  }
}
