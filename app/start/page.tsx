import Link from 'next/link'
import { PLANS } from '@/types'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)' }}>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(201,168,76,0.15)', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.15em' }}>LODGEOS</div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          {[['Features', '#features'], ['Pricing', '#pricing'], ['About', '#about']].map(([l, h]) => (
            <a key={l} href={h} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', letterSpacing: '0.15em', color: 'var(--cream-dim)', textDecoration: 'none', textTransform: 'uppercase' }}>{l}</a>
          ))}
          <Link href="/auth/login" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--cream-dim)', textDecoration: 'none', letterSpacing: '0.1em' }}>Sign In</Link>
          <Link href="/auth/signup" className="btn-gold" style={{ padding: '10px 24px', fontSize: '0.68rem' }}>Start Free Trial</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6rem 2rem 4rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 40%, rgba(201,168,76,0.07) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '800px', animation: 'fadeUp 1s ease both' }}>
          <div style={{ display: 'inline-block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', padding: '6px 16px', marginBottom: '2rem' }}>
            MASONIC LODGE MANAGEMENT PLATFORM
          </div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, color: 'var(--cream)', lineHeight: 1.05, marginBottom: '1.5rem' }}>
            The Operating System<br /><span style={{ color: 'var(--gold)' }}>for Your Lodge</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--cream-dim)', lineHeight: 1.7, maxWidth: '600px', margin: '0 auto 3rem', fontStyle: 'italic' }}>
            Member management, dues collection, automated emails, and a beautiful public website — all in one platform built specifically for Masonic lodges.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <Link href="/auth/signup" className="btn-gold">Start 14-Day Free Trial</Link>
            <Link href="#features" className="btn-outline">See Features</Link>
          </div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'rgba(184,176,160,0.5)', letterSpacing: '0.1em' }}>
            No credit card required · Set up in 10 minutes · Cancel anytime
          </p>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ padding: '3rem 2rem', borderTop: '1px solid rgba(201,168,76,0.1)', borderBottom: '1px solid rgba(201,168,76,0.1)', background: 'var(--navy-mid)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.3em', color: 'rgba(184,176,160,0.4)', marginBottom: '1.5rem' }}>BUILT FOR LODGES ACROSS THE COUNTRY</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', flexWrap: 'wrap' }}>
          {[['10,000+', 'Masonic lodges in the US'], ['300+', 'Years of Masonic tradition'], ['$0', 'Setup cost'], ['14 days', 'Free trial']].map(([n, l]) => (
            <div key={n} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', fontWeight: 700, color: 'var(--gold)' }}>{n}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--cream-dim)', letterSpacing: '0.1em' }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '7rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '1rem' }}>EVERYTHING YOUR LODGE NEEDS</div>
          <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', color: 'var(--cream)', marginBottom: '1rem' }}>Built for Secretaries.<br />Loved by Brothers.</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--cream-dim)', fontStyle: 'italic', maxWidth: '500px', margin: '0 auto' }}>Everything you need to run a modern lodge — no coding required.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1px', maxWidth: '1100px', margin: '0 auto', background: 'rgba(201,168,76,0.1)' }}>
          {[
            { icon: '👥', title: 'Member Management', desc: 'Full roster with roles, degrees, contact info. Brothers update their own profiles. You stay organized effortlessly.' },
            { icon: '💳', title: 'Online Dues Collection', desc: 'Brothers pay directly from their portal. Stripe processes payment. Status updates automatically. No more chasing checks.' },
            { icon: '📧', title: 'Automated Emails', desc: 'Dues reminders, event notifications, payment receipts, and welcome emails — all sent automatically without you lifting a finger.' },
            { icon: '🌐', title: 'Public Lodge Website', desc: 'A beautiful, mobile-responsive public site with your lodge info, events calendar, history, and petition form.' },
            { icon: '📅', title: 'Event Management', desc: 'Create events, set dress codes, toggle public/private. Brothers get automatic 48-hour reminders before every event.' },
            { icon: '📋', title: 'Petition Management', desc: 'Petitions submitted online. You get notified immediately. Review, approve, or deny from your dashboard.' },
            { icon: '📁', title: 'Document Library', desc: 'Degree study materials, meeting minutes, bylaws — all stored securely with degree-based access control.' },
            { icon: '⚙️', title: 'No-Code Admin', desc: 'Change your lodge name, colors, content, dues amount, and settings from a simple dashboard. No code ever.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ background: 'var(--navy-mid)', padding: '2.5rem 2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{icon}</div>
<<<<<<< HEAD
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'var(--gold)', marginBottom: '0.75rem' }}>{title}</div>
=======
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--gold)', marginBottom: '0.75rem' }}>{title}</div>
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
              <p style={{ fontSize: '0.95rem', color: 'var(--cream-dim)', lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '6rem 2rem', background: 'var(--navy-mid)', borderTop: '1px solid rgba(201,168,76,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '1rem' }}>SETUP IN MINUTES</div>
          <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', color: 'var(--cream)' }}>From signup to live in 10 minutes</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', maxWidth: '900px', margin: '0 auto' }}>
          {[
            { step: '01', title: 'Create your account', desc: 'Sign up with your email. No credit card required for the 14-day trial.' },
            { step: '02', title: 'Set up your lodge', desc: 'Enter your lodge name, number, location, and colors. Your site is live instantly.' },
            { step: '03', title: 'Add your brothers', desc: 'Enter member details or send email invitations. Brothers set up their own portals.' },
            { step: '04', title: 'Sit back', desc: 'Dues reminders send automatically. Brothers pay online. You manage from your dashboard.' },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2.5rem', fontWeight: 900, color: 'rgba(201,168,76,0.3)', marginBottom: '1rem' }}>{step}</div>
<<<<<<< HEAD
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'var(--cream)', marginBottom: '0.75rem' }}>{title}</div>
=======
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--cream)', marginBottom: '0.75rem' }}>{title}</div>
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
              <p style={{ fontSize: '0.92rem', color: 'var(--cream-dim)', lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: '7rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '1rem' }}>SIMPLE PRICING</div>
          <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', color: 'var(--cream)', marginBottom: '1rem' }}>One price. Everything included.</h2>
<<<<<<< HEAD
          <p style={{ fontSize: '1.1rem', color: 'var(--cream-dim)', fontStyle: 'italic' }}>14-day free trial on all plans. No credit card required.</p>
=======
          <p style={{ fontSize: '1rem', color: 'var(--cream-dim)', fontStyle: 'italic' }}>14-day free trial on all plans. No credit card required.</p>
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1px', maxWidth: '900px', margin: '0 auto', background: 'rgba(201,168,76,0.1)' }}>
          {Object.entries(PLANS).map(([key, plan]) => (
            <div key={key} style={{ background: key === 'pro' ? 'var(--navy-light)' : 'var(--navy-card)', padding: '2.5rem 2rem', position: 'relative' }}>
              {key === 'pro' && (
                <div style={{ position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', color: 'var(--navy)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.1em', padding: '4px 16px', textTransform: 'uppercase' }}>Most Popular</div>
              )}
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: key === 'pro' ? 'var(--gold)' : 'var(--cream)', marginBottom: '1rem' }}>{plan.name}</div>
<<<<<<< HEAD
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2.5rem', fontWeight: 700, color: 'var(--cream)', marginBottom: '0.25rem' }}>${plan.price_monthly}<span style={{ fontSize: '1.1rem', color: 'var(--cream-dim)', fontFamily: 'Crimson Pro, serif', fontWeight: 400 }}>/mo</span></div>
=======
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2.5rem', fontWeight: 700, color: 'var(--cream)', marginBottom: '0.25rem' }}>${plan.price_monthly}<span style={{ fontSize: '1rem', color: 'var(--cream-dim)', fontFamily: 'Crimson Pro, serif', fontWeight: 400 }}>/mo</span></div>
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--gold)', marginBottom: '1.5rem' }}>or ${plan.price_annual}/mo billed annually</div>
              <div className="gold-divider" style={{ marginBottom: '1.5rem' }} />
              {plan.features.map(f => (
                <div key={f} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.6rem', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--gold)', flexShrink: 0, marginTop: '2px' }}>✓</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--cream-dim)' }}>{f}</span>
                </div>
              ))}
              <Link href="/auth/signup" className={key === 'pro' ? 'btn-gold' : 'btn-outline'} style={{ display: 'block', textAlign: 'center', marginTop: '2rem', fontSize: '0.68rem' }}>
                Start Free Trial
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '6rem 2rem', background: 'var(--navy-mid)', borderTop: '1px solid rgba(201,168,76,0.1)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: 'var(--cream)', marginBottom: '1rem' }}>Ready to modernize<br />your lodge?</h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--cream-dim)', fontStyle: 'italic', marginBottom: '2.5rem', maxWidth: '500px', margin: '0 auto 2.5rem' }}>Join lodges across the country using LodgeOS to save time, collect dues online, and keep every brother informed.</p>
        <Link href="/auth/signup" className="btn-gold" style={{ fontSize: '0.8rem', padding: '16px 48px' }}>Start Your Free Trial Today</Link>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(184,176,160,0.4)', marginTop: '1.5rem', letterSpacing: '0.1em' }}>14 days free · No credit card · Setup in 10 minutes</p>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'var(--navy)', borderTop: '1px solid rgba(201,168,76,0.1)', padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: '0.5rem' }}>LODGEOS</div>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--cream-dim)', letterSpacing: '0.2em', marginBottom: '2rem' }}>THE OPERATING SYSTEM FOR YOUR LODGE</p>
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[['Features', '#features'], ['Pricing', '#pricing'], ['Sign In', '/auth/login'], ['Start Free Trial', '/auth/signup']].map(([l, h]) => (
            <Link key={l} href={h} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: 'var(--cream-dim)', textDecoration: 'none', letterSpacing: '0.1em' }}>{l}</Link>
          ))}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'rgba(184,176,160,0.3)', fontStyle: 'italic' }}>© 2026 LodgeOS · Built with Brotherhood in Mind</p>
      </footer>
    </div>
  )
}
