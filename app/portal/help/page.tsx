import { HelpBook } from '@/components/help/HelpBook'

/**
 * The guide, on the brother's side.
 *
 * IT EXISTS ON BOTH SIDES ON PURPOSE. /lodge/[slug]/help is behind a
 * layout that redirects the plain member tier to the portal before the
 * page renders — the same trap that left the duties page open and
 * unreachable at once. A guide half the roster cannot open is not a
 * guide.
 *
 * The content is identical. A brother reading the section on dues
 * reads what the Treasurer reads; every section says plainly who may
 * do the thing, which is more use to him than hiding it would be.
 */
export const metadata = { title: 'Help — LodgeOS' }

export default function PortalHelpPage({
  searchParams,
}: {
  searchParams?: { topic?: string }
}) {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          HELP
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          How this app works
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          Every screen, and what to do on it. There is also a <strong style={{ color: '#C9A84C' }}>?</strong> at
          the top of every page, which opens the part about the page you are on.
        </p>
      </div>

      <HelpBook initialTopic={searchParams?.topic} />
    </div>
  )
}
