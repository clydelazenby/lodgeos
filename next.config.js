/** @type {import('next').NextConfig} */

/**
 * CORS was previously `Access-Control-Allow-Origin: *` on /api/:path*,
 * which let any website on the internet read the responses of every API
 * route in this app.
 *
 * Actual exposure was limited — browsers refuse to send credentials to
 * a wildcard origin, and the Supabase session cookies are sameSite=lax,
 * which blocks cross-site POSTs — so this was not remotely exploitable
 * as it stood. But it was also serving no purpose: the LodgeOS frontend
 * is same-origin with its own API, and same-origin requests do not
 * consult CORS at all. The wildcard only ever granted access to third
 * parties.
 *
 * Scoped to the app's own origin instead. Note this reads
 * NEXT_PUBLIC_APP_URL at BUILD time, not request time — Next.js
 * evaluates next.config.js once when building, so changing that env var
 * requires a rebuild/redeploy to take effect, not just a restart.
 */
const appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const nextConfig = {
  images: { domains: ['images.unsplash.com', 'res.cloudinary.com'] },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: appOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          // Tells caches that the response varies by requesting origin,
          // so a response prepared for one origin is never replayed to
          // another.
          { key: 'Vary', value: 'Origin' },
        ],
      },
      {
        // Baseline hardening for every route. None of these were set
        // before. They cost nothing and close off clickjacking, MIME
        // sniffing, and referrer leakage of lodge URLs (which contain
        // member ids on profile pages) to third-party sites.
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
