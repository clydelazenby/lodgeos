'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { label: string; href: string }

/**
 * The interactive shell around the lodge admin nav. Split out from the
 * (server-component) layout because toggling a mobile sidebar needs
 * client state.
 *
 * Behavior:
 * - >=768px: sidebar always visible, fixed width, matches the original
 *   desktop-only layout.
 * - <768px: sidebar is off-canvas by default. A fixed hamburger button
 *   slides it in as an overlay with a dimmed backdrop. Tapping a nav
 *   link or the backdrop closes it.
 * - Route changes auto-close the mobile sidebar.
 */
export function ResponsiveNavShell({
  navItems, superAdminHref, homeHref, children,
}: { navItems: NavItem[]; superAdminHref: string | null; homeHref: string; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <>
      {/* Mobile hamburger — fixed position, always reachable */}
      <button
        className="lodgeos-mobile-menu-btn"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        style={{
          position: 'fixed', top: '12px', left: '12px', zIndex: 101,
          background: '#141C2E', border: '1px solid rgba(201,168,76,0.35)', color: '#C9A84C',
          width: '36px', height: '36px', borderRadius: '4px', cursor: 'pointer',
<<<<<<< HEAD
          fontSize: '1.1rem', display: 'none', alignItems: 'center', justifyContent: 'center',
=======
          fontSize: '1rem', display: 'none', alignItems: 'center', justifyContent: 'center',
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
        }}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Backdrop — tapping outside the open sidebar closes it */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lodgeos-backdrop"
          style={{ position: 'fixed', inset: 0, top: '60px', background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
        />
      )}

      <aside
        className={`lodgeos-sidebar ${mobileOpen ? 'lodgeos-sidebar-open' : ''}`}
        style={{
          width: '220px', minHeight: 'calc(100vh - 60px)', background: '#141C2E',
          borderRight: '1px solid rgba(201,168,76,0.1)', padding: '1rem 0', flexShrink: 0,
          position: 'sticky', top: '60px', alignSelf: 'flex-start', height: 'calc(100vh - 60px)', overflowY: 'auto',
        }}
      >
        {navItems.map(({ label, href }) => {
          const active = pathname === href
          return (
            <Link
              key={href} href={href}
              style={{
                display: 'block', padding: '0.65rem 1.4rem', fontFamily: 'Cinzel, serif', fontSize: '0.7rem',
                letterSpacing: '0.05em', color: active ? '#C9A84C' : '#B8B0A0', textDecoration: 'none',
                borderLeft: `2px solid ${active ? '#C9A84C' : 'transparent'}`, transition: 'all 0.2s',
                background: active ? 'rgba(201,168,76,0.06)' : 'transparent',
              }}
            >
              {label}
            </Link>
          )
        })}
        <div style={{ marginTop: '2rem', padding: '0 1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: 'rgba(201,168,76,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Platform</div>
          {superAdminHref && (
            <Link href={superAdminHref} style={{ display: 'block', padding: '0.5rem 0', fontFamily: 'Cinzel, serif', fontSize: '0.68rem', color: '#E74C3C', textDecoration: 'none', letterSpacing: '0.05em' }}>Super Admin ↗</Link>
          )}
          <Link href={homeHref} style={{ display: 'block', padding: '0.5rem 0', fontFamily: 'Cinzel, serif', fontSize: '0.68rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.05em' }}>← LodgeOS Home</Link>
        </div>
      </aside>

      <main className="lodgeos-main" style={{ flex: 1, padding: '2rem', minWidth: 0 }}>
        {children}
      </main>

      <style jsx global>{`
        @media (max-width: 767px) {
          .lodgeos-mobile-menu-btn { display: flex !important; }
          .lodgeos-sidebar {
            position: fixed !important;
            top: 60px !important;
            left: 0;
            z-index: 95;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            box-shadow: 4px 0 24px rgba(0,0,0,0.4);
          }
          .lodgeos-sidebar-open { transform: translateX(0); }
          .lodgeos-main { padding: 1rem !important; }
        }
      `}</style>
    </>
  )
}
