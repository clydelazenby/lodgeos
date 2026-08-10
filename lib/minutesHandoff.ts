/**
 * Carrying a drafted set of minutes from the AI Secretary into the
 * minute book.
 *
 * The same shape as the Communications handoff in lib/ai/draft.ts, and
 * for the same reason: a set of minutes is hundreds of words, and URLs
 * have length limits that vary by browser and proxy. A draft silently
 * truncated at 2,000 characters is worse than no button at all.
 *
 * Session-scoped and read once, so it does not outlive the tab or
 * reappear the next time the editor is opened.
 */

export const MINUTES_HANDOFF_KEY = 'lodgeos:minutes-handoff'

export function stageForMinutes(body: string): boolean {
  try {
    sessionStorage.setItem(MINUTES_HANDOFF_KEY, body)
    return true
  } catch {
    return false
  }
}

/**
 * Reads WITHOUT clearing.
 *
 * The assistant hands its draft to the minute book rather than to one
 * meeting's editor, because neither it nor the officer has necessarily
 * named which meeting yet. So the book has to be able to see that a
 * draft is waiting and say so, while leaving it in place for the editor
 * the officer then opens — which is the one that consumes it.
 */
export function peekStagedMinutes(): string | null {
  try {
    return sessionStorage.getItem(MINUTES_HANDOFF_KEY)
  } catch {
    return null
  }
}

export function discardStagedMinutes(): void {
  try {
    sessionStorage.removeItem(MINUTES_HANDOFF_KEY)
  } catch {
    /* nothing to do */
  }
}

export function takeStagedMinutes(): string | null {
  try {
    const raw = sessionStorage.getItem(MINUTES_HANDOFF_KEY)
    if (!raw) return null
    sessionStorage.removeItem(MINUTES_HANDOFF_KEY)
    return raw
  } catch {
    return null
  }
}
