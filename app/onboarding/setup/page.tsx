'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', number: '', rite: 'F&AM', jurisdiction: '',
    address: '', city: '', state: 'NC', zip: '',
    email: '', phone: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
<<<<<<< HEAD
      const supabase = createClient()
=======
      const supabase = await createClient()
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Generate slug
      const slug = `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${form.number}`
        .replace(/^-+|-+$/g, '')

      // Create tenant
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({ ...form, slug })
        .select()
        .single()
      if (tenantErr) throw tenantErr

      // Add creator as admin
      await supabase.from('tenant_members').insert({
        tenant_id: tenant.id,
        user_id: user.id,
        tenant_role: 'admin',
        lodge_role: 'Secretary',
        degree: 'EA',
        is_active: true,
      })

      // Store tenant in session for next steps
      sessionStorage.setItem('onboarding_tenant_id', tenant.id)
      sessionStorage.setItem('onboarding_slug', slug)

      router.push('/onboarding/brand')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

<<<<<<< HEAD
  const inputStyle = { width: '100%', background: '#141C2E', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '11px 15px', fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', outline: 'none', borderRadius: '4px', transition: 'border-color 0.2s' }
=======
  const inputStyle = { width: '100%', background: '#141C2E', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '11px 15px', fontFamily: 'Crimson Pro, serif', fontSize: '1rem', outline: 'none', borderRadius: '4px', transition: 'border-color 0.2s' }
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  return (
    <div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.75rem' }}>STEP 1 OF 5</div>
      <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: '#F5F0E8', marginBottom: '0.5rem' }}>Tell us about your lodge</h1>
<<<<<<< HEAD
      <p style={{ fontSize: '1.1rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2.5rem' }}>This information will appear on your public lodge website.</p>
=======
      <p style={{ fontSize: '1rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2.5rem' }}>This information will appear on your public lodge website.</p>
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Lodge Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Psalms of Job Lodge" style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>Lodge Number *</label>
            <input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="1827" style={inputStyle} required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Rite</label>
            <select value={form.rite} onChange={e => setForm(p => ({ ...p, rite: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="F&AM">F.∴ & A.∴M.∴</option>
              <option value="AF&AM">A.F. & A.M.</option>
              <option value="Scottish Rite">Scottish Rite</option>
              <option value="York Rite">York Rite</option>
              <option value="Prince Hall">Prince Hall</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Jurisdiction / Grand Lodge</label>
            <input value={form.jurisdiction} onChange={e => setForm(p => ({ ...p, jurisdiction: e.target.value }))} placeholder="North Carolina" style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Street Address</label>
          <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="1110 Massey St" style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>City</label>
            <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Smithfield" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} placeholder="NC" maxLength={2} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>ZIP</label>
            <input value={form.zip} onChange={e => setForm(p => ({ ...p, zip: e.target.value }))} placeholder="27577" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Lodge Email</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="psalmslodge1827@gmail.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Lodge Phone</label>
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(919) 000-0000" style={inputStyle} />
          </div>
        </div>

        {error && <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#E74C3C', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '4px' }}>{error}</div>}

        <button type="submit" disabled={loading} className="btn-gold" style={{ marginTop: '0.5rem', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Saving...' : 'Continue to Branding →'}
        </button>
      </form>
    </div>
  )
}
