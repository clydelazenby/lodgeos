/**
 * The two things every email module needs, in a file that imports
 * nothing else.
 *
 * They used to live in lib/email/index.ts, which was fine until
 * layout.ts needed them — index.ts imports the templates from layout.ts,
 * so layout.ts importing back from index.ts would be a cycle. Node
 * resolves some cycles and mangles others; a module that only exports
 * constants and a pure function is the cheap way to not find out which.
 *
 * index.ts re-exports both, so existing imports keep working.
 */

// The canonical origin is the WWW host. The bare domain 308-redirects
// to it, which browsers follow silently but server-to-server callers
// (webhooks, RSVP link checkers, some mail-security scanners) do not.
// Keeping the fallback on www means a missing env var degrades to a
// working URL rather than a redirecting one.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.psalmslodge1827.com'

/**
 * Escapes text before it is interpolated into an email's HTML.
 *
 * Lodge notices are composed by officers, so this is not primarily an
 * anti-attacker measure — it's a correctness one. A secretary writing
 * "Dues & Refreshments" or "Bring your ID <before> 7pm" would otherwise
 * produce malformed HTML that renders wrong or swallows the rest of the
 * line, and there is no way to preview that in a sent email. Escaping
 * also means a pasted snippet of HTML shows up as the text it looks
 * like rather than silently becoming markup in every brother's inbox.
 *
 * Some callers DO handle genuinely untrusted input — the access-request
 * alerts carry text typed by anonymous visitors — and this is what
 * makes that safe.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
