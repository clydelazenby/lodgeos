import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'LodgeOS — Lodge Management Platform', template: '%s | LodgeOS' },
  description: 'The operating system for Masonic lodges. Manage members, dues, events, and communications — all in one place.',
  keywords: ['Masonic lodge management', 'lodge software', 'Freemasonry', 'dues management'],
  openGraph: {
    title: 'LodgeOS — Lodge Management Platform',
    description: 'The operating system for Masonic lodges.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
