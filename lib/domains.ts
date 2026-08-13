/**
 * Turning a Host header into something comparable to a stored domain.
 *
 * Pure, and separate from the page, because it is the kind of thing
 * that is wrong in one of five small ways and each one shows up as
 * "the lodge's website went to the marketing page".
 *
 * A Host arrives with a port on it locally ('localhost:3000'), with a
 * www that the lodge did not store, in whatever case the browser felt
 * like, and occasionally as a comma-separated list when it has passed
 * through more than one proxy. Domains are stored bare and lower case
 * (migration 046), so the incoming value is reduced to match.
 */

export function normaliseHost(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Behind two proxies a Host or X-Forwarded-Host can arrive as
  // "a.example.com, b.example.com". The first is the one the visitor
  // actually typed.
  let host = raw.split(',')[0].trim().toLowerCase()

  // Strip the port, but not the colons of an IPv6 literal — which is
  // never a lodge's domain, so it is dropped entirely below anyway.
  if (host.startsWith('[')) return null
  host = host.split(':')[0]

  host = host.replace(/^www\./, '').replace(/\.+$/, '')

  if (!host) return null

  /**
   * Only something that could be a real domain gets as far as a
   * database lookup. 'localhost' and a bare IP are how the app is
   * reached in development and by health checks; neither is a lodge,
   * and neither should cost a query on every visit to the front page.
   */
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null

  return host
}
