import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: tenant } = await supabase.from('tenants').select('name, number, about_text').eq('slug', params.slug).single()
  if (!tenant) return { title: 'Lodge Not Found' }
  return {
    title: `${tenant.name} #${tenant.number}`,
    description: tenant.about_text || `${tenant.name} #${tenant.number} — Masonic Lodge`,
  }
}

export default async function PublicLodgePage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: tenant } = await supabase.from('tenants').select('*').eq('slug', params.slug).single()
  if (!tenant) notFound()

  const today = new Date().toISOString().split('T')[0]
  const { data: events } = await supabase
    .from('lodge_events')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_public', true)
    .gte('event_date', today)
    .order('event_date')
    .limit(4)

  const gold = tenant.primary_color || '#C9A84C'
  const navy = tenant.secondary_color || '#0A0E1A'
  const cream = '#F5F0E8'
  const dim = '#B8B0A0'

  return (
    <div style={{ minHeight: '100vh', background: navy, color: cream, fontFamily: 'Georgia, serif' }}>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: `${navy}F0`, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${gold}30`, height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}>
        <div style={{ fontFamily: 'serif', fontSize: '0.9rem', color: gold, letterSpacing: '0.1em' }}>
          {tenant.name} <span style={{ opacity: 0.6 }}>#{tenant.number}</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {[['About', '#about'], ['Events', '#events'], ['Interested in Joining?', `/${params.slug}/petition`]].map(([l, h]) => (
            <a key={l} href={h} style={{ fontFamily: 'serif', fontSize: '0.8rem', color: dim, textDecoration: 'none', letterSpacing: '0.08em' }}>{l}</a>
          ))}
          <Link href="/auth/login" style={{ fontFamily: 'serif', fontSize: '0.75rem', fontWeight: 700, background: gold, color: navy, padding: '8px 18px', textDecoration: 'none', letterSpacing: '0.08em' }}>Brother Login</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6rem 2rem 4rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 50% 60% at 50% 40%, ${gold}08 0%, transparent 70%)` }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '700px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.3em', color: gold, marginBottom: '1.5rem', opacity: 0.8 }}>
            {tenant.city ? `${tenant.city.toUpperCase()}, ${tenant.state} · ` : ''}{tenant.rite}
          </div>
          <h1 style={{ fontFamily: 'serif', fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 700, lineHeight: 1.05, marginBottom: '0.5rem', color: cream }}>
            {tenant.name}
          </h1>
          <div style={{ fontFamily: 'serif', fontSize: '1.5rem', color: gold, marginBottom: '1.5rem' }}>#{tenant.number}</div>
          <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, width: '120px', margin: '0 auto 2rem' }} />
          <p style={{ fontSize: '1.15rem', color: dim, lineHeight: 1.7, fontStyle: 'italic', marginBottom: '3rem' }}>
            {tenant.about_text || 'Brotherhood. Relief. Truth.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={`/${params.slug}/petition`} style={{ background: gold, color: navy, fontFamily: 'serif', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.12em', padding: '14px 32px', textDecoration: 'none', display: 'inline-block' }}>
              Interested in Joining?
            </Link>
            <a href="#about" style={{ background: 'transparent', color: gold, fontFamily: 'serif', fontSize: '0.82rem', letterSpacing: '0.12em', padding: '14px 32px', textDecoration: 'none', border: `1px solid ${gold}60`, display: 'inline-block' }}>
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ padding: '6rem 2rem', background: `${navy}CC`, borderTop: `1px solid ${gold}18` }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.3em', color: gold, marginBottom: '1rem' }}>ABOUT THE LODGE</div>
          <h2 style={{ fontFamily: 'serif', fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', color: cream, marginBottom: '2rem' }}>Who We Are</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem' }}>
            <div>
              <p style={{ fontSize: '1.05rem', color: dim, lineHeight: 1.8, fontStyle: 'italic' }}>
                {tenant.about_text || 'We are a fraternity of men united by principles of Brotherly Love, Relief, and Truth.'}
              </p>
              {tenant.meeting_schedule && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', borderLeft: `3px solid ${gold}`, background: `${gold}08` }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: gold, marginBottom: '0.4rem' }}>MEETING SCHEDULE</div>
                  <p style={{ fontSize: '0.95rem', color: cream }}>{tenant.meeting_schedule}</p>
                </div>
              )}
            </div>
            <div>
              <div style={{ background: `${gold}08`, border: `1px solid ${gold}20`, padding: '1.5rem' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: gold, marginBottom: '1rem' }}>LODGE INFORMATION</div>
                {[
                  ['Location', tenant.address ? `${tenant.address}, ${tenant.city}, ${tenant.state} ${tenant.zip}` : 'Contact for location'],
                  ['Contact', tenant.email || 'See petition form'],
                  ['Rite', tenant.rite],
                  ['Jurisdiction', tenant.jurisdiction || 'See petition form'],
                ].map(([k, v]) => (
                  <div key={k} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: `1px solid ${gold}12` }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.58rem', color: gold, marginBottom: '2px', letterSpacing: '0.1em' }}>{k}</div>
                    <div style={{ fontSize: '0.95rem', color: cream }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section style={{ padding: '5rem 2rem', borderTop: `1px solid ${gold}18` }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.3em', color: gold, marginBottom: '1rem' }}>OUR FOUNDATION</div>
          <h2 style={{ fontFamily: 'serif', fontSize: '2rem', color: cream }}>The Three Great Lights</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', maxWidth: '900px', margin: '0 auto', background: `${gold}18` }}>
          {[
            { title: 'Brotherly Love', text: 'We regard the whole human species as one family. Every man is our brother.' },
            { title: 'Relief', text: 'To soothe the unhappy, sympathize with misfortunes, and restore peace to the troubled mind.' },
            { title: 'Truth', text: 'A divine attribute and the foundation of every virtue. To be good and true is our first lesson.' },
          ].map(({ title, text }) => (
            <div key={title} style={{ background: navy, padding: '2.5rem 2rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'serif', fontSize: '1rem', color: gold, marginBottom: '0.75rem', letterSpacing: '0.08em' }}>{title}</div>
              <p style={{ fontSize: '0.95rem', color: dim, lineHeight: 1.7 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EVENTS */}
      {events && events.length > 0 && (
        <section id="events" style={{ padding: '5rem 2rem', background: `${navy}CC`, borderTop: `1px solid ${gold}18` }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.3em', color: gold, marginBottom: '1rem' }}>LODGE CALENDAR</div>
            <h2 style={{ fontFamily: 'serif', fontSize: '2rem', color: cream }}>Upcoming Events</h2>
          </div>
          <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1px', background: `${gold}18` }}>
            {events.map((ev: any) => {
              const d = new Date(ev.event_date + 'T12:00:00')
              return (
                <div key={ev.id} style={{ background: navy, padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '70px 1fr', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', borderRight: `1px solid ${gold}20`, paddingRight: '1.5rem' }}>
                    <div style={{ fontFamily: 'serif', fontSize: '1.8rem', fontWeight: 700, color: gold, lineHeight: 1 }}>{d.getDate()}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.15em', color: dim, textTransform: 'uppercase' }}>{d.toLocaleString('en-US', { month: 'short' })}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'serif', fontSize: '1rem', color: cream, marginBottom: '0.25rem' }}>{ev.title}</div>
                    <div style={{ fontSize: '0.88rem', color: dim, fontStyle: 'italic' }}>{ev.location || ''}{ev.dress_code ? ` · ${ev.dress_code}` : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ padding: '6rem 2rem', textAlign: 'center', borderTop: `1px solid ${gold}18` }}>
        <h2 style={{ fontFamily: 'serif', fontSize: '2rem', color: cream, marginBottom: '1rem' }}>Begin Your Journey</h2>
        <p style={{ fontSize: '1.05rem', color: dim, fontStyle: 'italic', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Freemasonry makes good men better. The first step is yours to take.
        </p>
        <Link href={`/${params.slug}/petition`} style={{ background: gold, color: navy, fontFamily: 'serif', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.12em', padding: '16px 40px', textDecoration: 'none', display: 'inline-block' }}>
          Interested in Joining?
        </Link>
        <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: `${dim}70`, letterSpacing: '0.15em', marginTop: '1.25rem' }}>PETITION FOR MEMBERSHIP · TAKES 5 MINUTES</p>
      </section>

      {/* FOOTER */}
      <footer style={{ background: navy, borderTop: `1px solid ${gold}15`, padding: '2.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'serif', fontSize: '1rem', color: gold, marginBottom: '0.4rem' }}>{tenant.name} #{tenant.number}</div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.58rem', color: dim, letterSpacing: '0.2em', marginBottom: '1.5rem' }}>{tenant.rite} · {tenant.city ? `${tenant.city}, ${tenant.state}` : ''}</div>
        <div style={{ fontSize: '0.78rem', color: `${dim}50`, fontStyle: 'italic' }}>
          Powered by <a href="/" style={{ color: gold, textDecoration: 'none' }}>LodgeOS</a>
        </div>
      </footer>
    </div>
  )
}
