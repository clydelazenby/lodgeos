import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lodgeos.com'

// ── Welcome email when brother is invited ──
export async function sendWelcomeEmail({
  to, firstName, lodgeName, lodgeSlug, loginUrl,
}: { to: string; firstName: string; lodgeName: string; lodgeSlug: string; loginUrl: string }) {
  return resend.emails.send({
    from: `${lodgeName} via LodgeOS <${FROM}>`,
    to,
    subject: `Welcome to ${lodgeName} — Your portal is ready`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#0A0E1A;color:#F5F0E8;padding:40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-family:'Arial',sans-serif;font-size:24px;font-weight:700;color:#C9A84C;letter-spacing:0.2em;">LODGEOS</div>
          <div style="font-size:12px;color:#B8B0A0;letter-spacing:0.3em;margin-top:4px;">LODGE MANAGEMENT PLATFORM</div>
        </div>
        <h1 style="font-family:'Arial',sans-serif;font-size:22px;color:#F5F0E8;margin-bottom:8px;">Welcome, Brother ${firstName}</h1>
        <p style="color:#B8B0A0;line-height:1.7;margin-bottom:24px;">You have been added to <strong style="color:#C9A84C;">${lodgeName}</strong> on LodgeOS. Your brother portal is now active.</p>
        <div style="background:#141C2E;padding:20px;margin-bottom:24px;border-left:3px solid #C9A84C;">
          <p style="color:#B8B0A0;font-size:14px;margin:0 0 8px;">Through your portal you can:</p>
          <ul style="color:#B8B0A0;font-size:14px;line-height:2;margin:0;padding-left:20px;">
            <li>View your dues balance and pay online</li>
            <li>See upcoming lodge events</li>
            <li>Track your degree progression</li>
            <li>Update your contact information</li>
          </ul>
        </div>
        <div style="text-align:center;margin-bottom:32px;">
          <a href="${loginUrl}" style="background:#C9A84C;color:#0A0E1A;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;padding:14px 36px;text-decoration:none;display:inline-block;">Access Your Portal</a>
        </div>
        <p style="color:#B8B0A0;font-size:13px;line-height:1.7;">If you have any questions contact your Secretary directly or reply to this email.</p>
        <div style="border-top:1px solid rgba(201,168,76,0.2);margin-top:32px;padding-top:16px;text-align:center;">
          <p style="color:rgba(184,176,160,0.4);font-size:11px;font-style:italic;">Liberty · Equality · Fraternity</p>
          <p style="color:rgba(184,176,160,0.3);font-size:11px;">Powered by LodgeOS · ${APP_URL}</p>
        </div>
      </div>
    `,
  })
}

// ── General lodge notice (used by Communications — arbitrary subject/body to a recipient group) ──
export async function sendLodgeNoticeEmail({
  to, firstName, lodgeName, subject, body, sentByName,
}: { to: string; firstName: string; lodgeName: string; subject: string; body: string; sentByName?: string }) {
  const bodyHtml = body
    .split('\n')
    .map(line => line.trim().length ? `<p style="margin:0 0 14px;">${line}</p>` : '')
    .join('')

  return resend.emails.send({
    from: `${lodgeName} via LodgeOS <${FROM}>`,
    to,
    subject: `${lodgeName}: ${subject}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#0A0E1A;color:#F5F0E8;padding:40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-family:'Arial',sans-serif;font-size:24px;font-weight:700;color:#C9A84C;letter-spacing:0.2em;">LODGEOS</div>
        </div>
        <h1 style="font-family:'Arial',sans-serif;font-size:20px;color:#F5F0E8;margin-bottom:4px;">${subject}</h1>
        <p style="color:rgba(184,176,160,0.6);font-size:12px;margin-bottom:24px;">${lodgeName}${sentByName ? ` · Sent by ${sentByName}` : ''}</p>
        <div style="background:#141C2E;padding:24px;margin-bottom:24px;border-left:3px solid #C9A84C;color:#B8B0A0;font-size:14px;line-height:1.7;">
          <p style="margin:0 0 14px;">Brother ${firstName},</p>
          ${bodyHtml}
        </div>
        <div style="border-top:1px solid rgba(201,168,76,0.2);margin-top:32px;padding-top:16px;text-align:center;">
          <p style="color:rgba(184,176,160,0.4);font-size:11px;font-style:italic;">Liberty · Equality · Fraternity</p>
          <p style="color:rgba(184,176,160,0.3);font-size:11px;">Powered by LodgeOS</p>
        </div>
      </div>
    `,
  })
}

// ── Calendar invite for a lodge event (Resend cannot set a custom
// Content-Type on attachments, so Outlook's inline Accept/Decline
// buttons aren't achievable this way — see lib/ics.ts. The .ics still
// attaches, and the RSVP buttons below are the reliable, client-
// agnostic path since they're plain links. ──
export async function sendEventInviteEmail({
  to, firstName, lodgeName, eventTitle, eventDateLabel, location, description,
  icsContent, rsvpToken,
}: {
  to: string; firstName: string; lodgeName: string; eventTitle: string
  eventDateLabel: string; location?: string; description?: string
  icsContent: string; rsvpToken: string
}) {
  const rsvpBase = `${APP_URL}/api/rsvp/${rsvpToken}`
  return resend.emails.send({
    from: `${lodgeName} via LodgeOS <${FROM}>`,
    to,
    subject: `You're Invited: ${eventTitle} — ${lodgeName}`,
    attachments: [
      { content: Buffer.from(icsContent).toString('base64'), filename: 'invite.ics' },
    ],
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#0A0E1A;color:#F5F0E8;padding:40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-family:'Arial',sans-serif;font-size:24px;font-weight:700;color:#C9A84C;letter-spacing:0.2em;">LODGEOS</div>
        </div>
        <h1 style="font-family:'Arial',sans-serif;font-size:20px;color:#F5F0E8;margin-bottom:4px;">${eventTitle}</h1>
        <p style="color:rgba(184,176,160,0.6);font-size:12px;margin-bottom:24px;">${lodgeName}</p>
        <div style="background:#141C2E;padding:24px;margin-bottom:24px;border-left:3px solid #C9A84C;">
          <p style="color:#F5F0E8;font-size:14px;margin:0 0 8px;"><strong>${eventDateLabel}</strong></p>
          ${location ? `<p style="color:#B8B0A0;font-size:13px;margin:0 0 8px;">${location}</p>` : ''}
          ${description ? `<p style="color:#B8B0A0;font-size:13px;line-height:1.6;margin:12px 0 0;">${description}</p>` : ''}
        </div>
        <p style="color:#B8B0A0;font-size:14px;margin-bottom:8px;">Brother ${firstName}, will you attend?</p>
        <div style="text-align:center;margin:20px 0;">
          <a href="${rsvpBase}?r=yes" style="display:inline-block;background:#5DBE85;color:#0A0E1A;text-decoration:none;padding:10px 20px;margin:0 4px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;border-radius:4px;">Yes, I'll be there</a>
          <a href="${rsvpBase}?r=maybe" style="display:inline-block;background:transparent;border:1px solid #C9A84C;color:#C9A84C;text-decoration:none;padding:10px 20px;margin:0 4px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;border-radius:4px;">Maybe</a>
          <a href="${rsvpBase}?r=no" style="display:inline-block;background:transparent;border:1px solid #E74C3C;color:#E74C3C;text-decoration:none;padding:10px 20px;margin:0 4px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;border-radius:4px;">Can't make it</a>
        </div>
        <p style="color:rgba(184,176,160,0.5);font-size:11px;text-align:center;">A calendar file is attached — most calendar apps will detect it automatically. One tap above and you're marked without needing to sign in.</p>
        <div style="border-top:1px solid rgba(201,168,76,0.2);margin-top:32px;padding-top:16px;text-align:center;">
          <p style="color:rgba(184,176,160,0.4);font-size:11px;font-style:italic;">Liberty · Equality · Fraternity</p>
          <p style="color:rgba(184,176,160,0.3);font-size:11px;">Powered by LodgeOS</p>
        </div>
      </div>
    `,
  })
}

// ── Dues reminder ──
export async function sendDuesReminderEmail({
  to, firstName, lodgeName, amount, year, payUrl, daysOverdue,
}: { to: string; firstName: string; lodgeName: string; amount: number; year: number; payUrl: string; daysOverdue?: number }) {
  const subject = daysOverdue && daysOverdue > 30
    ? `Action Required: ${lodgeName} dues ${year} past due`
    : `Reminder: ${lodgeName} annual dues ${year} — $${amount}`

  return resend.emails.send({
    from: `${lodgeName} via LodgeOS <${FROM}>`,
    to,
    subject,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#0A0E1A;color:#F5F0E8;padding:40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-family:'Arial',sans-serif;font-size:24px;font-weight:700;color:#C9A84C;letter-spacing:0.2em;">LODGEOS</div>
        </div>
        <h1 style="font-family:'Arial',sans-serif;font-size:20px;color:#F5F0E8;margin-bottom:8px;">Brother ${firstName},</h1>
        <p style="color:#B8B0A0;line-height:1.7;margin-bottom:24px;">This is a friendly reminder that your <strong style="color:#C9A84C;">${lodgeName}</strong> annual dues for ${year} are outstanding.</p>
        <div style="background:#141C2E;padding:24px;margin-bottom:24px;text-align:center;">
          <div style="font-family:'Arial',sans-serif;font-size:12px;letter-spacing:0.2em;color:#B8B0A0;text-transform:uppercase;margin-bottom:8px;">Amount Due</div>
          <div style="font-family:'Arial',sans-serif;font-size:36px;font-weight:700;color:#C9A84C;">$${amount}</div>
          <div style="font-family:'Arial',sans-serif;font-size:12px;color:#B8B0A0;margin-top:4px;">Annual dues for ${year}</div>
        </div>
        <div style="text-align:center;margin-bottom:32px;">
          <a href="${payUrl}" style="background:#C9A84C;color:#0A0E1A;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;padding:14px 36px;text-decoration:none;display:inline-block;">Pay Now — $${amount}</a>
        </div>
        <p style="color:#B8B0A0;font-size:13px;line-height:1.7;">Keeping your dues current maintains your good standing in the lodge. If you have any questions or concerns please contact your Secretary.</p>
        <div style="border-top:1px solid rgba(201,168,76,0.2);margin-top:32px;padding-top:16px;text-align:center;">
          <p style="color:rgba(184,176,160,0.4);font-size:11px;font-style:italic;">Liberty · Equality · Fraternity</p>
          <p style="color:rgba(184,176,160,0.3);font-size:11px;">Powered by LodgeOS</p>
        </div>
      </div>
    `,
  })
}

