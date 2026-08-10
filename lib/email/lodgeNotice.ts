import { Resend, type CreateBatchOptions } from 'resend'
import { escapeHtml } from '@/lib/email/shared'
import { renderLodgeEmail, renderLodgeEmailText, lodgeTitle, type LodgeBrand, type EmailBody } from '@/lib/email/layout'

/**
 * Lodge-wide notices: rendering and bulk delivery.
 *
 * WHY THIS REPLACED THE PER-RECIPIENT LOOP
 *
 * /api/communications/send previously did this:
 *
 *   for (const r of recipients) {
 *     await sendLodgeNoticeEmail({ to: r.email, ... })
 *   }
 *
 * One HTTP request to Resend per brother, awaited in series. Three
 * separate problems, all of which get worse as a lodge grows:
 *
 * 1. TIME. At roughly 200ms per call, a 60-member lodge takes ~12
 *    seconds and a 150-member lodge takes ~30. Vercel's default
 *    serverless timeout is 10s on Hobby and 60s on Pro, so a large
 *    lodge's notice would be killed PART-WAY THROUGH — some brothers
 *    emailed, some not, and no record of where it stopped.
 *
 * 2. RATE LIMITS. Resend's default is 2 requests/second. A tight await
 *    loop exceeds that immediately and starts collecting 429s, which
 *    the old `catch { failed++ }` swallowed as generic failures.
 *
 * 3. NO DIAGNOSIS. Every failure became `failed++`. A secretary could
 *    not tell a typo'd address from a rate limit from an unverified
 *    sending domain.
 *
 * Resend's batch endpoint takes up to 100 fully-specified messages in
 * ONE request, so a 150-member lodge is 2 requests instead of 150 —
 * comfortably inside any timeout, and nowhere near the rate limit.
 *
 * WHAT BATCH GIVES UP, AND HOW THAT'S HANDLED
 *
 * The batch endpoint returns one id per accepted message but does NOT
 * report per-message failures — a single malformed address rejects the
 * WHOLE chunk with a 422. So addresses are validated and filtered
 * before batching (see collectRecipients), and chunks are kept
 * independent: if one chunk fails, the others still go, and only that
 * chunk's recipients are recorded as failed, with the provider's actual
 * error message rather than a bare count.
 *
 * Batch also does not support attachments — irrelevant for notices, but
 * the reason event invites (which carry an .ics) still send individually.
 */

const BATCH_LIMIT = 100

/** Deliberately permissive — the provider is the real authority. This
 *  only catches the obviously-broken entries that would 422 a whole
 *  chunk and take 99 good addresses down with them. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type NoticeRecipient = {
  email: string
  firstName: string
}

export type FailedRecipient = {
  email: string
  reason: string
}

export type NoticeEvent = {
  id: string
  title: string
  dateLabel: string
  location?: string | null
}

export function renderLodgeNotice({
  firstName, lodgeName, subject, body, sentByName, event, meetingUrl, appUrl, brand,
}: {
  firstName: string; lodgeName: string; subject: string; body: string; sentByName?: string
  /** When set, the notice carries the meeting details and a calendar link. */
  event?: NoticeEvent
  /** Zoom / Meet / Discord / Teams join link, rendered as a button. */
  meetingUrl?: string
  appUrl?: string
  /** The lodge's own crest, tagline and contact details. */
  brand?: LodgeBrand
}): { html: string; text: string } {
  const b: LodgeBrand = brand ?? { name: lodgeName, number: null }
  const base = appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://www.psalmslodge1827.com'

  const paragraphs = body.split('\n').map((l) => l.trim()).filter((l) => l.length)

  // The calendar link is deliberately a LINK and not an .ics
  // attachment — Resend's batch endpoint cannot carry attachments at
  // all, and links survive mail-security filters that routinely strip
  // calendar files. See app/api/events/[eventId]/calendar.ics.
  const calendarHtml = event
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
        <tr><td align="center">
          <a href="${base}/api/events/${event.id}/calendar.ics" style="display:inline-block;padding:11px 22px;border:1px solid #B8912F;color:#B8912F;text-decoration:none;font-family:Georgia,serif;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;border-radius:2px;">Add to Calendar</a>
        </td></tr>
      </table>`
    : ''

  const meetingHtml = meetingUrl
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
        <tr><td align="center">
          <a href="${escapeHtml(meetingUrl)}" style="display:inline-block;padding:13px 30px;background:#12213D;color:#FFFFFF;text-decoration:none;font-family:Georgia,serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;border-radius:2px;">Join the Meeting</a>
          <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:11px;color:#5A5A5A;word-break:break-all;">${escapeHtml(meetingUrl)}</p>
        </td></tr>
      </table>`
    : ''

  const emailBody: EmailBody = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs,
    details: event
      ? [
          { label: 'Event', value: event.title },
          { label: 'Date', value: event.dateLabel },
          ...(event.location ? [{ label: 'Location', value: event.location }] : []),
        ]
      : [],
    extraHtml: `${calendarHtml}${meetingHtml}`,
    signOff: {
      closing: 'Fraternally,',
      // Named sender when we have one — a notice signed by the brother
      // who actually sent it reads as correspondence rather than an
      // automated message.
      lines: sentByName
        ? [sentByName, lodgeTitle(b)]
        : ['Worshipful Master & Officers', lodgeTitle(b)],
    },
  }

  const html = renderLodgeEmail(b, emailBody, subject)

  // A plain-text alternative is not decoration. Mail filters treat
  // HTML-only messages as a mild spam signal, and a lodge blasting the
  // same HTML-only message to 50 addresses at once is exactly the
  // pattern filters look at hardest. It also renders correctly in
  // text-only clients and in notification previews.
  const text = [
    renderLodgeEmailText(b, emailBody),
    ...(event ? ['', `Add to calendar: ${base}/api/events/${event.id}/calendar.ics`] : []),
    ...(meetingUrl ? [`Join the meeting: ${meetingUrl}`] : []),
  ].join('\n')

  return { html, text }
}

