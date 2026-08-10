import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MyAssignments } from '@/components/portal/MyAssignments'

/**
 * What the lodge has asked of one brother.
 *
 * RLS restricts assignments to his own rows ("Own assignments
 * visible"), so this page cannot show him anyone else's whatever it
 * asks for — a list of who is behind on what is the officers' business,
 * not a leaderboard.
 *
 * His curriculum sign-offs are fetched alongside because a degree
 * assignment's completion lives there rather than on the assignment
 * row; see lib/assignments.ts for why there is only one place for it.
 */
export default async function PortalAssignmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) redirect('/auth/login')
  const tenantId = (membership as any).tenant_id

  const [{ data: assignments }, { data: progress }, { data: docs }] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, title, description, due_date, step_id, document_id, completed_at, cancelled_at, submitted_at, declined_at, declined_by_name, decline_note, assigned_by_name, created_at')
      .eq('tenant_id', tenantId)
      .eq('assigned_to', user.id)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('curriculum_progress')
      .select('step_id')
      .eq('tenant_id', tenantId)
      .eq('member_id', user.id),
    supabase
      .from('documents')
      .select('id, name')
      .eq('tenant_id', tenantId),
  ])

  const documents: Record<string, string> = {}
  for (const d of docs ?? []) documents[(d as any).id] = (d as any).name

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          YOUR WORK
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Assignments
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          What the lodge has asked of you, and what you have already done. Tasks you tick off
          yourself; degree work goes to an officer, who signs it off once he has heard it.
        </p>
      </div>

      <MyAssignments
        tenantId={tenantId}
        assignments={(assignments ?? []) as any}
        signedOffStepIds={(progress ?? []).map((p: any) => p.step_id)}
        documents={documents}
      />
    </div>
  )
}
