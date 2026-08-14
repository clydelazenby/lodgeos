import React from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PublicGallery } from '@/components/public/PublicGallery'
import { NeedLoginDialog } from '@/components/public/NeedLoginDialog'
import { MobileMenuAutoClose } from '@/components/public/MobileMenuAutoClose'
import type { Metadata } from 'next'
import { upcomingSince } from '@/lib/dates'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock,
  Droplet,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Mail,
  MapPin,
  Users,
} from 'lucide-react'

/**
 * INCREMENTAL STATIC REGENERATION
 *
 * This is the public, anonymous-visitor face of a lodge — the page a
 * prospective petitioner lands on. It was fully dynamic, meaning every
 * visit re-ran the tenant query plus the events and officers lookups
 * below, even though the content only changes when a secretary edits
 * lodge settings.
 *
 * Rendered at build time for known lodges and re-rendered at most once
 * an hour after that. An explicit revalidatePath (app/actions/
 * revalidate.ts, called from the settings page) makes real edits appear
 * immediately, so the hour is only a backstop for changes made outside
 * the settings form — direct database edits, or an event added by
 * another officer.
 */
export const revalidate = 3600

/**
 * Pre-renders every existing lodge at build time.
 *
 * dynamicParams defaults to true and is deliberately left that way: a
 * lodge that signs up AFTER this build still renders on first request
 * and is cached from then on. Without that, new lodges would 404 until
 * the next deploy.
 *
 * Uses the service client because this runs at build time, where there
 * is no user session for RLS to evaluate against. It reads nothing but
 * the slug column.
 */
export async function generateStaticParams() {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase.from('tenants').select('slug')
    return (data ?? []).map((t: { slug: string }) => ({ slug: t.slug }))
  } catch {
    // A build should not fail because the database was briefly
    // unreachable. Returning nothing means every lodge page is rendered
    // on first request instead of at build time — slower for the first
    // visitor, but the site still builds and still works.
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const supabase = createServiceClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, number, about_text')
    .eq('slug', params.slug)
    .single()

  if (!tenant) return { title: 'Lodge Not Found' }

  return {
    title: `${tenant.name} #${tenant.number}`,
    description:
      tenant.about_text || `${tenant.name} #${tenant.number} — Masonic Lodge`,
  }
}

