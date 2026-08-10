import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Matches the officer tiers from lib/migrations/004_officer_role_tiers.sql
// and the same set already used correctly in app/auth/login/page.tsx.
// This route previously only recognized 'admin'/'secretary' — a stale
// check that predates the officer-tiers migration — meaning a
// Treasurer, Warden, Deacon, or Worshipful Master confirming their
// email via this callback would be silently routed to the plain
// member portal instead of their real dashboard.
const OFFICER_TIERS = new Set(['admin', 'secretary', 'worshipful_master', 'treasurer', 'warden', 'deacon'])

/**
 * `next` comes off a link in an email, so it is attacker-influencable
 * in principle and must never be able to send a brother off-site. Only
 * same-origin paths are honoured; '//evil.com' is a protocol-relative
 * URL, not a path, which is why a leading '/' alone is not enough.
 */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/portal'

  /**
   * Invitations and sign-in links minted by lib/auth/inviteLink.ts
   * arrive here as a token_hash rather than a `code`.
   *
   * They have to: those links are generated server-side with no PKCE
   * code verifier, so GoTrue's own /verify endpoint would hand the
   * session back in a URL FRAGMENT — which never reaches the server,
   * and so could never be turned into a session cookie here. Verifying
   * the token ourselves keeps the whole exchange server-side, where
   * createClient()'s cookie handler can actually write the session.
   */
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type') as EmailOtpType | null

  if (tokenHash && otpType) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
    if (error) {
      // Overwhelmingly this is a link that was already used or has
      // expired, which is worth saying plainly — the brother's next
      // move is to request another one, not to guess at a password he
      // never set. A recovery link says so differently: he can send
      // himself a new one, where an invitation has to come from his
      // Secretary.
      const reason = otpType === 'recovery' ? 'reset_expired' : 'link_expired'
      return NextResponse.redirect(`${origin}/auth/login?error=${reason}`)
    }
    return NextResponse.redirect(`${origin}${safeNext(next) ?? '/portal'}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if lodge admin or brother
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('platform_role').eq('id', user.id).single()
        if (profile?.platform_role === 'super_admin') {
          return NextResponse.redirect(`${origin}/super-admin`)
        }

        const { data: membership } = await supabase
          .from('tenant_members')
          .select('tenant_role, tenants(slug)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1)
          .single()

        if (membership) {
          const slug = (membership.tenants as any)?.slug
          if (OFFICER_TIERS.has(membership.tenant_role)) {
            return NextResponse.redirect(`${origin}/lodge/${slug}/dashboard`)
          }
          return NextResponse.redirect(`${origin}/portal`)
        }

        return NextResponse.redirect(`${origin}/onboarding/setup`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
