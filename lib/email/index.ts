import { Resend } from 'resend'
import { renderLodgeEmail, renderLodgeEmailText, lodgeTitle, type LodgeBrand } from './layout'
import { APP_URL, escapeHtml } from './shared'

export { APP_URL, escapeHtml }
export type { LodgeBrand }

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'

/**
 * LODGE MAIL LOOKS LIKE THE LODGE, NOT LIKE LODGEOS.
 *
 * Every template below renders through lib/email/layout.ts — the
 * lodge's crest, name and tagline at the top, its own contact details
 * and motto in the footer. Read the comment at the top of that file
 * before changing the look of any of these.
 *
 * The brand comes from the tenants row (lib/email/brand.ts). Callers
 * that have not been updated to pass one still work: `fallbackBrand()`
 * builds a plain header from the lodge name alone, which is exactly
 * what the old templates showed anyway.
 */
function fallbackBrand(lodgeName: string): LodgeBrand {
  // lodgeName arrives already formatted as "Psalms of Job Lodge #1827"
  // from older callers, so the number is not split back out — doing so
  // would just risk mangling a name that legitimately contains a '#'.
  return { name: lodgeName, number: null }
}

function resolveBrand(brand: LodgeBrand | undefined, lodgeName: string): LodgeBrand {
  return brand ?? fallbackBrand(lodgeName)
}

/**
 * Every send goes through here so that a Resend rejection throws.
 *
 * The SDK does NOT throw on an API-level rejection — an unverified
 * sending domain, an invalid recipient, a blown quota all RESOLVE, with
 * the reason in `error`. Returning that object unchanged let callers'
 * try/catch pass and report a delivery that never happened, which is
 * the exact bug this codebase has already been bitten by once.
 */
async function send(params: Parameters<Resend['emails']['send']>[0], what: string) {
  const resend = getResend()
  const { data, error } = await resend.emails.send(params)
  if (error) throw new Error(error.message || `Resend rejected the ${what}.`)
  return data
}

// ── Welcome email when a brother is invited ──

/**
 * `actionUrl` is the one-time link minted by lib/auth/inviteLink.ts. It
 * is what actually gets the brother into the portal — a new brother has
 * no password, so a bare link to the login page is a dead end for him.
 * Optional so the email still sends (pointing at the login page, and
 * saying so) if a link could not be minted; a brother who hears from
 * his Secretary that he's been added and finds nothing in his inbox is
 * the worse outcome.
 */
