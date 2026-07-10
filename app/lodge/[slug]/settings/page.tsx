'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

export default function LodgeSettingsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [tenant, setTenant] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<any>({})
  const supabase = await createClient()

  useEffect(() => {
    supabase.from('tenants').select('*').eq('slug', slug).single().then(({ data }) => {
      if (data) { setTenant(data); setForm(data) }
    })
  }, [])

  const save = async (section: string) => {
    setSaving(true)
    await supabase.from('tenants').update(form).eq('id', tenant.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setSaving(false)
  }

  const inputStyle = { width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '11px 15px', fontFamily: 'Crimson Pro, serif', fontSize: '1rem', outline: 'none', borderRadius: '4px', transition: 'border-color 0.2s' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }
  const sectionStyle = { background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', padding: '2rem', marginBottom: '1.5rem' }
  const sectionTitle = { fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#F5F0E8', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(201,168,76,0.1)' }

  if (!tenant) return <div style={{ padding: '2rem', color: '#B8B0A0', fontStyle: 'italic' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Lodge Settings</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Manage your lodge configuration — no code required</p>
        </div>
        {saved && <div style={{ background: 'rgba(39,174,96,0.15)', border: '1px solid rgba(39,174,96,0.3)', color: '#5DBE85', padding: '8px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.1em' }}>✓ SAVED</div>}
      </div>

      {/* Lodge Identity */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Lodge Identity</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div><label style={labelStyle}>Lodge Name</label><input value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Lodge Number</label><input value={form.number || ''} onChange={e => setForm((p: any) => ({ ...p, number: e.target.value }))} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div><label style={labelStyle}>Rite</label>
            <select value={form.rite || ''} onChange={e => setForm((p: any) => ({ ...p, rite: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="F&AM">F.∴ & A.∴M.∴</option>
              <option value="AF&AM">A.F. & A.M.</option>
              <option value="Scottish Rite">Scottish Rite</option>
              <option value="York Rite">York Rite</option>
              <option value="Prince Hall">Prince Hall</option>
            </select>
          </div>
          <div><label style={labelStyle}>Jurisdiction</label><input value={form.jurisdiction || ''} onChange={e => setForm((p: any) => ({ ...p, jurisdiction: e.target.value }))} placeholder="North Carolina" style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div><label style={labelStyle}>Email</label><input type="email" value={form.email || ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Phone</label><input value={form.phone || ''} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} style={inputStyle} /></div>
        </div>
        <button onClick={() => save('identity')} disabled={saving} className="btn-gold" style={{ fontSize: '0.68rem' }}>{saving ? 'Saving...' : 'Save Identity'}</button>
      </div>

      {/* Location */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Meeting Location</div>
        <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Street Address</label><input value={form.address || ''} onChange={e => setForm((p: any) => ({ ...p, address: e.target.value }))} style={inputStyle} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div><label style={labelStyle}>City</label><input value={form.city || ''} onChange={e => setForm((p: any) => ({ ...p, city: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>State</label><input value={form.state || ''} onChange={e => setForm((p: any) => ({ ...p, state: e.target.value }))} maxLength={2} style={inputStyle} /></div>
          <div><label style={labelStyle}>ZIP</label><input value={form.zip || ''} onChange={e => setForm((p: any) => ({ ...p, zip: e.target.value }))} style={inputStyle} /></div>
        </div>
        <button onClick={() => save('location')} disabled={saving} className="btn-gold" style={{ fontSize: '0.68rem' }}>Save Location</button>
      </div>

      {/* Branding */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Branding & Colors</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>Primary Color (accent)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="color" value={form.primary_color || '#C9A84C'} onChange={e => setForm((p: any) => ({ ...p, primary_color: e.target.value }))} style={{ width: '44px', height: '44px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
              <input value={form.primary_color || ''} onChange={e => setForm((p: any) => ({ ...p, primary_color: e.target.value }))} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Secondary Color (background)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="color" value={form.secondary_color || '#0A0E1A'} onChange={e => setForm((p: any) => ({ ...p, secondary_color: e.target.value }))} style={{ width: '44px', height: '44px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
              <input value={form.secondary_color || ''} onChange={e => setForm((p: any) => ({ ...p, secondary_color: e.target.value }))} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }} />
            </div>
          </div>
        </div>
        {/* Preview */}
        <div style={{ background: form.secondary_color || '#0A0E1A', border: '1px solid rgba(201,168,76,0.15)', padding: '1.25rem', borderRadius: '4px', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', color: form.primary_color || '#C9A84C', fontSize: '0.9rem', letterSpacing: '0.15em' }}>{form.name || 'YOUR LODGE'} #{form.number || '0000'}</div>
          <div style={{ display: 'inline-block', marginTop: '10px', background: form.primary_color || '#C9A84C', color: form.secondary_color || '#0A0E1A', fontFamily: 'Cinzel, serif', fontSize: '0.65rem', fontWeight: 700, padding: '7px 18px' }}>Button Preview</div>
        </div>
        <button onClick={() => save('branding')} disabled={saving} className="btn-gold" style={{ fontSize: '0.68rem' }}>Save Branding</button>
      </div>

      {/* Dues */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Dues Configuration</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>Annual Dues Amount ($)</label>
            <input type="number" value={form.dues_amount || ''} onChange={e => setForm((p: any) => ({ ...p, dues_amount: parseFloat(e.target.value) }))} placeholder="60.00" min="0" step="0.01" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Dues Due Month</label>
            <select value={form.dues_due_month || 1} onChange={e => setForm((p: any) => ({ ...p, dues_due_month: parseInt(e.target.value) }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={() => save('dues')} disabled={saving} className="btn-gold" style={{ fontSize: '0.68rem' }}>Save Dues Settings</button>
      </div>

      {/* Website Content */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Public Website Content</div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>About Your Lodge</label>
          <textarea value={form.about_text || ''} onChange={e => setForm((p: any) => ({ ...p, about_text: e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Tell visitors about your lodge..." />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Lodge History</label>
          <textarea value={form.history_text || ''} onChange={e => setForm((p: any) => ({ ...p, history_text: e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Your lodge's history..." />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>Meeting Schedule</label>
          <input value={form.meeting_schedule || ''} onChange={e => setForm((p: any) => ({ ...p, meeting_schedule: e.target.value }))} placeholder="e.g. 2nd Tuesday of each month at 7:00 PM" style={inputStyle} />
        </div>
        <button onClick={() => save('content')} disabled={saving} className="btn-gold" style={{ fontSize: '0.68rem' }}>Save Content</button>
      </div>

      {/* Subscription */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Subscription & Billing</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#0A0E1A', padding: '1rem', borderRadius: '4px' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: '#B8B0A0', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>Plan</div>
            <span className={`pill pill-${tenant.plan === 'pro' ? 'fc' : tenant.plan === 'district' ? 'mm' : 'ea'}`}>{tenant.plan}</span>
          </div>
          <div style={{ background: '#0A0E1A', padding: '1rem', borderRadius: '4px' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: '#B8B0A0', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
            <span className={`pill pill-${tenant.subscription_status === 'active' ? 'active' : tenant.subscription_status === 'trialing' ? 'trial' : 'canceled'}`}>{tenant.subscription_status}</span>
          </div>
          <div style={{ background: '#0A0E1A', padding: '1rem', borderRadius: '4px' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: '#B8B0A0', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>Members</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#F5F0E8' }}>{tenant.member_count}</div>
          </div>
        </div>
        <a href="/api/billing/portal" className="btn-outline" style={{ fontSize: '0.68rem', display: 'inline-block' }}>Manage Billing →</a>
      </div>
    </div>
  )
}