// ── Payment receipt ──
export async function sendPaymentReceiptEmail({
  to, firstName, lodgeName, amount, year, receiptUrl,
}: { to: string; firstName: string; lodgeName: string; amount: number; year: number; receiptUrl?: string }) {
  return resend.emails.send({
    from: `${lodgeName} via LodgeOS <${FROM}>`,
    to,
    subject: `Receipt: ${lodgeName} dues paid — $${amount}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#0A0E1A;color:#F5F0E8;padding:40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-family:'Arial',sans-serif;font-size:24px;font-weight:700;color:#C9A84C;letter-spacing:0.2em;">LODGEOS</div>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:48px;height:48px;background:rgba(39,174,96,0.2);border:1px solid rgba(39,174,96,0.4);border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#5DBE85;font-size:20px;">✓</span>
          </div>
          <h1 style="font-family:'Arial',sans-serif;font-size:20px;color:#5DBE85;margin:0;">Payment Confirmed</h1>
        </div>
        <p style="color:#B8B0A0;line-height:1.7;margin-bottom:24px;">Brother ${firstName}, your ${year} dues payment to <strong style="color:#C9A84C;">${lodgeName}</strong> has been received.</p>
        <div style="background:#141C2E;padding:24px;margin-bottom:24px;">
          <table style="width:100%;font-size:14px;color:#B8B0A0;">
            <tr><td style="padding:6px 0;">Lodge</td><td style="text-align:right;color:#F5F0E8;">${lodgeName}</td></tr>
            <tr><td style="padding:6px 0;">Year</td><td style="text-align:right;color:#F5F0E8;">${year}</td></tr>
            <tr><td style="padding:6px 0;border-top:1px solid rgba(201,168,76,0.1);padding-top:12px;font-weight:bold;color:#C9A84C;">Amount Paid</td><td style="text-align:right;color:#C9A84C;font-size:18px;font-weight:bold;border-top:1px solid rgba(201,168,76,0.1);padding-top:12px;">$${amount}</td></tr>
          </table>
        </div>
        <p style="color:#B8B0A0;font-size:13px;">Your membership status has been updated to <strong style="color:#5DBE85;">Paid — Good Standing</strong>.</p>
        ${receiptUrl ? `<div style="text-align:center;margin:24px 0;"><a href="${receiptUrl}" style="color:#C9A84C;font-size:13px;">View full receipt →</a></div>` : ''}
        <div style="border-top:1px solid rgba(201,168,76,0.2);margin-top:32px;padding-top:16px;text-align:center;">
          <p style="color:rgba(184,176,160,0.4);font-size:11px;font-style:italic;">Liberty · Equality · Fraternity</p>
        </div>
      </div>
    `,
  })
}