export async function sendWelcomeEmail({
  to, firstName, lodgeName, lodgeSlug, loginUrl, actionUrl, brand,
}: {
  to: string; firstName: string; lodgeName: string; lodgeSlug: string
  loginUrl: string; actionUrl?: string | null; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const title = lodgeTitle(b)

  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: [
      `You have been added to ${title} on the lodge's member portal. Through it you can view your dues and pay them online, see upcoming communications and events, follow your degree progression, read the lodge library, and keep your contact details current.`,
      actionUrl
        ? 'The link below will sign you in and let you choose a password.'
        : `Sign in with this email address at ${loginUrl}.`,
    ],
    cta: { label: actionUrl ? 'Set Up Your Portal' : 'Access Your Portal', url: actionUrl || loginUrl },
    ctaNote: actionUrl
      ? 'This link can only be used once. If it has expired, ask the Secretary to send a new invitation.'
      : undefined,
  }

  return send({
    from: `${title} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: `Welcome to ${title}`,
    html: renderLodgeEmail(b, body, `Your ${title} member portal is ready.`),
    text: renderLodgeEmailText(b, body),
  }, 'welcome email')
}

// ── Password reset ──

/**
 * Sent through Resend rather than Supabase's mailer, for the same
 * reason invitations are: the built-in service is rate limited to a
 * couple of messages an hour and is not meant for production, which is
 * how invitations came to silently never arrive.
 *
 * Says plainly what to do if the request was not theirs. A reset email
 * arriving unbidden is alarming, and the honest answer — nothing has
 * changed, ignore it — is worth stating rather than leaving to guess.
 *
 * `brand` is optional here in a way it is not elsewhere: a man resetting
 * his password has typed only an email address, and until that resolves
 * we may not know which lodge he belongs to.
 */
export async function sendPasswordResetEmail({
  to, firstName, resetUrl, expiresInMinutes = 60, brand,
}: {
  to: string; firstName?: string | null; resetUrl: string
  expiresInMinutes?: number; brand?: LodgeBrand
}) {
  const b = brand ?? { name: 'LodgeOS', tagline: 'Lodge Management Platform', motto: 'Member portal' }
  const body = {
    greeting: firstName ? `Dear Brother ${firstName},` : 'Dear Brother,',
    paragraphs: [
      'We received a request to reset the password for this email address.',
      'If you did not ask for this, you can ignore this email. Your password has not been changed, and it will not change unless someone opens the link below.',
    ],
    cta: { label: 'Choose a New Password', url: resetUrl },
    ctaNote: `This link can only be used once and expires in about ${expiresInMinutes} minutes.`,
    signOff: { closing: 'Fraternally,', lines: [lodgeTitle(b)] },
  }

  return send({
    from: `${lodgeTitle(b)} <${FROM}>`,
    to,
    subject: 'Reset your password',
    html: renderLodgeEmail(b, body, 'A link to choose a new password.'),
    text: renderLodgeEmailText(b, body),
  }, 'password reset email')
}

// ── Removed from the roster ──

/**
 * Tells a brother his membership has ended.
 *
 * TONE IS THE DESIGN HERE. Being taken off a lodge roster is not a
 * subscription lapsing, and the reasons vary enormously: a demit at his
 * own request, a suspension, non-payment, an administrative
 * correction — or a death, where this message reaches a widow. So it
 * states the fact plainly, thanks him, tells him his record is kept,
 * and does not speculate about why or lecture him about it.
 *
 * `note` is the Secretary's own words when he chooses to add them. It
 * is the only part that can explain the reason, and it is his to write
 * rather than something inferred from a status column.
 *
 * The Secretary can also decline to send this at all — see
 * app/api/members/remove. An automatic message is right for the common
 * case and badly wrong for the bereaved one.
 */
export async function sendMembershipRemovedEmail({
  to, firstName, lodgeName, note, brand,
}: {
  to: string; firstName: string; lodgeName: string
  note?: string | null; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const title = lodgeTitle(b)

  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: [
      `This is to let you know that your name has been removed from the roster of ${title}, and your access to the member portal has ended.`,
      ...(note ? [note] : []),
      'Your attendance, dues and degree records remain with the lodge — nothing has been erased, and if you return they attach to you again.',
      'If you believe this has been done in error, reply to this message and the Secretary will look into it.',
    ],
    signOff: { closing: 'Fraternally,', lines: ['The Secretary', title] },
  }

  return send({
    from: `${title} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: `Your membership at ${title}`,
    html: renderLodgeEmail(b, body, 'A change to your membership.'),
    text: renderLodgeEmailText(b, body),
  }, 'membership removal notice')
}

// ── A charge levied against a brother's account ──

/**
 * Tells a brother money has been added to what he owes.
 *
 * Sent on every charge, deliberately and without an opt-out: a charge
 * he does not know about is one he cannot pay, and the first he would
 * otherwise hear of it is a dues reminder for a larger sum than he
 * expects. The reason is always included — /api/dues/charges refuses a
 * charge without one for the same reason this email carries it.
 */
