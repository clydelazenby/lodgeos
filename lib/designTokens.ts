/**
 * LodgeOS design tokens — "Piedmont" direction.
 *
 * Replaces the earlier vellum/brass ledger system (which only ever
 * landed on the Dues and Dashboard pages) with the dark navy/gold
 * "private club" look from the reference mockup, per explicit
 * direction: full replacement across every page, not a second
 * competing system living alongside vellum.
 *
 * Previously each page defined its own inline `const T = {...}` block
 * (see the old Dues/Dashboard pages) — copied by hand page to page,
 * which is exactly how the app ended up with vellum on 2 pages and
 * navy/Cinzel on the rest in the first place. This file is the fix:
 * one real source of truth, imported everywhere, so a future palette
 * adjustment happens once instead of N times.
 *
 * Values are read from the reference image directly (icon-badge gold,
 * deep navy card backgrounds, layered panel tones) and reconciled
 * against schema.sql's existing tenant.primary_color/secondary_color
 * defaults (#C9A84C gold / #0A0E1A navy) — those defaults already
 * pointed this direction pre-vellum, so this isn't a foreign palette,
 * it's closer to the app's original bones than vellum was.
 */

export const T = {
  // Backgrounds — three layers of depth, darkest to lightest, matching
  // the reference's visible card-on-card layering (sidebar vs. main
  // canvas vs. individual stat cards are each a slightly different shade).
  bg: '#0A0E1A',          // outermost canvas — matches tenant.secondary_color default exactly
  bgPanel: '#111827',     // sidebar / header bar
  bgCard: '#141C2E',      // individual cards, table rows, widgets

  // Text
  ink: '#F5F0E8',         // primary text — warm off-white, not pure white, matching the reference's slightly cream body text
  inkFaint: '#B8B0A0',    // secondary text, timestamps, labels
  inkFainter: '#6B6355',  // tertiary, placeholder-level text

  // Gold — the one accent, matching tenant.primary_color default exactly.
  // Used for icon badges, active nav states, primary buttons, headings.
  gold: '#C9A84C',
  goldDim: 'rgba(201,168,76,0.15)',   // tinted backgrounds behind gold icon badges
  goldBorder: 'rgba(201,168,76,0.3)', // hairline borders on gold-accented elements

  // Status colors — used sparingly and only for actual status (checkmarks,
  // trend arrows, present/absent), never as decoration. Matches the
  // research's "semantic colors reserved for status" principle, carried
  // over from the vellum system rather than abandoned with it.
  success: '#5DBE85',
  successDim: 'rgba(93,190,133,0.12)',
  danger: '#E74C3C',
  dangerDim: 'rgba(231,76,60,0.12)',
  info: '#7BB8D4',
  infoDim: 'rgba(123,184,212,0.12)',

  // Borders — hairline dividers throughout, matching the reference's
  // subtle card edges rather than heavy drop shadows.
  border: 'rgba(201,168,76,0.12)',
  borderStrong: 'rgba(201,168,76,0.25)',

  // Typography — a classic serif for display/headings on the dark
  // canvas (the reference uses something in the Cinzel/Trajan family),
  // a clean sans for body/UI text, and a monospace for figures/labels
  // where precision matters (dates, counts, timers).
  display: "'Cinzel', Georgia, serif",
  body: "'Inter', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",

  radius: '10px', // the reference's cards read as softly, consistently rounded — not sharp, not pill-shaped
} as const

/**
 * Pill/badge tone helper — small colored status chips (dues status,
 * attendance status, event type) used throughout every page. Centralized
 * here so every page's pill looks identical rather than each page
 * inventing its own color mapping.
 */
export const pillTone = (tone: 'gold' | 'success' | 'danger' | 'info' | 'neutral') => {
  const map = {
    gold: { bg: T.goldDim, text: T.gold, border: T.goldBorder },
    success: { bg: T.successDim, text: T.success, border: 'rgba(93,190,133,0.3)' },
    danger: { bg: T.dangerDim, text: T.danger, border: 'rgba(231,76,60,0.3)' },
    info: { bg: T.infoDim, text: T.info, border: 'rgba(123,184,212,0.3)' },
    neutral: { bg: 'rgba(184,176,160,0.1)', text: T.inkFaint, border: 'rgba(184,176,160,0.25)' },
  }
  return map[tone]
}