export default async function PublicLodgePage({
  params,
}: {
  params: { slug: string }
}) {
  const h: any = React.createElement
  const supabase = createServiceClient()

const result = await supabase
  .from('tenants')
  .select('*')
  .eq('slug', params.slug)
  .single()

const tenant = result.data

if (!tenant) notFound()

  /**
   * How this lodge names itself in prose — "Psalms of Job Lodge No.
   * 1827". Used wherever the page speaks ABOUT the lodge rather than
   * simply labelling it, so a lodge that has not written its own
   * welcome still reads as being about itself. `name` frequently
   * already ends in "Lodge", so it is not added twice.
   */
  const lodgeFullName = [
    /lodge\s*$/i.test(tenant.name) ? tenant.name.trim() : `${tenant.name} Lodge`,
    tenant.number ? `No. ${tenant.number}` : '',
  ].filter(Boolean).join(' ')

  const today = upcomingSince()

  const { data: events } = await supabase
    .from('lodge_events')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_public', true)
    .gte('event_date', today)
    .order('event_date')
    .limit(4)

  /**
   * The lodge's photographs.
   *
   * THE is_published FILTER HERE IS LOAD-BEARING. This page reads with
   * the SERVICE client (see above — the public site is rendered for
   * visitors with no session at all), which bypasses RLS entirely. So
   * migration 037's "Published photos are public" policy does not
   * protect this query; it is the backstop for every other reader.
   * A photograph the lodge has taken down stays down because of this
   * line, and removing it would put it straight back on the internet.
   */
  const { data: galleryPhotos } = await supabase
    .from('gallery_photos')
    .select('id, url, thumb_url, caption, alt_text, taken_on, width, height')
    .eq('tenant_id', tenant.id)
    .eq('is_published', true)
    .order('sort_order')
    .order('created_at')

  /**
   * The front page shows a dozen; /[slug]/gallery shows them all.
   *
   * A lodge with two hundred photographs should not push its calendar
   * and its contact details off the bottom of the front page — and the
   * gallery page is what gets emailed and shared anyway, so it is the
   * one that has to hold everything.
   */
  const GALLERY_PREVIEW = 12
  const galleryPreview = (galleryPhotos ?? []).slice(0, GALLERY_PREVIEW)
  const galleryMore = (galleryPhotos?.length ?? 0) - galleryPreview.length

  // The section AND the nav link hang off this one condition. A lodge
  // with no photographs previously still advertised a Gallery in its
  // menu, and it scrolled to four empty gold boxes.
  const showGallery =
    (tenant.gallery_enabled ?? true) && !!galleryPhotos && galleryPhotos.length > 0

const gold = '#C9A84C'
const navy = '#0D1B2A'
const cream = '#F4EFE6'
const dim = '#DCCFB5'
const muted = '#B7A98B'
const panel = '#142234'
  const nextEvent = events?.[0]

  // Mirrors the guard on /[slug]/donate, which 404s in the same case —
  // the button and the page must agree, or the lodge advertises a dead
  // link on its own front page.
  const canDonate = Boolean(
    tenant.donations_enabled &&
    (tenant.cashapp_handle || tenant.venmo_handle || tenant.zelle_handle)
  )

  const lodgeLogo = '/assets/lodgeos/images/pojl-logo.png'
  const heroImage = '/assets/lodgeos/images/lodge-hero.png'

  const formatEventDate = (date: string) => {
    const d = new Date(date + 'T12:00:00')

    return {
      day: d.getDate(),
      month: d.toLocaleString('en-US', { month: 'short' }),
      full: d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    }
  }

  const navItems = [
    ['Home', `/${params.slug}`],
    ['About Us', '#about'],
    ['Freemasonry', '#freemasonry'],
    ['Events', '#events'],
    /**
     * THE GALLERY'S OWN PAGE, not an anchor.
     *
     * An in-page anchor only works if the section is rendered on the
     * page you happen to be on, and scrolls nowhere at all when it is
     * not — which is indistinguishable from a broken link, and was
     * reported as one. A real href either loads a page or 404s, and
     * this one loads.
     */
    ...(showGallery ? [['Gallery', `/${params.slug}/gallery`]] : []),
    ['Contact', '#contact'],
  ] as [string, string][]

  const navLinkStyle = {
    color: cream,
    opacity: 0.9,
    textDecoration: 'none',
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '0.72rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }

  const buttonGold = {
    background: gold,
    color: navy,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '0.76rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '14px 26px',
    borderRadius: '2px',
    boxShadow: `0 12px 28px ${gold}25`,
    whiteSpace: 'nowrap',
  }

  const buttonOutline = {
    background: 'transparent',
    color: gold,
    border: `1px solid ${gold}65`,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '0.76rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '14px 26px',
    borderRadius: '2px',
    whiteSpace: 'nowrap',
  }



const impact = [
  {
    value: 'GOD',
    label: 'FIRST IN ALL THINGS',
    Icon: HeartHandshake,
  },
  {
    value: 'FAMILY',
    label: 'STRONG HOMES',
    Icon: Users,
  },
  {
    value: 'BROTHERHOOD',
    label: 'UNITED AS BRETHREN',
    Icon: Users,
  },
  {
    value: 'SERVICE',
    label: 'SERVING OUR COMMUNITY',
    Icon: Landmark,
  },
  {
    value: 'TRUTH',
    label: 'MASONIC PRINCIPLES',
    Icon: BookOpen,
  },
]

  const responsiveStyles = h('style', {
    dangerouslySetInnerHTML: {
      __html: `
        html { scroll-behavior: smooth; }
        .public-mobile-menu { display: none; position: relative; }
        .mobile-menu-summary { list-style: none; }
        .mobile-menu-summary::-webkit-details-marker { display: none; }
      .fade-up {
  opacity: 0;
  transform: translateY(30px);
  animation: fadeUp 0.8s ease forwards;
}

.fade-up-delay-1 {
  animation-delay: .15s;
}

.fade-up-delay-2 {
  animation-delay: .3s;
}

.fade-up-delay-3 {
  animation-delay: .45s;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
        @media (max-width: 980px) {
          .public-nav {
            height: auto !important;
            min-height: 74px !important;
            padding: 0.55rem 0.75rem !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.45rem !important;
          }
          @media (max-width: 980px) {
  .foundation-copy {
    display: none;
  }
}
          .public-nav-top {
            width: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 0.75rem !important;
          }

          .public-nav-brand { min-width: 0 !important; gap: 0.55rem !important; }
          .public-brand-icon { width: 38px !important; height: 38px !important; }
          .public-brand-icon img { width: 34px !important; height: 34px !important; }
          .public-brand-title {
            font-size: 0.68rem !important;
            max-width: 155px !important;
            white-space: normal !important;
            line-height: 1.05 !important;
          }
          .public-brand-subtitle { font-size: 0.54rem !important; letter-spacing: 0.12em !important; }
          .public-brand-rite { display: none !important; }
          .public-desktop-links { display: none !important; }
          .public-actions { gap: 0.45rem !important; flex-shrink: 0 !important; }
          .public-login-btn, .public-mason-btn { display: none !important; }
          .public-mobile-menu { display: block !important; }

          .mobile-menu-summary {
            width: 42px !important;
            height: 42px !important;
            border: 1px solid rgba(201,168,76,0.45) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            background: rgba(255,255,255,0.035) !important;
          }

.mobile-menu-panel {
  position: fixed !important;
  left: 0.75rem !important;
  right: 0.75rem !important;
  top: 76px !important;
  width: auto !important;
  background: rgba(5,10,18,0.98) !important;
  border: 1px solid rgba(201,168,76,0.35) !important;
  box-shadow: 0 24px 60px rgba(0,0,0,0.55) !important;
  padding: 0.55rem !important;
  z-index: 200 !important;
}

.mobile-menu-panel a {
  display: block !important;
  color: #F5F0E8 !important;
  text-decoration: none !important;
  font-family: Georgia, serif !important;
  font-size: 0.78rem !important;
  padding: 0.55rem 0.65rem !important;
  border-bottom: 1px solid rgba(201,168,76,0.12) !important;
}

.mobile-menu-login {
  color: #C9A84C !important;
  background: rgba(255,255,255,0.035) !important;
  border: 1px solid rgba(201,168,76,0.35) !important;
  text-align: center !important;
  margin-top: 0.6rem !important;
  font-family: Cinzel, Georgia, serif !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
  font-weight: 700 !important;
}

/* THREE WEIGHTS, NOT TWO.
   "Brother Login" and "Request Access" carried the same class, so they
   were the same button twice — and a brother who could not get in had
   no way to tell which of two identical controls was for him. Solid
   gold belongs to "Become a Mason" (the public site's one job), the
   outline to Brother Login, and this to the fallback beneath it: a
   quiet line for the man whose login never arrived. */
/* IT LOOKED LIKE AN AFTERTHOUGHT, because it was styled as one:
   small, italic, grey and left-aligned in a menu where every other
   entry is a full-width control. Next to a bordered BROTHER LOGIN it
   read as a caption belonging to the button above rather than as a
   thing to press.

   It is still the quietest of the three — no fill, no gold — but it is
   now the same SHAPE as its neighbours: full width, centred, the same
   letterspaced caps, with a border faint enough to sit below the
   login and above nothing. */
.mobile-menu-quiet {
  color: #B8B0A0 !important;
  background: transparent !important;
  border: 1px solid rgba(184,176,160,0.22) !important;
  border-radius: 2px !important;
  text-align: center !important;
  width: 100% !important;
  margin-top: 0.5rem !important;
  padding: 0.7rem 0.65rem !important;
  font-family: Cinzel, Georgia, serif !important;
  font-size: 0.7rem !important;
  font-style: normal !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
}

.mobile-menu-primary {
  background: #C9A84C !important;
  color: #0A0E1A !important;
  text-align: center !important;
  margin-top: 0.6rem !important;
  font-family: Cinzel, Georgia, serif !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
  font-weight: 700 !important;
}

          .public-hero {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
            padding: 9.5rem 1.25rem 3.5rem !important;
            gap: 2rem !important;
            background-image:
              linear-gradient(90deg, rgba(5,10,18,0.80) 0%, rgba(5,10,18,0.68) 100%),
              radial-gradient(ellipse at 18% 28%, rgba(201,168,76,0.20) 0%, transparent 48%),
              url('/assets/lodgeos/images/lodge-hero.png') !important;
            background-size: cover !important;
            background-position: center !important;
          }

          .public-hero-title { font-size: 2.65rem !important; line-height: 1.05 !important; }
          .public-hero-copy { font-size: 1rem !important; line-height: 1.7 !important; max-width: 100% !important; }
          .public-hero-buttons { flex-direction: column !important; align-items: stretch !important; }
          .public-hero-card { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
          .public-two-col, .public-events-grid, .public-footer-grid { grid-template-columns: 1fr !important; }
          // .public-pillars-grid { grid-template-columns: 1fr !important; }
.public-impact-grid {
  grid-template-columns: 1fr !important;
  gap: 1rem !important;
}

          .public-section { padding-left: 1.25rem !important; padding-right: 1.25rem !important;   padding-top: 2.5rem !important;3  padding-bottom: 2.5rem !important; }
          .public-gallery { grid-template-columns: 1fr !important; grid-template-rows: repeat(4, 180px) !important; }
        }

        @media (min-width: 981px) and (max-width: 1280px) {
          .public-desktop-links { gap: 0.9rem !important; }
          .public-desktop-links a { font-size: 0.62rem !important; }
        }
      `,
    },
  })
  const nav = h(
    'nav',
    {
      className: 'public-nav',
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: '88px',
        background: 'rgba(13, 27, 42, 0.96)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${gold}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2.25rem',
      },
    },
    h(
      'div',
      {
        className: 'public-nav-top',
        style: {
          display: 'contents',
        },
      },
      h(
        'a',
        {
          href: `/${params.slug}`,
          className: 'public-nav-brand',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            textDecoration: 'none',
          },
        },
        h(
          'div',
          {
            className: 'public-brand-icon',
            style: {
              width: '48px',
              height: '48px',
              border: `1px solid ${gold}55`,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 28px ${gold}18`,
              flex: '0 0 auto',
            },
          },
h('img', {
  src: lodgeLogo,
  alt: `${tenant.name} logo`,
  style: {
    width: 42,
    height: 42,
    objectFit: 'contain',
    display: 'block',
  },
})
        ),
        h(
          'div',
          null,
          h(
            'div',
            {
              className: 'public-brand-title',
              style: {
                fontFamily: 'Cinzel, Georgia, serif',
                color: cream,
                fontSize: '1.1rem',
                lineHeight: 1.05,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              },
            },
            tenant.name
          ),
          h(
            'div',
            {
              className: 'public-brand-subtitle',
              style: {
                fontFamily: 'Cinzel, Georgia, serif',
                color: cream,
                fontSize: '0.76rem',
                lineHeight: 1.1,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                opacity: 0.9,
                whiteSpace: 'nowrap',
              },
            },
            `Lodge No. ${tenant.number}`
          ),
          h(
            'div',
            {
              className: 'public-brand-rite',
              style: {
                fontFamily: 'JetBrains Mono, monospace',
                color: gold,
                fontSize: '0.56rem',
                letterSpacing: '0.22em',
                marginTop: '3px',
              },
            },
            tenant.rite || 'A.F. & A.M.'
          )
        )
      ),

      h(
        'div',
        {
          className: 'public-desktop-links',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
          },
        },
        navItems.map(([label, href]) =>
          h(
            'a',
            {
              key: label,
              href,
              style: navLinkStyle,
            },
            label
          )
        )
      ),

      h(
        'div',
        {
          className: 'public-actions',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
          },
        },
        h(
          'a',
          {
            href: '/auth/login',
            className: 'public-login-btn',
            style: {
              color: cream,
              background: 'rgba(255,255,255,0.035)',
              textDecoration: 'none',
              fontFamily: 'Cinzel, Georgia, serif',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '12px 18px',
              border: `1px solid ${gold}55`,
              borderRadius: '2px',
              whiteSpace: 'nowrap',
            },
          },
          'Brother Login'
        ),
        h(
          'a',
          {
            href: `/${params.slug}/petition`,
            className: 'public-mason-btn',
            style: {
              background: gold,
              color: navy,
              fontFamily: 'Cinzel, Georgia, serif',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '13px 24px',
              textDecoration: 'none',
              borderRadius: '2px',
              boxShadow: `0 10px 24px ${gold}25`,
              whiteSpace: 'nowrap',
            },
          },
          'Become a Mason'
        ),
        // Without this the menu stays open over the page you just
        // navigated to, which reads as the link doing nothing.
        h(MobileMenuAutoClose, { key: 'menu-autoclose' }),
        h(
          'details',
          {
            className: 'public-mobile-menu',
          },
          h(
            'summary',
            {
              className: 'mobile-menu-summary',
              'aria-label': 'Open menu',
            },
            h('span', {
              style: {
                width: 18,
                height: 2,
                background: gold,
                display: 'block',
                boxShadow: `0 6px 0 ${gold}, 0 -6px 0 ${gold}`,
              },
            })
          ),
          h(
            'div',
            {
              className: 'mobile-menu-panel',
            },
            h('a', { href: `/${params.slug}` }, 'Home'),
            h('a', { href: '#about' }, 'About Us'),
            h('a', { href: '#freemasonry' }, 'Freemasonry'),
            h('a', { href: '#events' }, 'Events'),
            // Was hardcoded and unconditional while the desktop nav
            // was conditional — so a lodge with no photographs still
            // advertised a Gallery on a phone, which is the device
            // most visitors are on.
            showGallery ? h('a', { key: 'gallery', href: `/${params.slug}/gallery` }, 'Gallery') : null,
            h('a', { href: '#contact' }, 'Contact'),
            h(
              'a',
              {
                href: '/auth/login',
                className: 'mobile-menu-login',
              },
              'Brother Login'
            ),
            // A POPUP, not a page. It went to the full form, which was
            // correct and kept being reported as broken — the chooser
            // on the platform form set the expectation that this pops
            // up too. Twice reported is the interface disagreeing with
            // the person using it, not a misunderstanding to explain.
            h(
              NeedLoginDialog,
              {
                key: 'need-login',
                slug: params.slug,
                lodgeName: lodgeFullName,
                className: 'mobile-menu-quiet',
              },
              'Need a login?'
            ),
            h(
              'a',
              {
                href: `/${params.slug}/petition`,
                className: 'mobile-menu-primary',
              },
              'Become a Mason'
            )
          )
        )
      )
    )
  )
  const hero = h(
    'section',
    {
      className: 'public-hero',
      style: {
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.25fr) 420px',
        gap: '3rem',
        alignItems: 'center',
        padding: '10rem 4rem 5rem',
        backgroundImage: `
          linear-gradient(90deg, rgba(5,10,18,0.76) 0%, rgba(5,10,18,0.58) 48%, rgba(5,10,18,0.26) 100%),
          radial-gradient(ellipse at 18% 30%, ${gold}30 0%, transparent 48%),
          radial-gradient(ellipse at 85% 70%, rgba(201,168,76,0.16) 0%, transparent 42%),
          url('${heroImage}')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
    },
    h(
      'div',
      { style: { maxWidth: '820px', position: 'relative', zIndex: 2 } },
      h(
        'div',
        {
          style: {
            fontFamily: 'JetBrains Mono, monospace',
            color: gold,
            fontSize: '0.68rem',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            marginBottom: '1.4rem',
          },
        },
        `${tenant.city ? `${tenant.city}, ${tenant.state}` : 'Masonic Lodge'} · ${tenant.rite || 'Freemasonry'}`
      ),
      h(
        'h1',
        {
          className: 'public-hero-title',
          style: {
            fontFamily: 'Cinzel, Georgia, serif',
            fontSize: 'clamp(3.4rem, 6vw, 5.9rem)',
            lineHeight: 0.98,
            color: cream,
            margin: 0,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          },
        },
        tenant.name
      ),
      h(
        'div',
        {
          style: {
            fontFamily: 'Cinzel, Georgia, serif',
            fontSize: '1.45rem',
            color: gold,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginTop: '0.7rem',
          },
        },
        `Lodge No. ${tenant.number}`
      ),
      h('div', {
        style: {
          width: '150px',
          height: '1px',
          background: `linear-gradient(90deg, ${gold}, transparent)`,
          margin: '2rem 0',
        },
      }),
      h(
        'p',
        {
          className: 'public-hero-copy',
          style: {
            color: '#E4D8C3',
            fontSize: '1.22rem',
            lineHeight: 1.85,
            maxWidth: '700px',
            fontStyle: 'italic',
            marginBottom: '2.5rem',
            textShadow: '0 2px 18px rgba(0,0,0,0.42)',
          },
        },
        tenant.about_text ||
          'Making good men better through brotherhood, service, leadership, and timeless Masonic principles.'
      ),
      h(
        'div',
        { className: 'public-hero-buttons', style: { display: 'flex', gap: '1rem', flexWrap: 'wrap' } },
        h('a', { href: '#contact', style: buttonOutline }, 'Visit Our Lodge', h(ArrowRight, { size: 16 })),
        h('a', { href: `/${params.slug}/petition`, style: buttonGold, className: 'cta-button' }, 'Become a Mason', h(ArrowRight, { size: 16 })),
        // Only rendered when the lodge has enabled donations AND has at
        // least one handle configured. A Donate button leading to a page
        // that cannot take a gift costs more goodwill than no button.
        canDonate
          ? h('a', { key: 'donate', href: `/${params.slug}/donate`, style: buttonOutline }, 'Donate to Lodge', h(HeartHandshake, { size: 16 }))
          : null
      )
    ),
    h(
      'div',
      {
        className: 'public-hero-card',
        style: {
          position: 'relative',
          zIndex: 2,
          background: 'rgba(16, 24, 39, 0.9)',
          border: `1px solid ${gold}42`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.42)',
          padding: '1.5rem',
          backdropFilter: 'blur(18px)',
          overflow: 'hidden',
        },
      },
      h('img', {
        src: lodgeLogo,
        alt: '',
        style: {
          position: 'absolute',
          right: '-26px',
          bottom: '-28px',
          width: 170,
          height: 170,
          objectFit: 'contain',
          opacity: 0.08,
          pointerEvents: 'none',
        },
      }),
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: gold,
            marginBottom: '1rem',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.68rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          },
        },
        h(CalendarDays, { size: 18 }),
        'Upcoming Meeting'
      ),
      nextEvent
        ? h(
            React.Fragment,
            null,
            h(
              'h3',
              { style: { color: cream, fontFamily: 'Cinzel, Georgia, serif', fontSize: '1.35rem', marginBottom: '0.7rem' } },
              nextEvent.title
            ),
            h(
              'div',
              { style: { color: dim, lineHeight: 1.8 } },
              h('div', null, h(Clock, { size: 15, style: { verticalAlign: 'middle', marginRight: 8 } }), formatEventDate(nextEvent.event_date).full),
              nextEvent.location
                ? h('div', null, h(MapPin, { size: 15, style: { verticalAlign: 'middle', marginRight: 8 } }), nextEvent.location)
                : null
            )
          )
        : h('p', { style: { color: dim, lineHeight: 1.75 } }, 'Public meeting details will be posted soon. Contact the lodge for more information.')
    )
  )

