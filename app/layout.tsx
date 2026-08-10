import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'LodgeOS — Lodge Management Platform', template: '%s | LodgeOS' },
  description: 'The operating system for Masonic lodges. Manage members, dues, events, and communications — all in one place.',
  keywords: ['Masonic lodge management', 'lodge software', 'Freemasonry', 'dues management'],
  // Browser-tab and home-screen icons.
  //
  // app/icon.png (32px) and app/apple-icon.png (180px) are picked up by
  // Next's file convention automatically and need no entry here; they
  // were generated from public/assets/lodgeos/images/pojl-logo.png,
  // padded to a square on the app's navy so the crest is not distorted
  // or given a white border in a round icon slot. The originals are
  // 709x780 and 1.2MB — far too heavy to serve as a favicon, which is
  // why the resized copies exist.
  openGraph: {
    title: 'LodgeOS — Lodge Management Platform',
    description: 'The operating system for Masonic lodges.',
    type: 'website',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'LodgeOS' }],
  },
  twitter: {
    card: 'summary',
    title: 'LodgeOS — Lodge Management Platform',
    images: ['/icon-512.png'],
  },
}

// Tints the browser chrome on mobile to match the app rather than
// leaving a white bar above a very dark page.
export const viewport = {
  themeColor: '#0A0E1A',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
