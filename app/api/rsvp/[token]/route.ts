import { createServiceClient } from '@/lib/supabase/server'

/**
 * Public RSVP endpoint hit directly by Yes/Maybe/No links in an invite
 * email. Deliberately requires no login — security comes from the
 * token itself: a random UUID, unguessable, scoped to one event+member
 * pair, not from a session.
 */
export async function GET(request: Request, { params }: { params: { token: string } }) {
  const url = new URL(request.url)
  const response = url.searchParams.get('r')

  const page = (title: string, message: string, tone: 'ok' | 'error' = 'ok') => new Response(
    `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
    <body style="margin:0;background:#0A0E1A;color:#F5F0E8;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;box-sizing:border-box;">
      <div style="max-width:420px;text-align:center;">
        <div style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#C9A84C;letter-spacing:0.2em;margin-bottom:24px;">LODGEOS</div>
        <h1 style="font-size:20px;color:${tone === 'ok' ? '#5DBE85' : '#E74C3C'};margin-bottom:12px;">${title}</h1>
        <p style="color:#B8B0A0;font-size:14px;line-height:1.6;">${message}</p>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )

  if (!response || !['yes', 'no', 'maybe'].includes(response)) {
    return page('Invalid Link', 'This RSVP link is missing a response value. Please use one of the buttons in your invite email.', 'error')
  }

  const supabase = createServiceClient()

  const { data: rsvp } = await supabase
    .from('event_rsvps')
    .select('event_id, user_id, lodge_events(title, event_date), profiles(first_name)')
    .eq('rsvp_token', params.token)
    .single()

  if (!rsvp) {
    return page('Link Not Found', 'This RSVP link is no longer valid. It may have already been used for an event that was removed, or the link was mistyped.', 'error')
  }

  await supabase
    .from('event_rsvps')
    .update({ response, responded_at: new Date().toISOString() })
    .eq('rsvp_token', params.token)

  const event = (rsvp as any).lodge_events
  const label = response === 'yes' ? "You're marked as attending" : response === 'no' ? "You're marked as not attending" : "You're marked as a maybe"

  return page(label, `${event?.title ?? 'The event'} — thank you for letting the lodge know. You can close this page.`)
}
