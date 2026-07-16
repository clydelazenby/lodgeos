'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function OnboardingDonePage() {
  const [slug, setSlug] = useState('')

  useEffect(() => {
    const s = sessionStorage.getItem('onboarding_slug') || ''
    setSlug(s)
    sessionStorage.removeItem('onboarding_tenant_id')
    sessionStorage.removeItem('onboarding_slug')
  }, [])

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✦</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '1rem' }}>SETUP COMPLETE</div>
      <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', color: '#F5F0E8', marginBottom: '1rem' }}>Your lodge is live.</h1>
      <p style={{ fontSize: '1.1rem', color: '#B8B0A0', fontStyle: 'italic', lineHeight: 1.7, maxWidth: '460px', margin: '0 auto 3rem' }}>
        Your LodgeOS platform is ready. Start by adding members, creating events, and setting up dues collection from your admin dashboard.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '3rem', textAlign: 'left' }}>
        {[
          { emoji: '👥', title: 'Add members', desc: 'Invite brothers to the portal', href: slug ? `/lodge/${slug}/members` : '#' },
          { emoji: '📅', title: 'Create events', desc: 'Schedule your first meeting', href: slug ? `/lodge/${slug}/events` : '#' },
          { emoji: '💳', title: 'Setup payments', desc: 'Connect Stripe for dues', href: slug ? `/lodge/${slug}/settings` : '#' },
          { emoji: '🌐', title: 'View public site', desc: 'See your live lodge website', href: slug ? `/lodge/${slug}` : '#' },
        ].map(({ emoji, title, desc, href }) => (
          <Link key={title} href={href} style={{ background: '#141C2E', padding: '1.5rem', textDecoration: 'none', display: 'block', transition: 'background 0.2s' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{emoji}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: '#C9A84C', marginBottom: '0.25rem' }}>{title}</div>
            <div style={{ fontSize: '0.85rem', color: '#B8B0A0' }}>{desc}</div>
          </Link>
        ))}
      </div>

      <Link href={slug ? `/lodge/${slug}/dashboard` : '/auth/login'} className="btn-gold" style={{ fontSize: '0.75rem', padding: '14px 40px' }}>
        Go to Dashboard →
      </Link>

      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'rgba(184,176,160,0.3)', marginTop: '1.5rem', letterSpacing: '0.1em' }}>
        LIBERTY · EQUALITY · FRATERNITY
      </p>
    </div>
  )
}