// ── New petition alert to secretary ──
export async function sendNewPetitionAlert({
  to, secretaryName, lodgeName, petitionerName, petitionerEmail, dashboardUrl,
}: { to: string; secretaryName: string; lodgeName: string; petitionerName: string; petitionerEmail: string; dashboardUrl: string }) {
  return resend.emails.send({
    from: `LodgeOS <${FROM}>`,
    to,
    subject: `New petition received — ${petitionerName}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#0A0E1A;color:#F5F0E8;padding:40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-family:'Arial',sans-serif;font-size:24px;font-weight:700;color:#C9A84C;letter-spacing:0.2em;">LODGEOS</div>
        </div>
        <h1 style="font-family:'Arial',sans-serif;font-size:20px;color:#F5F0E8;margin-bottom:8px;">New Petition Received</h1>
        <p style="color:#B8B0A0;line-height:1.7;margin-bottom:24px;">Brother ${secretaryName}, a new petition has been submitted to <strong style="color:#C9A84C;">${lodgeName}</strong>.</p>
        <div style="background:#141C2E;padding:20px;margin-bottom:24px;border-left:3px solid #C9A84C;">
          <div style="font-size:14px;color:#B8B0A0;margin-bottom:4px;">Petitioner</div>
          <div style="font-size:18px;color:#F5F0E8;margin-bottom:12px;">${petitionerName}</div>
          <div style="font-size:14px;color:#B8B0A0;margin-bottom:4px;">Email</div>
          <div style="font-size:14px;color:#C9A84C;">${petitionerEmail}</div>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${dashboardUrl}" style="background:#C9A84C;color:#0A0E1A;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;padding:14px 36px;text-decoration:none;display:inline-block;">Review Petition</a>
        </div>
        <div style="border-top:1px solid rgba(201,168,76,0.2);margin-top:32px;padding-top:16px;text-align:center;">
          <p style="color:rgba(184,176,160,0.3);font-size:11px;">Powered by LodgeOS</p>
        </div>
      </div>
    `,
  })
}

