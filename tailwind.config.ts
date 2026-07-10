import type { Config } from 'tailwindcss'

// ============================================================
// LODGE OS DESIGN SYSTEM — "the ledger book"
// Replaces the earlier Cinzel/navy/gold "temple portal" theme.
// Grounded in a physical object every Secretary/Treasurer has
// actually held: a cloth-bound, brass-cornered ledger, ruled in
// faint ink, entries in fountain pen. Digitizes a ledger, so it
// should look like one, not a mystical temple portal.
// ============================================================
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // DEPRECATED — kept only so existing `bg-navy-card` / `text-gold`
        // etc. class usages don't throw a build error while pages get
        // migrated one at a time. Intentionally NOT aliased to the new
        // palette's equivalents — that would be a landmine for a future
        // reader who reasonably expects `bg-navy-card` to mean a dark
        // surface. Left at original dark-theme values so any remaining
        // usage is visibly wrong (a dark box in an otherwise-vellum
        // page) and gets caught in review.
        gold: { DEFAULT: '#C9A84C', light: '#E8C97A', dark: '#8B6914', muted: '#F5EDD4' },
        navy: { DEFAULT: '#0A0E1A', mid: '#111827', light: '#1C2640', card: '#141C2E' },
        cream: { DEFAULT: '#F5F0E8', dim: '#B8B0A0' },

        // Current system — use these for all new and migrated work.
        vellum: { DEFAULT: '#F7F3E8', dim: '#EDE6D3' },
        ink: { DEFAULT: '#1C1810', faint: '#6B6252', fainter: '#A39A87' },
        seal: { DEFAULT: '#8B1E1E', dim: '#F1E1DD' }, // the one accent — corrections, alerts, the wax seal itself
        ledger: { DEFAULT: '#2F4538', dim: '#E2E8DE' }, // credits, positive, the felt-desk-blotter green
        brass: { DEFAULT: '#B8923F', light: '#D9C486', dim: '#EFE6CC' },
      },
      fontFamily: {
        // DEPRECATED, same reasoning as colors above — left pointing at
        // their ORIGINAL fonts, not silently redirected.
        cinzel: ['Cinzel', 'serif'],
        crimson: ['Crimson Pro', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],

        // Current system.
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Source Sans 3', '-apple-system', 'system-ui', 'sans-serif'],
        figure: ['Spectral', 'Georgia', 'serif'], // figures & dates — a serif with slight ink-trap character, deliberately not a true monospace
      },
      borderRadius: {
        DEFAULT: '2px', // small interactive elements get a hint of a rounded corner, like a hand-rounded ink stamp
      },
    },
  },
  plugins: [],
}
export default config
