import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

/**
 * Every notice the lodge has sent, readable in the portal.
 *
 * This was the largest gap left in the brother's side of the app. A
 * notice went out by email and then existed nowhere he could reach: a
 * man who deleted the message, or never received it because his
 * address had bounced, had no way to find the date of the next
 * communication short of asking someone.
 *
 * Drafts and scheduled-but-unsent notices are excluded — a brother
 * should not read a notice the Secretary is still writing, or one
 * timed to go out next week.
 *
 * No RLS change: "Comms visible to lodge members" has always allowed
 * this read.
 */
export default async function PortalNoticesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id).eq('is_active', true).single()

  if (!membership) redirect('/auth/login')

  const { data: notices } = await supabase
    .from('communications')
    .select('id, subject, body, sent_at, created_at, is_draft, sent_by, profiles:sent_by(first_name, last_name)')
    .eq('tenant_id', (membership as any).tenant_id)
    .eq('is_draft', false)
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>FROM THE LODGE</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Notices</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
          Everything the lodge has sent, whether or not it reached your inbox.
        </p>
      </div>

      {notices && notices.length > 0 ? (
        notices.map((n: any) => {
          const sender = n.profiles
            ? `${n.profiles.first_name ?? ''} ${n.profiles.last_name ?? ''}`.trim()
            : ''
          return (
            <div className="data-box" key={n.id} style={{ marginBottom: '1rem' }}>
              <div className="data-box-head">
                <span>{n.subject}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
                  {format(new Date(n.sent_at ?? n.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <div style={{ padding: '1.2rem 1.4rem' }}>
                {/* The body is plain text a Secretary typed. Rendering it
                    as paragraphs preserves his line breaks without
                    letting anything pasted in become markup. */}
                {String(n.body ?? '').split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                  <p key={i} style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1rem', lineHeight: 1.7, color: '#B8B0A0', margin: '0 0 0.8rem' }}>
                    {line.trim()}
                  </p>
                ))}
                {sender && (
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'rgba(184,176,160,0.55)', margin: '0.6rem 0 0' }}>
                    SENT BY {sender.toUpperCase()}
                  </p>
                )}
              </div>
            </div>
          )
        })
      ) : (
        <div className="data-box">
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>
            The lodge has not sent any notices yet.
          </div>
        </div>
      )}
    </div>
  )
}
