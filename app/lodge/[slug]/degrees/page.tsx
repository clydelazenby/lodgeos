import { createClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/supabase/queries'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { ProficiencyControl } from '@/components/lodge/ProficiencyControl'
import { CandidateCurriculum } from '@/components/lodge/CandidateCurriculum'
import { CURRICULUM_DEGREES, type CurriculumDegree } from '@/lib/curriculum'
import { getSessionUser, getMembership, getProfile } from '@/lib/supabase/queries'

export default async function LodgeDegreesPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  // Deduped against the identical lookup in lodge/[slug]/layout.tsx —
  // same render pass, so this costs no round trip.
  const tenant = await getTenantBySlug(params.slug)
  if (!tenant) notFound()

  const { data: members } = await supabase
    .from('tenant_members')
    .select('*, profiles(first_name, last_name)')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('degree')

  const { data: progress } = await supabase
    .from('degree_progress')
    .select('*, profiles(first_name, last_name)')
    .eq('tenant_id', tenant.id)

  // The curriculum, and who has done what of it. Both scoped by RLS to
  // this lodge; sign-off itself is re-checked by /api/curriculum, which
  // is the authority.
  const [{ data: curriculumSteps }, { data: curriculumDone }, viewer] = await Promise.all([
    supabase
      .from('curriculum_steps')
      .select('id, degree, title, description, sort_order, document_id, required')
      .eq('tenant_id', tenant.id)
      .order('sort_order'),
    supabase
      .from('curriculum_progress')
      .select('member_id, step_id')
      .eq('tenant_id', tenant.id),
    getSessionUser(),
  ])

  const [viewerMembership, viewerProfile] = await Promise.all([
    viewer ? getMembership(tenant.id, viewer.id) : Promise.resolve(null),
    viewer ? getProfile(viewer.id) : Promise.resolve(null),
  ])

  // Hearing a catechism is officer work — the same breadth that records
  // attendance, which since migration 022 includes wardens and deacons.
  // A Junior Deacon is very often the man actually doing it.
  const canSignOff = !!viewerMembership || viewerProfile?.platform_role === 'super_admin'

  const doneByMember = new Map<string, string[]>()
  for (const row of curriculumDone ?? []) {
    const id = (row as any).member_id
    if (!doneByMember.has(id)) doneByMember.set(id, [])
    doneByMember.get(id)!.push((row as any).step_id)
  }

  const ea = members?.filter((m: any) => m.degree === 'EA') ?? []
  const fc = members?.filter((m: any) => m.degree === 'FC') ?? []
  const mm = members?.filter((m: any) => m.degree === 'MM') ?? []

  // `progress` was fetched and never read anywhere in this file before.
  // Indexed by member+degree so each row looks up its own record in O(1).
  const progressByMember: Record<string, any> = {}
  for (const p of progress ?? []) progressByMember[`${p.member_id}:${p.degree}`] = p

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Degree Tracker</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Track every brother's progression through the craft</p>
      </div>

      {/* Degree counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', marginBottom: '2rem' }}>
        {[['I°', 'Entered Apprentice', ea.length, '#7BB8D4'], ['II°', 'Fellowcraft', fc.length, '#C9A84C'], ['III°', 'Master Mason', mm.length, '#5DBE85']].map(([deg, name, count, color]) => (
          <div key={deg as string} style={{ background: '#141C2E', padding: '1.5rem', boxShadow: '0 0 0 1px rgba(201,168,76,0.1)', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', fontWeight: 900, color: color as string, lineHeight: 1, marginBottom: '0.4rem' }}>{deg}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8', marginBottom: '0.5rem' }}>{name}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', fontWeight: 700, color: '#F5F0E8' }}>{count as number}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>brothers</div>
          </div>
        ))}
      </div>

      {/* Full member degree table */}
      <div className="data-box">
        <div className="data-box-head">All Members — Degree Status</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Brother', 'Current Degree', 'Lodge Role', 'Joined', 'Proficiency', 'Curriculum'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr></thead>
          <tbody>
            {members?.map((m: any) => (
              <tr key={m.id}>
                <td className="dash-td">
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>Bro. {m.profiles?.first_name} {m.profiles?.last_name}</div>
                </td>
                <td className="dash-td"><span className={`pill pill-${m.degree?.toLowerCase()}`}>{m.degree}</span></td>
                <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>{m.lodge_role || '—'}</td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#B8B0A0' }}>
                  {m.joined_date ? format(new Date(m.joined_date), 'MMM yyyy') : '—'}
                </td>
                <td className="dash-td">
                  <ProficiencyControl
                    tenantId={tenant.id}
                    memberId={m.user_id}
                    degree={m.degree}
                    progress={progressByMember[`${m.user_id}:${m.degree}`] ?? null}
                  />
                </td>
                {/* Replaces the Notes column, which repeated what the
                    brother's own profile already shows. This is the
                    thing the page could never answer: where in the
                    degree's work he actually is. */}
                <td className="dash-td" style={{ minWidth: 240 }}>
                  {CURRICULUM_DEGREES.includes(m.degree) ? (
                    <CandidateCurriculum
                      tenantId={tenant.id}
                      memberId={m.user_id}
                      memberName={`${m.profiles?.first_name ?? ''} ${m.profiles?.last_name ?? ''}`.trim()}
                      degree={m.degree as CurriculumDegree}
                      steps={(curriculumSteps ?? []) as any}
                      completedStepIds={doneByMember.get(m.user_id) ?? []}
                      canSignOff={canSignOff}
                    />
                  ) : (
                    <span style={{ color: '#918879', fontStyle: 'italic', fontSize: '0.85rem' }}>
                      No degree recorded
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!members || members.length === 0) && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No members yet.</div>
        )}
      </div>
    </div>
  )
}
