'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavItem = { label: string; href: string }
export type NavGroup = { label: string; items: NavItem[] }
/** A group, or a single top-level link with no children. */
export type NavEntry = NavItem | NavGroup

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

/**
 * The interactive shell around the lodge admin nav. Split out from the
 * (server-component) layout because toggling a mobile sidebar needs
 * client state.
 *
 * GROUPED NAVIGATION
 *
 * This previously rendered a flat list of seventeen links. Seventeen
 * items with no hierarchy is a wall rather than a menu: nothing is
 * findable by scanning, everything competes equally for attention, and
 * on a phone the list ran well past a single screen. It also buried the
 * pages an officer opens constantly (Dashboard, Members, Dues) among
 * ones opened a few times a year (Transition, Coverage).
 *
 * Sections collapse, and the section containing the current route opens
 * automatically — so arriving anywhere shows you where you are in
 * context, without a click.
 *
 * Behavior otherwise unchanged:
 * - >=768px: sidebar always visible, fixed width.
 * - <768px: off-canvas, opened by a fixed hamburger, dimmed backdrop,
 *   closes on nav or backdrop tap.
 * - Route changes auto-close the mobile sidebar.
 */
export function ResponsiveNavShell({
  navEntries, superAdminHref, homeHref, children,
}: { navEntries: NavEntry[]; superAdminHref: string | null; homeHref: string; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Which section contains the current route. Recomputed on navigation
  // rather than stored, so it can never drift out of sync with the URL.
  const activeGroup = navEntries.find(
    (e) => isGroup(e) && e.items.some((i) => i.href === pathname)
  )?.label ?? null

  // User-toggled sections. `null` means "no manual choice yet" for that
  // section, in which case the active-route rule decides.
  const [manual, setManual] = useState<Record<string, boolean>>({})

  useEffect(() => { setMobileOpen(false) }, [pathname])

  // A manual toggle shouldn't survive navigating to a different
  // section — otherwise sections the user collapsed once stay collapsed
  // even when they're where the user now is.
  useEffect(() => { setManual({}) }, [activeGroup])

  const isOpen = (label: string) =>
    manual[label] ?? (label === activeGroup)

  const linkStyle = (active: boolean, nested: boolean) => ({
    display: 'block',
    padding: nested ? '0.5rem 1.4rem 0.5rem 2.1rem' : '0.65rem 1.4rem',
    fontFamily: 'Cinzel, serif',
    fontSize: nested ? '0.68rem' : '0.7rem',
    letterSpacing: '0.05em',
    color: active ? '#C9A84C' : '#B8B0A0',
    textDecoration: 'none',
    borderLeft: `2px solid ${active ? '#C9A84C' : 'transparent'}`,
    transition: 'all 0.2s',
    background: active ? 'rgba(201,168,76,0.06)' : 'transparent',
  })

  return (
    <>
      <button
        className="lodgeos-mobile-menu-btn"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        style={{
          position: 'fixed', top: '12px', left: '12px', zIndex: 101,
          background: '#141C2E', border: '1px solid rgba(201,168,76,0.35)', color: '#C9A84C',
          width: '36px', height: '36px', borderRadius: '4px', cursor: 'pointer',
          fontSize: '1.1rem', display: 'none', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

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
        <nav aria-label="Lodge sections">
          {navEntries.map((entry) => {
            if (!isGroup(entry)) {
              const active = pathname === entry.href
              return (
                <Link key={entry.href} href={entry.href} style={linkStyle(active, false)}>
                  {entry.label}
                </Link>
              )
            }

            const open = isOpen(entry.label)
            const containsActive = entry.items.some((i) => i.href === pathname)

            return (
              <div key={entry.label}>
                <button
                  onClick={() => setManual((m) => ({ ...m, [entry.label]: !open }))}
                  aria-expanded={open}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 1.4rem',
                    fontFamily: 'Cinzel, serif',
                    fontSize: '0.7rem',
                    letterSpacing: '0.05em',
                    // A collapsed section holding the current page still
                    // reads as gold, so collapsing never hides where you are.
                    color: containsActive ? '#C9A84C' : '#B8B0A0',
                    background: 'transparent',
                    border: 'none',
                    borderLeft: `2px solid ${containsActive && !open ? '#C9A84C' : 'transparent'}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{entry.label}</span>
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: '0.55rem',
                      opacity: 0.7,
                      transform: open ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s',
                      display: 'inline-block',
                    }}
                  >
                    ▶
                  </span>
                </button>

                {open && entry.items.map(({ label, href }) => (
                  <Link key={href} href={href} style={linkStyle(pathname === href, true)}>
                    {label}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>

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
