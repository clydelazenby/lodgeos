'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface MemberRow { firstName: string; lastName: string; email: string; degree: string; role: string }

export default function MembersOnboardingPage() {
  const router = useRouter()
  const [tenantId, setTenantId] = useState('')
  const [members, setMembers] = useState<MemberRow[]>([
    { firstName: '', lastName: '', email: '', degree: 'MM', role: 'Worshipful Master' },
    { firstName: '', lastName: '', email: '', degree: 'MM', role: 'Senior Warden' },
    { firstName: '', lastName: '', email: '', degree: 'MM', role: 'Junior Warden' },
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const id = sessionStorage.getItem('onboarding_tenant_id')
    if (!id) { router.push('/onboarding/setup'); return }
    setTenantId(id)
  }, [])

  const addRow = () => setMembers(p => [...p, { firstName: '', lastName: '', email: '', degree: 'MM', role: '' }])
  const updateRow = (i: number, field: keyof MemberRow, value: string) => setMembers(p => p.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  const removeRow = (i: number) => setMembers(p => p.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    setSaving(true)
    const supabase = await createClient()
    const filled = members.filter(m => m.email && m.firstName)

    // Insert as pending members (they'll get invited via email)
    for (const m of filled) {
      // Create a placeholder profile or invite via Supabase Auth
      // For now we store them as pending in tenant_members with no user_id
      // They'll be linked when they accept the invite
    }

    // In production this would call an API route that sends invite emails
    // For now advance to billing
    router.push('/onboarding/billing')
    setSaving(false)
  }

  const inputStyle = { background: '#141C2E', border: '1px solid rgba(201,168,76,0.15)', color: '#F5F0E8', padding: '8px 10px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', outline: 'none', borderRadius: '3px', width: '100%' }

  return (
    <div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.75rem' }}>STEP 3 OF 5</div>
      <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: '#F5F0E8', marginBottom: '0.5rem' }}>Add your brothers</h1>
      <p style={{ fontSize: '1rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2.5rem' }}>Add your lodge members here. They'll receive an email invitation to set up their portal access. You can always add more later.</p>

      <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', marginBottom: '1rem', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
          <thead>
            <tr>
              {['First Name', 'Last Name', 'Email', 'Degree', 'Role', ''].map(h => (
                <th key={h} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.15em', color: '#C9A84C', textTransform: 'uppercase', textAlign: 'left', padding: '0.75rem 0.75rem', borderBottom: '1px solid rgba(201,168,76,0.1)', background: 'rgba(201,168,76,0.03)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={i}>
                <td style={{ padding: '6px' }}><input value={m.firstName} onChange={e => updateRow(i, 'firstName', e.target.value)} placeholder="John" style={inputStyle} /></td>
                <td style={{ padding: '6px' }}><input value={m.lastName} onChange={e => updateRow(i, 'lastName', e.target.value)} placeholder="Smith" style={inputStyle} /></td>
                <td style={{ padding: '6px' }}><input type="email" value={m.email} onChange={e => updateRow(i, 'email', e.target.value)} placeholder="john@email.com" style={inputStyle} /></td>
                <td style={{ padding: '6px' }}>
                  <select value={m.degree} onChange={e => updateRow(i, 'degree', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="EA">EA</option>
                    <option value="FC">FC</option>
                    <option value="MM">MM</option>
                  </select>
                </td>
                <td style={{ padding: '6px' }}><input value={m.role} onChange={e => updateRow(i, 'role', e.target.value)} placeholder="Officer role" style={inputStyle} /></td>
                <td style={{ padding: '6px', textAlign: 'center' }}>
                  <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E74C3C', fontSize: '1rem' }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addRow} className="btn-outline" style={{ fontSize: '0.68rem', padding: '10px 20px', marginBottom: '2rem' }}>+ Add Another Brother</button>

      <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', padding: '1rem', borderRadius: '4px', marginBottom: '2rem' }}>
        <p style={{ fontSize: '0.9rem', color: '#B8B0A0', fontStyle: 'italic', margin: 0 }}>
          💡 Brothers will receive an email invitation to set up their portal access. They can log in to pay dues, view events, and update their profile. You can skip this step and add brothers later.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={() => router.push('/onboarding/brand')} className="btn-outline" style={{ flex: 1 }}>← Back</button>
        <button onClick={() => router.push('/onboarding/billing')} className="btn-outline" style={{ flex: 1 }}>Skip for now</button>
        <button onClick={handleSave} disabled={saving} className="btn-gold" style={{ flex: 2, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save & Continue →'}
        </button>
      </div>
    </div>
  )
}
