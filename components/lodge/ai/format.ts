/**
 * Renders the assistant's reply.
 *
 * The model answers in markdown — bold, bullets, numbered lists — and
 * this was printing it raw, so a drafted set of minutes arrived full of
 * literal asterisks and hyphens. Deliberately a tiny formatter rather
 * than a markdown library: bold, italic, inline code and lists cover
 * everything these replies actually use, and a parser for the rest is
 * weight in a bundle for no gain.
 *
 * ESCAPING HAPPENS FIRST, before any markup is added, so nothing in a
 * reply — or in the lodge data quoted inside it — can become HTML.
 */
export function formatReply(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:JetBrains Mono,monospace;font-size:0.92em;">$1</code>')
    .split('\n')
    .map((line) => {
      const bullet = line.match(/^\s*[-•]\s+(.*)$/)
      if (bullet) return `<span style="display:block;padding-left:1em;text-indent:-1em;">•&nbsp;${bullet[1]}</span>`
      const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/)
      if (numbered) return `<span style="display:block;padding-left:1.4em;text-indent:-1.4em;">${numbered[1]}.&nbsp;${numbered[2]}</span>`
      return line
    })
    .join('\n')
}

/**
 * Openers that fit the page the officer is standing on.
 *
 * The four generic prompts were read once, on the first open, and never
 * again — by the second session they were furniture. A suggestion is
 * only worth its space if it is the thing you were about to type, and
 * what you were about to type depends almost entirely on where you are:
 * nobody standing on the Dues ledger wants to be offered "draft minutes".
 *
 * Matched on a substring of the path rather than a parsed route, because
 * both /members and /members/[id] want the same offers.
 */
const GENERAL = [
  'Who currently owes dues?',
  'How has attendance been lately?',
  'Any candidates need a mentor check-in?',
  'Draft minutes from my notes below.',
]

export function suggestionsFor(pathname: string): string[] {
  const at = (segment: string) => pathname.includes(`/${segment}`)

  if (at('dues')) {
    return [
      'Who currently owes dues?',
      'Draft a dues reminder for the brothers in arrears.',
      'How much is outstanding in total?',
    ]
  }
  if (at('events') || at('meeting')) {
    return [
      "What's on the calendar?",
      'Draft an announcement for the next stated communication.',
      'Who was at the last meeting?',
    ]
  }
  if (at('attendance') || at('analytics') || at('reports')) {
    return [
      'How has attendance been over the last six meetings?',
      'Which brothers have stopped coming?',
      'Draft a note to the brethren we have not seen lately.',
    ]
  }
  if (at('members') || at('bench')) {
    return [
      'Summarise the roster for me.',
      'Tell me about Bro. — (add a surname)',
      'Which stations are unfilled?',
    ]
  }
  if (at('petitions')) {
    return [
      'What petitions are pending?',
      'Draft a letter acknowledging a petition.',
      'How long has each been waiting?',
    ]
  }
  if (at('degrees')) {
    return [
      'Which candidates have stalled?',
      'Draft a mentor check-in note for a candidate.',
      'Who is due for proficiency?',
    ]
  }
  if (at('care')) {
    return [
      'Draft a condolence letter for a brother’s family.',
      'Draft a get-well note to a brother in hospital.',
      'Who has not been seen in months?',
    ]
  }
  if (at('communications')) {
    return [
      'Draft a notice about the next stated communication.',
      'Draft a dues reminder.',
      'Who currently owes dues?',
    ]
  }
  return GENERAL
}
