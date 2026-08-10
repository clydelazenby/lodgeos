import type { MetadataRoute } from 'next'

/**
 * Web app manifest. Makes "Add to Home Screen" produce a proper LodgeOS
 * icon and a standalone window rather than a generic browser shortcut
 * with a screenshot of the page as its icon — which matters here
 * because officers use this from a phone during meetings.
 *
 * Colours are the same navy/gold as lib/designTokens.ts, so the splash
 * and system chrome match the app instead of flashing white on launch.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LodgeOS — Lodge Management',
    short_name: 'LodgeOS',
    description: 'Manage members, dues, events, attendance and communications for your lodge.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0E1A',
    theme_color: '#0A0E1A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // Declared as maskable too so Android crops it to the launcher's
      // shape instead of dropping the square into a white circle.
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
