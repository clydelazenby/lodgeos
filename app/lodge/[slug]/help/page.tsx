import { HelpBook } from '@/components/help/HelpBook'

/**
 * The guide, on the lodge side.
 *
 * No capability gate, and none is wanted: this is documentation, not
 * data. Every officer who can reach the lodge side can read all of it,
 * and each section states who may actually perform the thing it
 * describes — which is how an officer works out that he needs the
 * Secretary rather than that the app is broken.
 *
 * The identical page exists at /portal/help for the brethren, because
 * the layout above this one turns the member tier away.
 */
export const metadata = { title: 'Help — LodgeOS' }

export default function LodgeHelpPage({
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
