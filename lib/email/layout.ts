import { escapeHtml, APP_URL } from './shared'

/**
 * The lodge's stationery, as one template.
 *
 * WHY THIS REPLACED THE OLD LOOK.
 *
 * Every email was a dark navy card with "LODGEOS" across the top — the
 * platform's branding, on mail the lodge sends to its own brethren. A
 * notice from Psalms of Job should look like it came from Psalms of
 * Job: the crest, the lodge's name, its tagline, its contact details in
 * the footer. LodgeOS is the tool, not the sender.
 *
 * The design is dark — navy ground, cream serif, gold rules — matching
 * the lodge's own palette in globals.css, so an email and the portal
 * look like one another. It was briefly light, and the whole theme
 * lives in the colour block below: inverting it again means editing
 * those constants and nothing else.
 *
 * One consequence of a dark email worth knowing: clients that apply
 * their own dark mode can compound it. The <meta color-scheme> tags
 * below declare this message as already dark, which is what stops
 * Gmail and Outlook re-inverting it into something muddy.
 *
 * EMAIL HTML, NOT WEB HTML. Tables and inline styles throughout, no
 * flexbox, no grid, no <style> block: Outlook renders none of those
 * reliably. Keep it that way when editing.
 *
 * On icons: the design they came from uses small glyphs beside each
 * detail row. Those are deliberately NOT reproduced as images — remote
 * images are blocked by default in most clients, so an icon-led layout
 * degrades into a row of empty boxes. The structure carries the look
 * instead: a gold rule down the left of the detail block, labels in
 * letterspaced navy caps, values in serif. The crest IS a remote image,
 * which is normal for a logo and degrades to its alt text.
 */

export type LodgeBrand = {
  name: string
  number?: string | null
  logoUrl?: string | null
  tagline?: string | null
  motto?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
}

/**
 * The lodge's colours, dark. These mirror the app's own palette
 * (globals.css) so an email and the portal look like one another.
 *
 * The names are kept from the light version deliberately — PAPER is
 * "the surface the letter is written on" whatever colour that is — so
 * the markup below did not have to be rewritten to invert the theme,
 * and can be inverted again by changing only this block.
 */
const NAVY = '#F5F0E8'      // headings: cream on dark
const GOLD = '#C9A84C'
const INK = '#E8E2D5'       // body text
const INK_SOFT = '#B8B0A0'  // secondary text
const PAPER = '#0A0E1A'     // the letter itself
const PAPER_EDGE = '#060910' // the surround, and the footer band
const RULE = 'rgba(201,168,76,0.22)'
/** Button fill. Gold on dark reads far better than navy-on-navy. */
const BUTTON_BG = '#C9A84C'
const BUTTON_INK = '#0A0E1A'

/** "Psalms of Job Lodge #1827" */
export function lodgeTitle(brand: LodgeBrand): string {
  return brand.number ? `${brand.name} #${brand.number}` : brand.name
}

export type DetailRow = { label: string; value: string }

export type EmailBody = {
  /** "Dear Brother," or "Dear Brother John," */
  greeting?: string
  /** Paragraphs of plain text. Escaped — pass text, not markup. */
  paragraphs?: string[]
  /** The DATE / TIME / LOCATION block. */
  details?: DetailRow[]
  /** Rendered after the details. Must already be safe HTML. */
  extraHtml?: string
  cta?: { label: string; url: string }
  /** Small print under the button. */
  ctaNote?: string
  /** Defaults to "Fraternally," + the lodge's officers. */
  signOff?: { closing?: string; lines?: string[] }
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:${INK};">${escapeHtml(text)}</p>`
}

function detailBlock(rows: DetailRow[]): string {
  if (rows.length === 0) return ''
  const cells = rows.map(row => `
    <tr>
      <td style="padding:7px 18px 7px 0;vertical-align:top;white-space:nowrap;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${NAVY};font-weight:bold;">${escapeHtml(row.label)}</td>
      <td style="padding:7px 0;vertical-align:top;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.5;color:${INK};">${escapeHtml(row.value).replace(/\n/g, '<br>')}</td>
    </tr>`).join('')

  // The left gold rule is a bordered cell, not a CSS border on a div —
  // Outlook drops border-left on block elements often enough to matter.
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 24px;">
    <tr>
      <td width="3" style="width:3px;background:${GOLD};"></td>
      <td style="padding-left:20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">${cells}</table>
      </td>
    </tr>
  </table>`
}

/** Gold rule with a diamond at its centre. */
function divider(): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0;">
    <tr>
      <td style="border-bottom:1px solid ${RULE};font-size:0;line-height:0;">&nbsp;</td>
      <td width="34" style="width:34px;text-align:center;font-family:Georgia,serif;font-size:11px;color:${GOLD};line-height:1;">&#9670;</td>
      <td style="border-bottom:1px solid ${RULE};font-size:0;line-height:0;">&nbsp;</td>
    </tr>
  </table>`
}