const about = h(
  'section',
  {
    id: 'about',
    className: 'public-section fade-up',
    style: {
      padding: '6rem 4rem',
      background: navy,
      borderTop: `1px solid ${gold}20`,
    },
  },

  h(
    'div',
    {
      className: 'public-two-col',
      style: {
        maxWidth: '1180px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1.2fr 0.8fr',
        gap: '4rem',
        alignItems: 'center',
      },
    },

    h(
      'div',
      null,

      h(
        'div',
        {
          style: {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.65rem',
            letterSpacing: '0.28em',
            color: gold,
            textTransform: 'uppercase',
            marginBottom: '1rem',
          },
        },
        'Welcome to the Lodge'
      ),

      h(
        'h2',
        {
          style: {
            fontFamily: 'Cinzel, Georgia, serif',
            color: cream,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            lineHeight: 1.1,
            marginBottom: '1.5rem',
          },
        },
        'A Message From Our Worshipful Master'
      ),

h(
  'div',
  null,

  h(
    'p',
    {
      style: {
        color: dim,
        fontSize: '1.05rem',
        lineHeight: 1.9,
        fontStyle: 'italic',
        marginBottom: '1.5rem',
      },
    },
    // THE LODGE'S OWN WELCOME. This was Psalms of Job's, hardcoded —
    // not as that lodge's content but as the default for whichever
    // lodge was being rendered, which at lodge number two is one
    // lodge publishing another's name as its own. The fallback names
    // the lodge in front of the visitor and nobody else.
    tenant.welcome_message ||
      `On behalf of ${lodgeFullName}, we extend a heartfelt welcome to all who visit our website. May Brotherly Love, Relief, and Truth always be with you on your journey.`
  ),

  h(
    'p',
    {
      style: {
        color: dim,
        fontSize: '1.1rem',
        lineHeight: 1.9,
        marginBottom: '1.5rem',
      },
    },
    // Same again: about_text has always been editable in settings, so
    // a lodge that has written its own is quoted, and one that has not
    // gets wording about itself.
    tenant.about_text ||
      `${lodgeFullName} is a collective group of men from the North, East, South, and West who have come together as Brethren. Our purpose is to teach, learn, build fellowship, and serve our communities while preserving the traditions and teachings of Freemasonry.`
  ),

  h(
    'p',
    {
      style: {
        color: dim,
        fontSize: '1.1rem',
        lineHeight: 1.9,
      },
    },
    'We actively support local food banks, community outreach initiatives, and charitable works that strengthen both our lodge and the communities we serve.'
  )
),

      tenant.meeting_schedule
        ? h(
            'div',
            {
              style: {
                marginTop: '2rem',
                padding: '1.25rem',
                borderLeft: `3px solid ${gold}`,
                background: `${gold}12`,
              },
            },
            h(
              'div',
              {
                style: {
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.6rem',
                  letterSpacing: '0.2em',
                  color: gold,
                  marginBottom: '0.4rem',
                },
              },
              'MEETING SCHEDULE'
            ),
            h(
              'div',
              {
                style: {
                  color: cream,
                },
              },
              tenant.meeting_schedule
            )
          )
        : null
    ),

    h(
      'div',
      {
        style: {
          position: 'relative',
          minHeight: '520px',
          border: `1px solid ${gold}35`,
          className: 'wm-card',
backgroundImage: `
  linear-gradient(rgba(10,14,26,0.25), rgba(10,14,26,0.80)),
  linear-gradient(rgba(201,168,76,0.06), rgba(201,168,76,0.06)),
  url('/assets/lodgeos/images/worshipful-master.jpg')
`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          boxShadow: '0 30px 70px rgba(0,0,0,0.34)',
          overflow: 'hidden',
        },
      },

      h(
        'div',
        {
          style: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '1.5rem',
            background:
              'linear-gradient(to top, rgba(5,10,18,.96), rgba(5,10,18,0))',
          },
        },

        h(
          'div',
          {
            style: {
              color: gold,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '.65rem',
              letterSpacing: '.18em',
              textTransform: 'uppercase',
            },
          },
          'Worshipful Master'
        ),

h(
  'div',
  {
    style: {
      color: cream,
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '1.45rem',
      marginTop: '.4rem',
      letterSpacing: '.04em',
    },
  },
  'Garland Reddick'
),

h(
  'div',
  {
    style: {
      color: '#D3C8B5',
      fontStyle: 'italic',
      marginTop: '.75rem',
      lineHeight: 1.6,
      maxWidth: '420px',
    },
  },
  '"May Brotherly Love, Relief, and Truth always be with you on your journey."'
)
      )
    )
  )
)
  // const pillarsSection = h(
  //   'section',
  //   { id: 'freemasonry', className: 'public-section', style: { padding: '5.5rem 4rem', background: navy, borderTop: `1px solid ${gold}18` } },
  //   h(
  //     'div',
  //     { style: { maxWidth: '1180px', margin: '0 auto' } },
  //     h(
  //       'div',
  //       { style: { textAlign: 'center', marginBottom: '3rem' } },
  //       h('div', { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.28em', color: gold, textTransform: 'uppercase', marginBottom: '1rem' } }, 'Our Foundation'),
  //       h('h2', { style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: '2.4rem', color: cream } }, 'The Work of a Mason')
  //     ),
  //     h(
  //       'div',
  //       { className: 'public-pillars-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' } },
  //       pillars.map(({ title, text, Icon }) =>
  //         h(
  //           'div',
  //           { key: title, style: { background: panel, border: `1px solid ${gold}24`, padding: '1.5rem', minHeight: '220px' } },
  //           h(Icon, { size: 38, color: gold, strokeWidth: 1.45 }),
  //           h('h3', { style: { fontFamily: 'Cinzel, Georgia, serif', color: cream, fontSize: '1.05rem', marginTop: '1.1rem', marginBottom: '0.75rem' } }, title),
  //           h('p', { style: { color: dim, fontSize: '0.95rem', lineHeight: 1.75 } }, text)
  //         )
  //       )
  //     )
  //   )
  // )

