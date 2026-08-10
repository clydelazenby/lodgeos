/**
 * Telling a draft apart from an answer.
 *
 * "Who owes dues?" and "draft the minutes" come back through the same
 * channel and used to look identical — a wall of grey text with a COPY
 * button under it. But they are different objects. An answer is read and
 * discarded; a draft is a document on its way somewhere, and it wants a
 * frame, a subject line and a way out of the panel.
 *
 * The model marks its own drafts (see the system prompt in
 * app/api/ai/secretary/route.ts) because it is the only party that knows
 * which it just wrote. Guessing from length was the alternative and it
 * is wrong in both directions: a roster breakdown is long, and "Sorry
 * for your loss, Brother" is short.
 *
 * Everything here tolerates the model getting the markers wrong. An
 * unclosed marker, or one with nothing in it, degrades to plain prose
 * rather than swallowing the reply.
 */

const OPEN = '<<<DRAFT>>>'
const CLOSE = '<<<END>>>'
const BLOCK = /<<<DRAFT>>>\r?\n?([\s\S]*?)\r?\n?<<<END>>>/

export type ParsedDraft = { subject: string; body: string }

/**
 * Remove stray markers so an unbalanced pair never reaches the screen,
 * and close the hole a lifted draft leaves behind — the text either side
 * of it brings its own blank lines, which would otherwise stack into a
 * gap wider than the commentary around it.
 */
function stripMarkers(text: string): string {
  return text
    .split(OPEN).join('')
    .split(CLOSE).join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * A draft's own first line may name its subject, which is exactly what
 * the Communications compose form wants and would otherwise have to be
 * invented from the body.
 */
function takeSubject(raw: string): ParsedDraft {
  const lines = raw.split('\n')
  const first = lines[0]?.trim() ?? ''
  const labelled = first.match(/^subject:\s*(.+)$/i)
  if (labelled) {
    return { subject: labelled[1].trim(), body: lines.slice(1).join('\n').trim() }
  }
  return { subject: '', body: raw.trim() }
}

/**
 * @returns `prose` — anything the model said around the draft, and
 *          `draft` — the document itself, or null when the reply was an
 *          answer rather than a draft.
 */
export function splitDraft(text: string): { prose: string; draft: ParsedDraft | null } {
  const match = text.match(BLOCK)
  if (!match || !match[1].trim()) return { prose: stripMarkers(text), draft: null }

  const before = text.slice(0, match.index)
  const after = text.slice((match.index ?? 0) + match[0].length)

  return {
    prose: stripMarkers(`${before}\n${after}`),
    draft: takeSubject(match[1]),
  }
}

/**
 * Where a draft waits while the browser navigates to Communications.
 *
 * sessionStorage rather than a query string: a set of minutes is
 * hundreds of words, and URLs have limits that vary by browser and
 * proxy — a draft silently truncated at 2,000 characters is worse than
 * no button at all. Session-scoped, so it does not outlive the tab.
 */
export const COMPOSE_HANDOFF_KEY = 'lodgeos:compose-handoff'

export function stageForCompose(draft: ParsedDraft): boolean {
  try {
    sessionStorage.setItem(COMPOSE_HANDOFF_KEY, JSON.stringify(draft))
    return true
  } catch {
    // Private browsing modes refuse storage outright. The caller falls
    // back to leaving the draft where it is; COPY still works.
    return false
  }
}

/** Reads and clears the staged draft — a handoff is used once. */
export function takeStagedCompose(): ParsedDraft | null {
  try {
    const raw = sessionStorage.getItem(COMPOSE_HANDOFF_KEY)
    if (!raw) return null
    sessionStorage.removeItem(COMPOSE_HANDOFF_KEY)
    const parsed = JSON.parse(raw)
    if (typeof parsed?.body !== 'string') return null
    return { subject: String(parsed.subject ?? ''), body: parsed.body }
  } catch {
    return null
  }
}