export async function sendChargeAddedEmail({
  to, firstName, lodgeName, amount, reason, chargeType, payUrl, brand,
}: {
  to: string; firstName: string; lodgeName: string
  amount: number; reason: string; chargeType?: string | null
  payUrl: string; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const title = lodgeTitle(b)
  const typeLabel = chargeType ? chargeType.replace(/_/g, ' ') : null

  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: [
      `A charge has been added to your account with ${title}.`,
      'If you believe this is in error, or you would like to arrange terms, reply to this message and the Secretary or Treasurer will take it up with you.',
    ],
    details: [
      { label: 'Amount', value: `$${amount.toFixed(2)}` },
      { label: 'For', value: reason },
      ...(typeLabel ? [{ label: 'Type', value: typeLabel }] : []),
      { label: 'Added', value: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
    ],
    cta: { label: 'View Your Account', url: payUrl },
  }

  return send({
    from: `${title} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: `A charge has been added to your account — $${amount.toFixed(2)}`,
    html: renderLodgeEmail(b, body, `$${amount.toFixed(2)} — ${reason}`),
    text: renderLodgeEmailText(b, body),
  }, 'charge notice')
}

// ── Work given to a brother ──
//
// ONE EMAIL PER BATCH, never one per item. Putting a candidate on the
// Entered Apprentice plan assigns seven steps at once; seven emails
// landing together is how a lodge teaches its brethren to filter its
// mail. The list goes in the body.
export async function sendAssignmentEmail({
  to, firstName, lodgeName, assignedByName, items, dueDate, portalUrl, brand,
}: {
  to: string; firstName: string; lodgeName: string
  assignedByName: string | null
  items: { title: string; description?: string | null }[]
  dueDate?: string | null
  portalUrl: string
  brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const title = lodgeTitle(b)
  const many = items.length > 1
  const from = assignedByName ? `${assignedByName}` : 'The lodge'

  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: [
      many
        ? `${from} has asked you to take on the following at ${title}.`
        : `${from} has asked you to take on the following at ${title}: ${items[0].title}.`,
      ...(many ? items.map((i) => `• ${i.title}${i.description ? ` — ${i.description}` : ''}`) : []),
      ...(!many && items[0].description ? [items[0].description] : []),
      'You can see it in your portal, along with anything else outstanding and what you have already completed.',
    ],
    details: [
      { label: many ? 'Items' : 'Task', value: many ? String(items.length) : items[0].title },
      ...(dueDate
        ? [{ label: 'By', value: new Date(dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }]
        : []),
      ...(assignedByName ? [{ label: 'Asked by', value: assignedByName }] : []),
    ],
    cta: { label: many ? 'See What You Have Been Asked' : 'Open This Task', url: portalUrl },
  }

  return send({
    from: `${title} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: many
      ? `${items.length} things asked of you by ${title}`
      : `You have been asked: ${items[0].title}`,
    html: renderLodgeEmail(b, body, many ? `${items.length} items from ${title}` : items[0].title),
    text: renderLodgeEmailText(b, body),
  }, 'assignment notice')
}

// ── A brother says he has finished ──
//
// To the officer who gave him the work. Without this the submission
// sits in the app and is discovered whenever somebody next opens the
// page, which for a proficiency learned the week before a degree is
// too late to be any use.
export async function sendAssignmentSubmittedEmail({
  to, officerFirstName, brotherName, lodgeName, title, isDegreeWork, reviewUrl, brand,
}: {
  to: string; officerFirstName: string; brotherName: string; lodgeName: string
  title: string; isDegreeWork: boolean; reviewUrl: string; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const t = lodgeTitle(b)

  const body = {
    greeting: `Dear Brother ${officerFirstName},`,
    paragraphs: [
      `${brotherName} says he has completed "${title}".`,
      isDegreeWork
        ? 'This is part of his degree work, so it waits on you: sign it off if you have heard it, or send it back with a word about what is still wanting.'
        : 'Sign it off if you are satisfied, or send it back with a note.',
    ],
    details: [
      { label: 'Brother', value: brotherName },
      { label: 'Item', value: title },
      { label: 'Kind', value: isDegreeWork ? 'Degree work' : 'Task' },
    ],
    cta: { label: 'Sign Off or Send Back', url: reviewUrl },
  }

  return send({
    from: `${t} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: `${brotherName} has finished: ${title}`,
    html: renderLodgeEmail(b, body, `${brotherName} is waiting on your sign-off`),
    text: renderLodgeEmailText(b, body),
  }, 'submission notice')
}

// ── Sent back, with a reason ──
//
// The reason is the whole email. A proficiency returned without one
// teaches the candidate nothing except that he failed, which is the
// opposite of what a mentor is for.
export async function sendAssignmentDeclinedEmail({
  to, firstName, lodgeName, title, note, officerName, portalUrl, brand,
}: {
  to: string; firstName: string; lodgeName: string
  title: string; note: string | null; officerName: string | null
  portalUrl: string; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const t = lodgeTitle(b)

  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: [
      `"${title}" has been sent back to you — it is not yet signed off.`,
      ...(note ? [note] : ['No note was left. Speak to your mentor about what is still wanting.']),
      'It is still on your list. Take it up again and mark it done when you are ready.',
    ],
    details: [
      { label: 'Item', value: title },
      ...(officerName ? [{ label: 'Returned by', value: officerName }] : []),
    ],
    cta: { label: 'See Your Work', url: portalUrl },
  }

  return send({
    from: `${t} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: `Not yet signed off: ${title}`,
    html: renderLodgeEmail(b, body, note ?? 'Sent back for further work'),
    text: renderLodgeEmailText(b, body),
  }, 'decline notice')
}

// ── A brother's years of service ──
//
// Sent by /api/cron/anniversaries, once, in the month the anniversary
// falls. Deliberately warm rather than administrative: this is the one
// piece of automated mail a lodge sends that is not asking for anything.
export async function sendServiceAnniversaryEmail({
  to, firstName, lodgeName, years, raisedDateLabel, milestone, brand,
}: {
  to: string; firstName: string; lodgeName: string
  years: number; raisedDateLabel: string; milestone: boolean
  brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const title = lodgeTitle(b)

  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: milestone
      ? [
          `This month marks ${years} years since you were raised to the sublime degree of Master Mason.`,
          `It is a milestone few reach, and the brethren of ${title} record it with gratitude. Your name will be called at our next stated communication.`,
          'Thank you for the years you have given to the Craft.',
        ]
      : [
          `This month marks ${years} years since you were raised to the sublime degree of Master Mason.`,
          `The brethren of ${title} send their fraternal greetings, and their thanks for your continued service.`,
        ],
    details: [
      { label: 'Raised', value: raisedDateLabel },
      { label: 'Years of service', value: String(years) },
    ],
  }

  return send({
    from: `${title} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: milestone
      ? `${years} years a Master Mason — with the thanks of ${title}`
      : `${years} years since your raising`,
    html: renderLodgeEmail(b, body, `${years} years since you were raised`),
    text: renderLodgeEmailText(b, body),
  }, 'anniversary note')
}

// ── Calendar invite for a lodge event ──
//
// Resend cannot set a custom Content-Type on attachments, so Outlook's
// inline Accept/Decline buttons aren't achievable this way — see
// lib/ics.ts. The .ics still attaches, and the RSVP buttons below are
// the reliable, client-agnostic path since they're plain links.
export async function sendEventInviteEmail({
  to, firstName, lodgeName, eventTitle, eventDateLabel, location, description,
  icsContent, rsvpToken, brand,
}: {
  to: string; firstName: string; lodgeName: string; eventTitle: string
  eventDateLabel: string; location?: string; description?: string
  icsContent: string; rsvpToken: string; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const rsvpBase = `${APP_URL}/api/rsvp/${rsvpToken}`

  const rsvpButtons = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 4px;">
      <tr>
        <td align="center">
          <a href="${rsvpBase}?r=yes" style="display:inline-block;margin:4px;padding:11px 20px;background:#2E7D4F;color:#FFFFFF;text-decoration:none;font-family:Georgia,serif;font-size:13px;border-radius:2px;">Yes, I'll be there</a>
          <a href="${rsvpBase}?r=maybe" style="display:inline-block;margin:4px;padding:11px 20px;border:1px solid #B8912F;color:#B8912F;text-decoration:none;font-family:Georgia,serif;font-size:13px;border-radius:2px;">Maybe</a>
          <a href="${rsvpBase}?r=no" style="display:inline-block;margin:4px;padding:11px 20px;border:1px solid #B03A2E;color:#B03A2E;text-decoration:none;font-family:Georgia,serif;font-size:13px;border-radius:2px;">Can't make it</a>
        </td>
      </tr>
    </table>`

  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: [
      `You are invited to ${eventTitle}.`,
      ...(description ? [description] : []),
      'Will you attend? One tap below records your answer — no sign-in needed.',
    ],
    details: [
      { label: 'Event', value: eventTitle },
      { label: 'Date', value: eventDateLabel },
      ...(location ? [{ label: 'Location', value: location }] : []),
    ],
    extraHtml: rsvpButtons,
    ctaNote: 'A calendar file is attached — most calendar apps will detect it automatically.',
  }

  return send({
    from: `${lodgeTitle(b)} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: `You're Invited: ${eventTitle}`,
    attachments: [{ content: Buffer.from(icsContent).toString('base64'), filename: 'invite.ics' }],
    html: renderLodgeEmail(b, body, `${eventTitle} — ${eventDateLabel}`),
    text: renderLodgeEmailText(b, body),
  }, 'event invitation')
}

// ── Dues reminder ──
export async function sendDuesReminderEmail({
  to, firstName, lodgeName, amount, year, payUrl, daysOverdue, brand,
}: {
  to: string; firstName: string; lodgeName: string; amount: number; year: number
  payUrl: string; daysOverdue?: number; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const overdue = Boolean(daysOverdue && daysOverdue > 30)

  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: [
      overdue
        ? `Our records show your ${year} annual dues remain outstanding and are now more than thirty days past due.`
        : `This is a friendly reminder that your ${year} annual dues are outstanding.`,
      'Keeping your dues current maintains your good standing in the lodge. If you have any questions, or if this reminder is in error, please contact the Secretary.',
    ],
    details: [
      { label: 'Amount Due', value: `$${amount}` },
      { label: 'Year', value: String(year) },
      ...(overdue ? [{ label: 'Status', value: `${daysOverdue} days past due` }] : []),
    ],
    cta: { label: `Pay Now — $${amount}`, url: payUrl },
  }

  return send({
    from: `${lodgeTitle(b)} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: overdue
      ? `Action Required: ${year} dues past due`
      : `Reminder: ${year} annual dues — $${amount}`,
    html: renderLodgeEmail(b, body, `$${amount} due for ${year}.`),
    text: renderLodgeEmailText(b, body),
  }, 'dues reminder')
}

// ── Payment receipt ──
export async function sendPaymentReceiptEmail({
  to, firstName, lodgeName, amount, year, receiptUrl, brand,
}: {
  to: string; firstName: string; lodgeName: string; amount: number; year: number
  receiptUrl?: string; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: [
      `Your ${year} dues payment has been received with thanks. Your membership status is now Paid — Good Standing.`,
    ],
    details: [
      { label: 'Lodge', value: lodgeTitle(b) },
      { label: 'Year', value: String(year) },
      { label: 'Amount Paid', value: `$${amount}` },
    ],
    ...(receiptUrl ? { cta: { label: 'View Full Receipt', url: receiptUrl } } : {}),
  }

  return send({
    from: `${lodgeTitle(b)} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: `Receipt: ${year} dues paid — $${amount}`,
    html: renderLodgeEmail(b, body, `$${amount} received. Thank you.`),
    text: renderLodgeEmailText(b, body),
  }, 'payment receipt')
}

// ── Event reminder (48hrs before) ──
export async function sendEventReminderEmail({
  to, firstName, lodgeName, eventTitle, eventDate, eventTime, location, dressCode, portalUrl, brand,
}: {
  to: string; firstName: string; lodgeName: string; eventTitle: string; eventDate: string
  eventTime?: string; location?: string; dressCode?: string; portalUrl: string; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const body = {
    greeting: `Dear Brother ${firstName},`,
    paragraphs: [
      `This is a reminder of our upcoming ${eventTitle}.`,
      'Your attendance and participation are important as we continue the work of building better men and a stronger community.',
    ],
    details: [
      { label: 'Date', value: eventDate },
      ...(eventTime ? [{ label: 'Time', value: eventTime }] : []),
      ...(location ? [{ label: 'Location', value: location }] : []),
      ...(dressCode ? [{ label: 'Dress', value: dressCode }] : []),
    ],
    cta: { label: 'View in the Portal', url: portalUrl },
  }

  return send({
    from: `${lodgeTitle(b)} <${FROM}>`,
    to,
    replyTo: b.email || undefined,
    subject: `Reminder: ${eventTitle}`,
    html: renderLodgeEmail(b, body, `${eventDate}${eventTime ? ` at ${eventTime}` : ''}`),
    text: renderLodgeEmailText(b, body),
  }, 'event reminder')
}

// ── New petition alert to the Secretary ──
export async function sendNewPetitionAlert({
  to, secretaryName, lodgeName, petitionerName, petitionerEmail, dashboardUrl, brand,
}: {
  to: string; secretaryName: string; lodgeName: string; petitionerName: string
  petitionerEmail: string; dashboardUrl: string; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const body = {
    greeting: `Dear Brother ${secretaryName},`,
    paragraphs: [`A new petition for membership has been submitted to ${lodgeTitle(b)}.`],
    details: [
      { label: 'Petitioner', value: petitionerName },
      { label: 'Email', value: petitionerEmail },
    ],
    cta: { label: 'Review Petition', url: dashboardUrl },
    signOff: { closing: 'Fraternally,', lines: [lodgeTitle(b)] },
  }

  return send({
    from: `${lodgeTitle(b)} <${FROM}>`,
    to,
    replyTo: petitionerEmail,
    subject: `New petition received — ${petitionerName}`,
    html: renderLodgeEmail(b, body, `${petitionerName} has petitioned for membership.`),
    text: renderLodgeEmailText(b, body),
  }, 'petition alert')
}

// ── A brother asking his lodge for a portal login ──

/**
 * Deliberately states that nothing has been granted. The Secretary is
 * the one who knows whether this is really a brother of the lodge, and
 * the only thing that creates an account is him choosing to invite the
 * man from the Members page.
 *
 * Every value here was typed by an anonymous visitor. The template
 * escapes them; do not add a field that bypasses that.
 */
export async function sendPortalAccessRequestAlert({
  to, secretaryName, lodgeName, requesterName, requesterEmail, requesterPhone,
  yearsAMember, lodgeRole, message, membersUrl, brand,
}: {
  to: string; secretaryName: string; lodgeName: string
  requesterName: string; requesterEmail: string; requesterPhone?: string | null
  yearsAMember?: string | null; lodgeRole?: string | null; message?: string | null
  membersUrl: string; brand?: LodgeBrand
}) {
  const b = resolveBrand(brand, lodgeName)
  const body = {
    greeting: `Dear Brother ${secretaryName},`,
    paragraphs: [
      `Someone has asked for portal access to ${lodgeTitle(b)}.`,
      ...(message ? [message] : []),
      'Nothing has been granted, and none of the details above are verified. If you know this man to be a brother of the lodge, invite him from the Members page — that is what creates his login.',
    ],
    details: [
      { label: 'Name', value: requesterName },
      { label: 'Email', value: requesterEmail },
      ...(requesterPhone ? [{ label: 'Phone', value: requesterPhone }] : []),
      ...(yearsAMember ? [{ label: 'Member Since', value: yearsAMember }] : []),
      ...(lodgeRole ? [{ label: 'Office', value: lodgeRole }] : []),
    ],
    cta: { label: 'Open the Members Page', url: membersUrl },
    signOff: { closing: 'Fraternally,', lines: [lodgeTitle(b)] },
  }

  return send({
    from: `${lodgeTitle(b)} <${FROM}>`,
    to,
    replyTo: requesterEmail,
    subject: `Portal access requested — ${requesterName}`,
    html: renderLodgeEmail(b, body, `${requesterName} has asked for a portal login.`),
    text: renderLodgeEmailText(b, body),
  }, 'portal access request alert')
}

// ── A lodge asking to use LodgeOS ──
//
// The one email here that is genuinely FROM the platform rather than
// from a lodge, so it carries LodgeOS's own header rather than a
// lodge's crest.
export async function sendPlatformAccessRequestAlert({
  to, lodgeName, lodgeNumber, jurisdiction, contactName, contactEmail, contactPhone,
  contactRole, memberCount, message,
}: {
  to: string; lodgeName: string; lodgeNumber?: string | null; jurisdiction?: string | null
  contactName: string; contactEmail: string; contactPhone?: string | null
  contactRole?: string | null; memberCount?: number | null; message?: string | null
}) {
  const platform: LodgeBrand = {
    name: 'LodgeOS',
    tagline: 'Lodge Management Platform',
    motto: 'Access request',
  }

  const body = {
    greeting: 'A lodge has asked for access.',
    paragraphs: [
      ...(message ? [message] : []),
      `Replying to this email reaches ${contactName} directly.`,
    ],
    details: [
      { label: 'Lodge', value: lodgeNumber ? `${lodgeName} #${lodgeNumber}` : lodgeName },
      ...(jurisdiction ? [{ label: 'Jurisdiction', value: jurisdiction }] : []),
      { label: 'Contact', value: contactName },
      ...(contactRole ? [{ label: 'Office', value: contactRole }] : []),
      { label: 'Email', value: contactEmail },
      ...(contactPhone ? [{ label: 'Phone', value: contactPhone }] : []),
      ...(memberCount != null ? [{ label: 'Members', value: String(memberCount) }] : []),
    ],
    signOff: { closing: '', lines: [] },
  }

  return send({
    from: `LodgeOS <${FROM}>`,
    to,
    replyTo: contactEmail,
    subject: `Access request — ${lodgeNumber ? `${lodgeName} #${lodgeNumber}` : lodgeName}`,
    html: renderLodgeEmail(platform, body, `${contactName} of ${lodgeName}`),
    text: renderLodgeEmailText(platform, body),
  }, 'access request alert')
}