const impactSection = h(
  'section',
  {
    className: 'public-section fade-up fade-up-delay-1',
    style: {
      padding: '4rem 2rem',
backgroundImage: `
  linear-gradient(
    rgba(13,27,42,.50),
    rgba(13,27,42,.50)
  ),
  url('/assets/lodgeos/images/foundation-bg.jpg')
`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      borderTop: `1px solid ${gold}18`,
      borderBottom: `1px solid ${gold}18`,
    },
  },
h('div', {
  style: {
    width: '140px',
    height: '2px',
    background: gold,
    margin: '0 auto 1.5rem',
  },
}),
  h(
    'div',
    {
      style: {
        textAlign: 'center',
        marginBottom: '3rem',
      },
    },

    h(
      'div',
      {
        style: {
          color: gold,
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '.25em',
          textTransform: 'uppercase',
          fontSize: '.7rem',
          marginBottom: '1rem',
        },
      },
      'Our Foundation'
    ),

    h(
      'h2',
      {
        style: {
          color: cream,
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: 'clamp(1.6rem, 6vw, 2.5rem)',
          margin: 0,
        },
      },
      'The Principles That Guide Our Lodge'
    ),

    h(
      'p',
      {
        style: {
          color: dim,
          maxWidth: '700px',
          margin: '1rem auto 0',
          lineHeight: 1.8,
        },
      },
      'The values that shape our brethren, strengthen our families, and guide our service to the community.'
    )
    
  ),
h('div', {
  style: {
    width: '140px',
    height: '1px',
    background: `${gold}55`,
    margin: '2rem auto 0',
  },
}),
  h(
    'div',
    {
      className: 'public-impact-grid',
      style: {
        maxWidth: '1180px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '1rem',
      },
    },

impact.map(({ value, label, Icon }) =>
  h(
    'div',
    {
      key: label,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: '100%',
      },
    },

h(
  'div',
  {
    style: {
      width: '60px',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 1rem',
    },
  },
h(Icon, {
  size: 38,
  color: gold,
  strokeWidth: 1.45,
  className: 'foundation-icon',
})

),

        h(
          'div',
          {
            style: {
              color: gold,
              fontFamily: 'Cinzel, Georgia, serif',
              fontSize: '2rem',
              marginTop: '.75rem',
            },
          },
          value
        ),

        h(
          'div',
          {
            style: {
              color: cream,
              fontSize: '.8rem',
              letterSpacing: '.12em',
              textTransform: 'uppercase',
            },
          },
          label
        )
      )
    )
  )
)

  const eventsSection =
    events && events.length > 0
      ? h(
          'section',
          { id: 'events', className: 'public-section', style: { padding: '6rem 4rem', background: navy } },
          h(
            'div',
            { className: 'public-events-grid', style: { maxWidth: '1180px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: '3rem', alignItems: 'start' } },
            h(
              'div',
              null,
              h('div', { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.28em', color: gold, textTransform: 'uppercase', marginBottom: '1rem' } }, 'Lodge Calendar'),
              h('h2', { style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: '2.4rem', color: cream, marginBottom: '2rem' } }, 'Upcoming Events'),
              h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: '1px' } },
                events.map((ev: any) => {
                  const d = formatEventDate(ev.event_date)

                  return h(
                    'div',
                    { key: ev.id, style: { display: 'grid', gridTemplateColumns: '78px 1fr', gap: '1.25rem', padding: '1.25rem', background: panel, border: `1px solid ${gold}20` } },
                    h(
                      'div',
                      { style: { textAlign: 'center', borderRight: `1px solid ${gold}24`, paddingRight: '1rem' } },
                      h('div', { style: { color: gold, fontFamily: 'Cinzel, Georgia, serif', fontSize: '2rem', lineHeight: 1 } }, d.day),
                      h('div', { style: { color: dim, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: '0.16em' } }, d.month)
                    ),
                    h(
                      'div',
                      null,
                      h('div', { style: { color: cream, fontFamily: 'Cinzel, Georgia, serif', fontSize: '1.05rem', marginBottom: '0.35rem' } }, ev.title),
                      h('div', { style: { color: dim, fontSize: '0.9rem', fontStyle: 'italic' } }, `${ev.location || ''}${ev.dress_code ? ` · ${ev.dress_code}` : ''}`)
                    )
                  )
                })
              )
            )
          )
        )
      : null

  /**
   * THE GALLERY IS ITS OWN SECTION NOW.
   *
   * It used to be the right-hand column of the events grid, which meant
   * a lodge with nothing in its calendar had no gallery either — the
   * events section returned null and took the photographs with it. Two
   * unrelated things sharing one condition.
   */
  const gallerySection = showGallery
    ? h(
        'section',
        { id: 'gallery', className: 'public-section fade-up', style: { padding: '6rem 4rem', background: '#0F1D2E' } },
        h(
          'div',
          { style: { maxWidth: '1180px', margin: '0 auto' } },
          h('div', { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.28em', color: gold, textTransform: 'uppercase', marginBottom: '1rem' } }, 'Photographs'),
          h('h2', { style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: '2.4rem', color: cream, marginBottom: tenant.gallery_intro ? '0.75rem' : '2rem' } },
            tenant.gallery_heading || 'Our Lodge'),
          tenant.gallery_intro
            ? h('p', { style: { fontFamily: 'Crimson Pro, Georgia, serif', fontSize: '1.05rem', color: dim, maxWidth: '46rem', marginBottom: '2rem', lineHeight: 1.7 } }, tenant.gallery_intro)
            : null,
          h(PublicGallery, { photos: galleryPreview as any, lodgeName: `${tenant.name} #${tenant.number}`, thumbLabel: tenant.gallery_thumb_label ?? 'caption' }),
          h(
            'div',
            { style: { marginTop: '2rem' } },
            h(
              'a',
              {
                href: `/${params.slug}/gallery`,
                style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.2em', color: gold, textDecoration: 'none', textTransform: 'uppercase', border: `1px solid ${gold}40`, padding: '11px 20px', display: 'inline-block' },
              },
              galleryMore > 0
                ? `See all ${(galleryPhotos ?? []).length} photographs →`
                : 'Open the gallery →'
            )
          )
        )
      )
    : null

const cta = h(
  'section',
  {
    id: 'contact',
    className: 'public-section fade-up fade-up-delay-2',
    style: {
      padding: '3rem 2rem',
      textAlign: 'center',
background: `
  radial-gradient(circle at center top, rgba(201,168,76,0.12), transparent 45%),
  #0D1B2A
`,
      borderTop: `1px solid ${gold}18`,
    },
  },

  h('div', {
    style: {
      width: '120px',
      height: '2px',
      background: gold,
      margin: '0 auto 2rem',
    },
  }),

  // h('img', {
  //   src: lodgeLogo,
  //   alt: `${tenant.name} logo`,
  //   style: {
  //     width: 110,
  //     height: 110,
  //     objectFit: 'contain',
  //     marginBottom: '1rem',
  //   },
  // }),

  h(
    'h2',
    {
      style: {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '2.5rem',
        color: cream,
        marginTop: '1rem',
        marginBottom: '1rem',
      },
    },
    'Take The First Step Toward Masonry'
  ),

  h(
    'p',
    {
      style: {
        fontSize: '1.05rem',
        color: dim,
        fontStyle: 'italic',
        maxWidth: '650px',
        margin: '0 auto 2.5rem',
        lineHeight: 1.8,
      },
    },
    'Take the first step toward Brotherhood, personal growth, leadership, and service to your community.'
  ),

  h(
    'a',
    {
      href: `/${params.slug}/petition`,
      style: buttonGold,
      className: 'cta-button',
    },
    'Start Your Journey',
    h(ArrowRight, { size: 16 })
  )
)

  const footer = h(
    'footer',
    { className: 'public-section', style: { background: '#0D1B2A', borderTop: `1px solid ${gold}15`, padding: '6rem 2rem' } },
    h(
      'div',
      { className: 'public-footer-grid', style: { maxWidth: '1180px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '2rem' } },
      h(
        'div',
        null,
        h('div', { style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: '1.25rem', color: gold, marginBottom: '0.5rem' } }, `${tenant.name} #${tenant.number}`),
        h('div', { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: dim, letterSpacing: '0.2em', marginBottom: '1rem' } }, `${tenant.rite || ''} · ${tenant.city ? `${tenant.city}, ${tenant.state}` : ''}`),
        h('p', { style: { color: muted, lineHeight: 1.7, maxWidth: '420px' } }, 'Brotherhood, relief, truth, and service to the community.')
      ),
      h(
        'div',
        null,
        h('div', { style: { color: gold, marginBottom: '1rem' } }, 'Visit'),
        h('div', { style: { color: dim, lineHeight: 1.8 } }, tenant.address || 'Contact for location', tenant.city ? `, ${tenant.city}, ${tenant.state} ${tenant.zip || ''}` : '')
      ),
      h(
        'div',
        null,
        h('div', { style: { color: gold, marginBottom: '1rem' } }, 'Contact'),
        h(
          'div',
          { style: { color: dim, lineHeight: 1.8 } },
          tenant.email
            ? h('div', null, h(Mail, { size: 14, style: { verticalAlign: 'middle', marginRight: 8 } }), tenant.email)
            : null,
          h('a', { href: '/auth/login', style: { color: gold, textDecoration: 'none' } }, 'Brother Login'),
          h(
            NeedLoginDialog,
            {
              slug: params.slug,
              lodgeName: lodgeFullName,
              // Dimmer than the login above it, for the same reason as
              // the mobile menu: it is the fallback, not a second front
              // door of equal standing.
              style: { color: dim, display: 'block', marginTop: 6, fontStyle: 'italic', fontSize: '0.9em' },
            },
            'Need a login?'
          )
        )
      )
    )
  )

  return h(
    'div',
    {
      style: {
        minHeight: '100vh',
        background: navy,
        color: cream,
        fontFamily: 'Georgia, serif',
      },
    },
    responsiveStyles,
    nav,
    hero,
    about,
    // pillarsSection,
    impactSection,
    eventsSection,
    gallerySection,
    cta,
    footer
  )
}
