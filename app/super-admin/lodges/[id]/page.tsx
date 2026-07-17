'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const TIER_OPTIONS = [
  { value: 'member', label: 'Member — basic portal access' },
  { value: 'deacon', label: 'Deacon — attendance & degree tracking' },
  { value: 'warden', label: 'Warden — meetings & roster' },
  { value: 'treasurer', label: 'Treasurer — full financial access' },
  { value: 'worshipful_master', label: 'Worshipful Master — meetings, events & communications' },
  { value: 'secretary', label: 'Secretary — full lodge management' },
  { value: 'admin', label: 'Admin — full access' },
]

export default function SuperAdminLodgeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string
  const supabase = createClient()

  const [tenant, setTenant] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [roleSaving, setRoleSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const result = await supabase
  .from('tenants')
  .select('*')
  .eq('id', tenantId)
  .single()

console.log('TENANT DETAIL RESULT', result)

const t = result.data
      if (!t) { setLoading(false); return }
      setTenant(t)
      setForm(t)

      const { data: m } = await supabase
        .from('tenant_members')
        .select('*, profiles(first_name, last_name, email)')
        .eq('tenant_id', tenantId)
        .order('created_at')
      setMembers(m ?? [])
      setLoading(false)
    }
    load()
  }, [tenantId])

  const saveTenant = async () => {
    setSaving(true)
    setSaveMsg('')
    // Only send fields the route's allowlist actually accepts — see
    // EDITABLE_FIELDS in app/api/super-admin/update-tenant/route.ts.
    // Sending id/slug/member_count etc. would just get silently
    // rejected by that route, but keeping this list in sync here makes
    // the intent visible in this file too, not only the API route.
    const {
      name, number, address, city, state, zip, email, phone, website,
      primary_color, secondary_color, logo_url, dues_amount, dues_due_month,
      timezone, is_active, rite, jurisdiction, about_text, history_text,
      meeting_schedule, plan, subscription_status,
    } = form

    const res = await fetch('/api/super-admin/update-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        updates: {
          name, number, address, city, state, zip, email, phone, website,
          primary_color, secondary_color, logo_url, dues_amount, dues_due_month,
          timezone, is_active, rite, jurisdiction, about_text, history_text,
          meeting_schedule, plan, subscription_status,
        },
      }),
    })
    const result = await res.json()
    setSaveMsg(res.ok ? '✓ Saved — changes are live on the public lodge page.' : `Failed: ${result.error}`)
    setSaving(false)
  }

  const updateMemberRole = async (membershipId: string, tenantRole: string) => {
    setRoleSaving(membershipId)
    const res = await fetch('/api/super-admin/update-member-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipId, tenantRole }),
    })
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, tenant_role: tenantRole } : m))
    }
    setRoleSaving(null)
  }

  const inputStyle = { width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', outline: 'none', borderRadius: '4px' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '5px', display: 'block' }
  const sectionStyle = { background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', padding: '2rem', marginBottom: '1.5rem' }

  if (loading) return <div style={{ padding: '2rem', color: '#B8B0A0', fontStyle: 'italic' }}>Loading...</div>
  if (!tenant) return <div style={{ padding: '2rem', color: '#E74C3C' }}>Lodge not found.</div>

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/super-admin/lodges" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.1em' }}>← ALL LODGES</Link>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginTop: '0.5rem', marginBottom: '0.25rem' }}>{tenant.name} #{tenant.number}</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Editing as super admin — changes apply directly, bypassing this lodge's own permissions</p>
      </div>

      {/* Identity & Contact */}
      <div style={sectionStyle}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#C9A84C', marginBottom: '1.25rem' }}>Identity &amp; Contact</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div><label style={labelStyle}>Lodge Name</label><input value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Number</label><input value={form.number || ''} onChange={e => setForm((p: any) => ({ ...p, number: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Email</label><input type="email" value={form.email || ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Phone</label><input value={form.phone || ''} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} style={inputStyle} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Address</label><input value={form.address || ''} onChange={e => setForm((p: any) => ({ ...p, address: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>City</label><input value={form.city || ''} onChange={e => setForm((p: any) => ({ ...p, city: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>State</label><input value={form.state || ''} onChange={e => setForm((p: any) => ({ ...p, state: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Rite</label><input value={form.rite || ''} onChange={e => setForm((p: any) => ({ ...p, rite: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Jurisdiction</label><input value={form.jurisdiction || ''} onChange={e => setForm((p: any) => ({ ...p, jurisdiction: e.target.value }))} style={inputStyle} /></div>
        </div>
      </div>

      {/* Public Site Content */}
      <div style={sectionStyle}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#C9A84C', marginBottom: '1.25rem' }}>Public Site Content</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label style={labelStyle}>About Text</label><textarea value={form.about_text || ''} onChange={e => setForm((p: any) => ({ ...p, about_text: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>History Text</label><textarea value={form.history_text || ''} onChange={e => setForm((p: any) => ({ ...p, history_text: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Meeting Schedule</label><input value={form.meeting_schedule || ''} onChange={e => setForm((p: any) => ({ ...p, meeting_schedule: e.target.value }))} placeholder="e.g. 2nd Tuesday, 7:00 PM" style={inputStyle} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <div><label style={labelStyle}>Primary Color</label><input type="color" value={form.primary_color || '#C9A84C'} onChange={e => setForm((p: any) => ({ ...p, primary_color: e.target.value }))} style={{ ...inputStyle, height: '42px', padding: '4px', cursor: 'pointer' }} /></div>
            <div><label style={labelStyle}>Secondary Color</label><input type="color" value={form.secondary_color || '#0A0E1A'} onChange={e => setForm((p: any) => ({ ...p, secondary_color: e.target.value }))} style={{ ...inputStyle, height: '42px', padding: '4px', cursor: 'pointer' }} /></div>
          </div>
        </div>
      </div>

      {/* Dues & Billing */}
      <div style={sectionStyle}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#C9A84C', marginBottom: '1.25rem' }}>Dues &amp; Billing (Super Admin Override)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div><label style={labelStyle}>Annual Dues ($)</label><input type="number" value={form.dues_amount || ''} onChange={e => setForm((p: any) => ({ ...p, dues_amount: parseFloat(e.target.value) }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Due Month</label>
            <select value={form.dues_due_month || 1} onChange={e => setForm((p: any) => ({ ...p, dues_due_month: parseInt(e.target.value) }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' })}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Plan</label>
            <select value={form.plan || 'trial'} onChange={e => setForm((p: any) => ({ ...p, plan: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="district">District</option>
            </select>
          </div>
          <div><label style={labelStyle}>Subscription Status</label>
            <select value={form.subscription_status || 'trialing'} onChange={e => setForm((p: any) => ({ ...p, subscription_status: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
        </div>
        <p style={{ fontSize: '0.72rem', color: '#B8B0A0', fontStyle: 'italic', marginTop: '10px' }}>
          Plan/status here bypass Stripe — use this to comp a lodge or resolve a stuck billing state manually, not as the normal checkout path.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <button onClick={saveTenant} disabled={saving} className="btn-gold" style={{ fontSize: '0.7rem', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
        {saveMsg && <span style={{ color: saveMsg.startsWith('Failed') ? '#E74C3C' : '#5DBE85', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{saveMsg}</span>}
      </div>

      {/* Roster & Roles */}
      <div className="data-box">
        <div className="data-box-head">Roster — Officer Role Assignment ({members.length})</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Brother', 'Lodge Role (title)', 'Portal Access (permission tier)', 'Active'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td className="dash-td">
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>{m.profiles?.first_name} {m.profiles?.last_name}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{m.profiles?.email}</div>
                </td>
                <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>{m.lodge_role || '—'}</td>
                <td className="dash-td">
                  <select
                    value={m.tenant_role}
                    disabled={roleSaving === m.id}
                    onChange={e => updateMemberRole(m.id, e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer', fontSize: '0.8rem', padding: '6px 10px', opacity: roleSaving === m.id ? 0.6 : 1 }}
                  >
                    {TIER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </td>
                <td className="dash-td"><span className={`pill ${m.is_active ? 'pill-active' : 'pill-canceled'}`}>{m.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No members yet.</div>}
      </div>
    </div>
  )
}