function footer(brand: LodgeBrand): string {
  const contacts = [
    brand.email ? escapeHtml(brand.email) : null,
    brand.website ? escapeHtml(brand.website.replace(/^https?:\/\//, '')) : null,
    brand.phone ? escapeHtml(brand.phone) : null,
  ].filter(Boolean) as string[]

  const contactRow = contacts.length
    ? `<p style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:13px;color:${INK_SOFT};line-height:1.8;">${contacts.join(`<span style="color:${RULE};"> &nbsp;|&nbsp; </span>`)}</p>`
    : ''

  const motto = brand.motto || 'Making good men better'

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#141C2E;border-top:1px solid ${RULE};">
    <tr>
      <td style="padding:26px 32px;text-align:center;">
        ${contactRow}
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${NAVY};">${escapeHtml(motto)}</p>
      </td>
    </tr>
  </table>`
}

/**
 * Wraps a message in the lodge's stationery and returns the full HTML
 * document.
 *
 * `subject` is used as the preheader — the grey line a client shows
 * beside the subject in the inbox list. Left unset it pulls whatever
 * text comes first, which is usually the lodge's own address.
 */
export function renderLodgeEmail(brand: LodgeBrand, body: EmailBody, preheader?: string): string {
  const title = lodgeTitle(brand)
  const tagline = brand.tagline || 'Faith · Brotherhood · Service'

  const crest = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" width="120" alt="${escapeHtml(title)}" style="display:block;margin:0 auto 18px;width:120px;max-width:120px;height:auto;border:0;">`
    : ''

  const greeting = body.greeting
    ? `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:${INK};">${escapeHtml(body.greeting)}</p>`
    : ''

  const paragraphs = (body.paragraphs ?? []).map(paragraph).join('')

  const cta = body.cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 6px;">
        <tr>
          <td style="background:${BUTTON_BG};border-radius:2px;">
            <a href="${body.cta.url}" style="display:inline-block;padding:14px 34px;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:bold;letter-spacing:0.14em;text-transform:uppercase;color:${BUTTON_INK};text-decoration:none;">${escapeHtml(body.cta.label)}</a>
          </td>
        </tr>
      </table>`
    : ''

  const ctaNote = body.ctaNote
    ? `<p style="margin:6px 0 0;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.6;color:${INK_SOFT};">${escapeHtml(body.ctaNote)}</p>`
    : ''

  const closing = body.signOff?.closing ?? 'Fraternally,'
  const signLines = body.signOff?.lines ?? ['Worshipful Master & Officers', title]
  const signOff = `
    <p style="margin:26px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:${INK};">
      ${escapeHtml(closing)}<br>
      ${signLines.map(l => escapeHtml(l)).join('<br>')}
    </p>`

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER_EDGE};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_EDGE};">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:${PAPER};border:1px solid ${RULE};">
        <tr>
          <td style="padding:36px 32px 0;text-align:center;">
            ${crest}
            <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;letter-spacing:0.04em;text-transform:uppercase;color:${NAVY};font-weight:normal;">${escapeHtml(title)}</h1>
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${GOLD};">${escapeHtml(tagline)}</p>
            ${divider()}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px;">
            ${greeting}
            ${paragraphs}
            ${detailBlock(body.details ?? [])}
            ${body.extraHtml ?? ''}
            ${cta}
            ${ctaNote}
            ${signOff}
          </td>
        </tr>
        <tr><td>${footer(brand)}</td></tr>
      </table>
      <p style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:11px;color:rgba(184,176,160,0.45);">
        Sent by ${escapeHtml(title)} · <a href="${APP_URL}" style="color:rgba(201,168,76,0.6);">member portal</a>
      </p>
    </td>
  </tr>
</table>
</body>
</html>`
}

/**
 * Plain-text alternative. Worth generating rather than letting Resend
 * infer one: a table-heavy HTML mail auto-converts into something close
 * to unreadable, and the text part is what a screen reader and a
 * spam filter both look at.
 */
export function renderLodgeEmailText(brand: LodgeBrand, body: EmailBody): string {
  const lines: string[] = [lodgeTitle(brand).toUpperCase(), '']
  if (body.greeting) lines.push(body.greeting, '')
  for (const p of body.paragraphs ?? []) lines.push(p, '')
  for (const row of body.details ?? []) lines.push(`${row.label.toUpperCase()}: ${row.value}`)
  if (body.details?.length) lines.push('')
  if (body.cta) lines.push(`${body.cta.label}: ${body.cta.url}`, '')
  if (body.ctaNote) lines.push(body.ctaNote, '')
  lines.push(body.signOff?.closing ?? 'Fraternally,')
  lines.push(...(body.signOff?.lines ?? ['Worshipful Master & Officers', lodgeTitle(brand)]))
  const contacts = [brand.email, brand.website, brand.phone].filter(Boolean)
  if (contacts.length) lines.push('', contacts.join(' | '))
  if (brand.motto) lines.push(brand.motto)
  return lines.join('\n')
}
