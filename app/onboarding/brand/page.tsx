'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PRESET_COLORS = [
  { name: 'Gold & Navy', primary: '#C9A84C', secondary: '#0A0E1A' },
  { name: 'Royal Blue', primary: '#2563EB', secondary: '#1E3A5F' },
  { name: 'Forest Green', primary: '#16A34A', secondary: '#0F2E1A' },
  { name: 'Deep Purple', primary: '#7C3AED', secondary: '#1E0A3C' },
  { name: 'Crimson', primary: '#DC2626', secondary: '#1A0A0A' },
  { name: 'Steel Blue', primary: '#0284C7', secondary: '#0A1628' },
]

export default function BrandPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tenantId, setTenantId] = useState('')
  const [primary, setPrimary] = useState('#C9A84C')
  const [secondary, setSecondary] = useState('#0A0E1A')
  const [aboutText, setAboutText] = useState('')
  const [meetingSchedule, setMeetingSchedule] = useState('')
  const [duesAmount, setDuesAmount] = useState('60')

  useEffect(() => {
    const id = sessionStorage.getItem('onboarding_tenant_id')
    if (!id) { router.push('/onboarding/setup'); return }
    setTenantId(id)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('tenants').update({
      primary_color: primary,
      secondary_color: secondary,
      about_text: aboutText,
      meeting_schedule: meetingSchedule,
      dues_amount: parseFloat(duesAmount),
    }).eq('id', tenantId)
    router.push('/onboarding/members')
    setLoading(false)
  }

  const inputStyle = { width: '100%', background: '#141C2E', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '11px 15px', fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', outline: 'none', borderRadius: '4px' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  return (
    <div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.75rem' }}>STEP 2 OF 5</div>
      <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: '#F5F0E8', marginBottom: '0.5rem' }}>Customize your branding</h1>
      <p style={{ fontSize: '1.1rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2.5rem' }}>Choose your lodge colors and add some content for your public website.</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Color presets */}
        <div>
          <label style={labelStyle}>Color Theme</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1rem' }}>
            {PRESET_COLORS.map(({ name, primary: p, secondary: s }) => (
              <button key={name} type="button" onClick={() => { setPrimary(p); setSecondary(s) }}
                style={{ padding: '10px', border: primary === p ? '2px solid #C9A84C' : '1px solid rgba(201,168,76,0.2)', borderRadius: '6px', background: '#141C2E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '2px', background: p }} />
                  <div style={{ width: '14px', height: '14px', borderRadius: '2px', background: s }} />
                </div>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', letterSpacing: '0.05em' }}>{name}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.55rem' }}>Primary Color (accent)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                <input value={primary} onChange={e => setPrimary(e.target.value)} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }} />
              </div>
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.55rem' }}>Secondary Color (background)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)} style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                <input value={secondary} onChange={e => setSecondary(e.target.value)} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div style={{ background: secondary, border: '1px solid rgba(201,168,76,0.2)', padding: '1.5rem', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: primary, letterSpacing: '0.15em', marginBottom: '4px' }}>YOUR LODGE NAME</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>F.∴ & A.∴M.∴</div>
          <div style={{ display: 'inline-block', marginTop: '12px', background: primary, color: secondary, fontFamily: 'Cinzel, serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', padding: '8px 20px', textTransform: 'uppercase' }}>Button Preview</div>
        </div>

        <div>
          <label style={labelStyle}>Annual Dues Amount ($)</label>
          <input type="number" value={duesAmount} onChange={e => setDuesAmount(e.target.value)} placeholder="60" min="0" step="0.01" style={inputStyle} />
          <p style={{ fontSize: '0.82rem', color: '#B8B0A0', marginTop: '4px', fontStyle: 'italic' }}>This is what brothers will be charged each year. You can change it later.</p>
        </div>

        <div>
          <label style={labelStyle}>About Your Lodge (shown on public website)</label>
          <textarea value={aboutText} onChange={e => setAboutText(e.target.value)} rows={4} placeholder="Tell visitors about your lodge — when it was founded, your values, who you are..." style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div>
          <label style={labelStyle}>Meeting Schedule</label>
          <input value={meetingSchedule} onChange={e => setMeetingSchedule(e.target.value)} placeholder="e.g. 2nd Tuesday of each month at 7:00 PM" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="button" onClick={() => router.push('/onboarding/setup')} className="btn-outline" style={{ flex: 1 }}>← Back</button>
          <button type="submit" disabled={loading} className="btn-gold" style={{ flex: 2, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving...' : 'Continue to Members →'}
          </button>
        </div>
      </form>
    </div>
  )
}