// ── Event reminder (48hrs before) ──
export async function sendEventReminderEmail({
  to, firstName, lodgeName, eventTitle, eventDate, eventTime, location, dressCode, portalUrl,
}: { to: string; firstName: string; lodgeName: string; eventTitle: string; eventDate: string; eventTime?: string; location?: string; dressCode?: string; portalUrl: string }) {
  return resend.emails.send({
    from: `${lodgeName} via LodgeOS <${FROM}>`,
    to,
    subject: `Reminder: ${eventTitle} — Tomorrow`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#0A0E1A;color:#F5F0E8;padding:40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="font-family:'Arial',sans-serif;font-size:24px;font-weight:700;color:#C9A84C;letter-spacing:0.2em;">LODGEOS</div>
        </div>
        <h1 style="font-family:'Arial',sans-serif;font-size:20px;color:#F5F0E8;margin-bottom:8px;">Reminder, Brother ${firstName}</h1>
        <p style="color:#B8B0A0;line-height:1.7;margin-bottom:24px;">This is your 48-hour reminder for an upcoming <strong style="color:#C9A84C;">${lodgeName}</strong> event.</p>
        <div style="background:#141C2E;padding:24px;margin-bottom:24px;">
          <div style="font-family:'Arial',sans-serif;font-size:18px;font-weight:700;color:#F5F0E8;margin-bottom:16px;">${eventTitle}</div>
          <table style="width:100%;font-size:14px;color:#B8B0A0;">
            <tr><td style="padding:4px 0;">Date</td><td style="text-align:right;color:#F5F0E8;">${eventDate}</td></tr>
            ${eventTime ? `<tr><td style="padding:4px 0;">Time</td><td style="text-align:right;color:#F5F0E8;">${eventTime}</td></tr>` : ''}
            ${location ? `<tr><td style="padding:4px 0;">Location</td><td style="text-align:right;color:#F5F0E8;">${location}</td></tr>` : ''}
            ${dressCode ? `<tr><td style="padding:4px 0;color:#C9A84C;">Dress Code</td><td style="text-align:right;color:#C9A84C;">${dressCode}</td></tr>` : ''}
          </table>
        </div>
        <div style="border-top:1px solid rgba(201,168,76,0.2);margin-top:32px;padding-top:16px;text-align:center;">
          <p style="color:rgba(184,176,160,0.4);font-size:11px;font-style:italic;">Liberty · Equality · Fraternity</p>
        </div>
      </div>
    `,
  })
}
