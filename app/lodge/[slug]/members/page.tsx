'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

export default function LodgeMembersPage() {
  const params = useParams()
  const slug = params.slug as string
  const [members, setMembers] = useState<any[]>([])
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', degree: 'MM', lodgeRole: '', tenantRole: 'member' })
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const supabase = await createClient()

  useEffect(() => {
    const load = async () => {
      const { data: t } = await supabase.from('tenants').select('id, name, number').eq('slug', slug).single()
      if (!t) return
      setTenant(t)
      const { data: m } = await supabase
        .from('tenant_members')
        .select('*, profiles(first_name, last_name, email, phone)')
        .eq('tenant_id', t.id)
        .order('created_at')
      setMembers(m ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/members/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, ...inviteForm }),
    })
    const data = await res.json()
    if (res.ok) {
      setInviteMsg('✓ Invitation sent successfully.')
      setInviteForm({ firstName: '', lastName: '', email: '', degree: 'MM', lodgeRole: '', tenantRole: 'member' })
      // Refresh
      const { data: m } = await supabase.from('tenant_members').select('*, profiles(first_name, last_name, email, phone)').eq('tenant_id', tenant.id).order('created_at')
      setMembers(m ?? [])
    } else {
      setInviteMsg(`Error: ${data.error}`)
    }
    setInviting(false)
  }

  const updateMember = async (memberId: string, field: string, value: string) => {
    await supabase.from('tenant_members').update({ [field]: value }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, [field]: value } : m))
  }

  const sendReminder = async () => {
    const res = await fetch('/api/dues/remind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id }),
    })
    const data = await res.json()
    alert(`Dues reminders sent to ${data.sent} brothers. ${data.failed > 0 ? `${data.failed} failed.` : ''}`)
  }

  const inputStyle = { background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', outline: 'none', borderRadius: '4px', width: '100%' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  const dueCount = members.filter(m => m.dues_status === 'due' && m.is_active).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Members</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>{members.filter(m => m.is_active).length} active brothers</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {dueCount > 0 && (
            <button onClick={sendReminder} className="btn-outline" style={{ fontSize: '0.68rem' }}>
              Send Dues Reminders ({dueCount})
            </button>
          )}
          <button onClick={() => setShowInvite(!showInvite)} className="btn-gold" style={{ fontSize: '0.68rem' }}>
            {showInvite ? 'Cancel' : '+ Invite Brother'}
          </button>
        </div>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.15)', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#C9A84C', marginBottom: '1.5rem' }}>Invite a Brother</div>
          {inviteMsg && (
            <div style={{ background: inviteMsg.startsWith('✓') ? 'rgba(39,174,96,0.15)' : 'rgba(192,57,43,0.15)', border: `1px solid ${inviteMsg.startsWith('✓') ? 'rgba(39,174,96,0.3)' : 'rgba(192,57,43,0.3)'}`, color: inviteMsg.startsWith('✓') ? '#5DBE85' : '#E74C3C', padding: '10px 14px', borderRadius: '4px', marginBottom: '1rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>
              {inviteMsg}
            </div>
          )}
          <form onSubmit={handleInvite} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div><label style={labelStyle}>First Name *</label><input value={inviteForm.firstName} onChange={e => setInviteForm(p => ({ ...p, firstName: e.target.value }))} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Last Name *</label><input value={inviteForm.lastName} onChange={e => setInviteForm(p => ({ ...p, lastName: e.target.value }))} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Email *</label><input type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Degree</label>
              <select value={inviteForm.degree} onChange={e => setInviteForm(p => ({ ...p, degree: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="EA">Entered Apprentice</option>
                <option value="FC">Fellowcraft</option>
                <option value="MM">Master Mason</option>
              </select>
            </div>
            <div><label style={labelStyle}>Lodge Role</label><input value={inviteForm.lodgeRole} onChange={e => setInviteForm(p => ({ ...p, lodgeRole: e.target.value }))} placeholder="e.g. Senior Warden" style={inputStyle} /></div>
            <div><label style={labelStyle}>Portal Access</label>
              <select value={inviteForm.tenantRole} onChange={e => setInviteForm(p => ({ ...p, tenantRole: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="member">Member — basic portal access</option>
                <option value="deacon">Deacon — attendance &amp; degree tracking</option>
                <option value="warden">Warden — meetings &amp; roster (Senior or Junior)</option>
                <option value="treasurer">Treasurer — full financial access</option>
                <option value="worshipful_master">Worshipful Master — meetings, events &amp; communications</option>
                <option value="secretary">Secretary — full lodge management</option>
                <option value="admin">Admin — full access</option>
              </select>
              <p style={{ fontSize: '0.7rem', color: '#B8B0A0', fontStyle: 'italic', marginTop: '4px' }}>
                This sets system permissions. Use "Lodge Role" above for the exact office title shown on rosters (e.g. distinguishing Senior Warden from Junior Warden).
              </p>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={inviting} className="btn-gold" style={{ fontSize: '0.68rem', opacity: inviting ? 0.7 : 1 }}>
                {inviting ? 'Sending invitation...' : 'Send Invitation Email'}
              </button>
              <p style={{ fontSize: '0.82rem', color: '#B8B0A0', fontStyle: 'italic', marginTop: '8px' }}>Brother will receive a welcome email with instructions to set up their portal access.</p>
            </div>
          </form>
        </div>
      )}

      {/* Members table */}
      <div className="data-box">
        {loading ? <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0' }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Name', 'Contact', 'Degree', 'Role', 'Dues', 'Portal', 'Status'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const p = m.profiles
                return (
                  <tr key={m.id}>
                    <td className="dash-td">
                      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>
                        Bro. {p?.first_name ?? '—'} {p?.last_name ?? ''}
                      </div>
                    </td>
                    <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#B8B0A0' }}>
                      <div>{p?.email ?? '—'}</div>
                      <div>{p?.phone ?? ''}</div>
                    </td>
                    <td className="dash-td">
                      <select value={m.degree} onChange={e => updateMember(m.id, 'degree', e.target.value)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#C9A84C', outline: 'none' }}>
                        <option value="EA">EA</option>
                        <option value="FC">FC</option>
                        <option value="MM">MM</option>
                      </select>
                    </td>
                    <td className="dash-td" style={{ fontSize: '0.85rem', color: '#B8B0A0' }}>{m.lodge_role || '—'}</td>
                    <td className="dash-td">
                      <select value={m.dues_status} onChange={e => updateMember(m.id, 'dues_status', e.target.value)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: m.dues_status === 'paid' ? '#5DBE85' : m.dues_status === 'due' ? '#C9A84C' : '#B8B0A0', outline: 'none' }}>
                        <option value="paid">Paid</option>
                        <option value="due">Due</option>
                        <option value="exempt">Exempt</option>
                      </select>
                    </td>
                    <td className="dash-td"><span className={`pill ${
                  m.tenant_role === 'admin' || m.tenant_role === 'secretary' ? 'pill-mm'
                  : m.tenant_role === 'worshipful_master' ? 'pill-active'
                  : m.tenant_role === 'treasurer' ? 'pill-fc'
                  : m.tenant_role === 'warden' || m.tenant_role === 'deacon' ? 'pill-ea'
                  : 'pill-new'
                }`}>{m.tenant_role === 'worshipful_master' ? 'Worshipful Master' : m.tenant_role}</span></td>
                    <td className="dash-td"><span className={`pill pill-${m.is_active ? 'active' : 'canceled'}`}>{m.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && members.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No members yet. Invite your first brother above.</div>}
      </div>
    </div>
  )
}
