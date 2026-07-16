import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { AvatarUpload } from '@/components/lodge/AvatarUpload'
import { MemberQrCode } from '@/components/lodge/MemberQrCode'

export default async function PortalProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('tenant_members')
      .select('*, tenants(name, number)')
      .eq('user_id', user.id).eq('is_active', true).single(),
  ])

  if (!membership) redirect('/onboarding/setup')
  const tenant = (membership as any).tenants
  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase() || '?'

  const { data: degreeProgress } = await supabase
    .from('degree_progress')
    .select('*')
    .eq('member_id', user.id)
    .eq('tenant_id', membership.tenant_id)
    .order('degree')

  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '0.4rem' }
  const rowStyle = { padding: '0.85rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', justifyContent: 'space-between' }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>MY PROFILE</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Bro. {profile?.first_name} {profile?.last_name}</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>{tenant?.name} #{tenant?.number} · {(membership as any).lodge_role || (membership as any).degree}</p>
      </div>

      <div className="data-box" style={{ marginBottom: '1.5rem' }}>
        <div className="data-box-head">Photo</div>
        <div style={{ padding: '1.4rem' }}>
          <AvatarUpload currentUrl={profile?.avatar_url ?? null} initials={initials} />
        </div>
      </div>

      <div className="data-box" style={{ marginBottom: '1.5rem' }}>
        <div className="data-box-head">My Attendance QR Code</div>
        <div style={{ padding: '1.4rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <MemberQrCode qrToken={profile?.qr_token ?? null} />
          <p style={{ color: '#B8B0A0', fontSize: '0.82rem', lineHeight: 1.6, margin: 0, maxWidth: '360px' }}>
            Show this code to the officer at the door to be checked in, or scan the meeting's
            code yourself under Meeting Mode. This code identifies you — it only marks you present
            for whichever meeting is currently open, never for a past or future one.
          </p>
        </div>
      </div>

      <div className="data-box" style={{ marginBottom: '1.5rem' }}>
        <div className="data-box-head">Contact Information</div>
        <div style={{ padding: '1.4rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <div><div style={labelStyle}>Email</div><div style={{ color: '#F5F0E8', fontSize: '0.9rem' }}>{profile?.email || '—'}</div></div>
          <div><div style={labelStyle}>Phone</div><div style={{ color: '#F5F0E8', fontSize: '0.9rem' }}>{profile?.phone || '—'}</div></div>
          <div><div style={labelStyle}>Address</div><div style={{ color: '#F5F0E8', fontSize: '0.9rem' }}>{profile?.address || '—'}</div></div>
          <div><div style={labelStyle}>City / State / Zip</div><div style={{ color: '#F5F0E8', fontSize: '0.9rem' }}>{[profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ') || '—'}</div></div>
        </div>
        <div style={{ padding: '0 1.4rem 1.2rem', color: '#B8B0A0', fontSize: '0.72rem', fontStyle: 'italic' }}>
          To update contact information, please reach out to your lodge Secretary.
        </div>
      </div>

      <div className="data-box">
        <div className="data-box-head">Masonic Record</div>
        <div style={rowStyle}><span style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>Current Degree</span><span className={`pill pill-${(membership as any).degree?.toLowerCase()}`}>{(membership as any).degree}</span></div>
        <div style={rowStyle}><span style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>Lodge Role</span><span style={{ color: '#F5F0E8', fontSize: '0.85rem' }}>{(membership as any).lodge_role || '—'}</span></div>
        <div style={rowStyle}><span style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>Member Since</span><span style={{ color: '#F5F0E8', fontSize: '0.85rem' }}>{(membership as any).joined_date ? format(new Date((membership as any).joined_date), 'MMMM yyyy') : '—'}</span></div>
        {degreeProgress?.map((d: any) => (
          <div key={d.degree} style={{ ...rowStyle, borderBottom: 'none' }}>
            <span style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>{d.degree} Conferred</span>
            <span style={{ color: '#F5F0E8', fontSize: '0.85rem' }}>{d.conferred_date ? format(new Date(d.conferred_date), 'MMM d, yyyy') : 'Not yet'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