/**
 * Splits recipients into those worth sending to and those that can't be.
 * Runs before any network call so a single bad row can't reject a chunk
 * of 100 good ones.
 */
export function collectRecipients(
  rows: { email?: string | null; firstName?: string | null }[]
): { valid: NoticeRecipient[]; failed: FailedRecipient[] } {
  const valid: NoticeRecipient[] = []
  const failed: FailedRecipient[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase()

    if (!email) {
      failed.push({ email: '—', reason: 'No email address on file' })
      continue
    }
    if (!EMAIL_SHAPE.test(email)) {
      failed.push({ email, reason: 'Address is not a valid email' })
      continue
    }
    // Two brothers sharing an address would otherwise get two copies.
    if (seen.has(email)) continue
    seen.add(email)

    valid.push({ email, firstName: row.firstName?.trim() || 'Brother' })
  }

  return { valid, failed }
}

export type SentRecipient = {
  email: string
  /**
   * Resend's id for this specific message — the join key every webhook
   * that follows will carry. Null if Resend accepted the chunk but
   * returned fewer ids than we sent, which shouldn't happen but must
   * not be allowed to mis-align the mapping (see below).
   */
  resendEmailId: string | null
}

export type BatchSendResult = {
  sent: number
  accepted: SentRecipient[]
  failed: FailedRecipient[]
}

export async function sendLodgeNoticeBatch({
  recipients, lodgeName, subject, body, sentByName, replyTo, scheduledAt, event, meetingUrl, brand,
}: {
  recipients: NoticeRecipient[]
  lodgeName: string
  brand?: LodgeBrand
  subject: string
  body: string
  sentByName?: string
  replyTo?: string
  /** ISO-8601 instant. Omit to send immediately. */
  scheduledAt?: string
  event?: NoticeEvent
  meetingUrl?: string
}): Promise<BatchSendResult> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev'

  const failed: FailedRecipient[] = []
  const accepted: SentRecipient[] = []
  let sent = 0

  for (let i = 0; i < recipients.length; i += BATCH_LIMIT) {
    const chunk = recipients.slice(i, i + BATCH_LIMIT)

    /**
     * ANNOTATED WITH THE SDK'S OWN TYPE ON PURPOSE.
     *
     * A misspelled optional field here does not fail — it is silently
     * dropped, and the email goes out missing a Reply-To or a schedule
     * with no error anywhere. That already happened once: under
     * resend-node 3.x the field was `reply_to`, and spelling it
     * `replyTo` compiled clean because object spread suppresses
     * TypeScript's excess-property check.
     *
     * The v6 upgrade INVERTED that. `CreateEmailBaseOptions` now uses
     * camelCase `replyTo`; `reply_to` survives only on the raw wire
     * type. So the previously-correct spelling became the silently
     * broken one. Typing the array as CreateBatchOptions turns any
     * future rename into a compile error instead of a quiet omission.
     *
     * (CreateBatchEmailOptions is Omit<CreateEmailOptions,
     * 'attachments'> — the batch endpoint cannot carry attachments at
     * all. See sendNoticeAttachmentNote in the send route for how a
     * lodge attaches a file instead.)
     */
    const messages: CreateBatchOptions = chunk.map((r) => {
      const { html, text } = renderLodgeNotice({
        firstName: r.firstName,
        lodgeName,
        brand,
        subject,
        body,
        sentByName,
        event,
        meetingUrl,
      })

      return {
        from: `${lodgeName} <${from}>`,
        to: r.email,
        subject: `${lodgeName}: ${subject}`,
        html,
        text,
        // Replies reach the officer who sent the notice rather than an
        // unmonitored noreply address. A brother answering "I can't
        // make Tuesday" should reach a person.
        ...(replyTo ? { replyTo } : {}),
        // ISO-8601 instant. Resend holds the message and sends it then;
        // the ids come back immediately either way, so delivery
        // tracking works identically for a scheduled notice.
        ...(scheduledAt ? { scheduledAt } : {}),
      }
    })

    try {
      const { data, error } = await resend.batch.send(messages)

      if (error) {
        // The whole chunk was rejected. Record its recipients with the
        // provider's real message — "The domain is not verified" is
        // actionable in a way that "failed" never was.
        for (const r of chunk) {
          failed.push({ email: r.email, reason: error.message })
        }
        continue
      }

      // Resend returns ids POSITIONALLY — data.data[i] is the id for
      // messages[i]. That ordering is the only thing tying a webhook
      // back to a brother, so it is treated as load-bearing: if the
      // response is short for any reason, the surplus recipients are
      // recorded with a null id rather than silently shifted onto the
      // wrong brother's row. A missing delivery record is recoverable;
      // one attributed to the wrong man is not.
      const ids = data?.data ?? []
      chunk.forEach((r, idx) => {
        accepted.push({ email: r.email, resendEmailId: ids[idx]?.id ?? null })
      })

      sent += ids.length || chunk.length
    } catch (err: any) {
      for (const r of chunk) {
        failed.push({ email: r.email, reason: err?.message || 'Send failed' })
      }
    }
  }

  return { sent, accepted, failed }
}
