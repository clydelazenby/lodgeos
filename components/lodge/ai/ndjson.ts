/**
 * Reads a newline-delimited JSON stream.
 *
 * The subtlety worth having in one tested place: a network chunk has
 * nothing to do with a line. One read can deliver three whole events, or
 * half of one — a 3KB draft arrives in pieces cut wherever TCP felt like
 * cutting them, and a naive split on '\n' per chunk drops the fragment
 * at the tail of every read. That shows up as a reply missing a word
 * here and there, which is far worse than an obvious failure.
 *
 * So the tail after the last newline is carried into the next read, and
 * a line that will not parse is skipped rather than thrown — a truncated
 * final line at an aborted stream should not lose the eight good events
 * that preceded it.
 */
export async function readNdjson(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: any) => void
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let carry = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    carry += decoder.decode(value, { stream: true })
    const lines = carry.split('\n')
    carry = lines.pop() ?? ''

    for (const raw of lines) {
      const trimmed = raw.trim()
      if (!trimmed) continue
      try {
        onEvent(JSON.parse(trimmed))
      } catch {
        // Not a complete object. Nothing useful to do but move on.
      }
    }
  }

  // A final line with no trailing newline is still a real event.
  const tail = (carry + decoder.decode()).trim()
  if (tail) {
    try {
      onEvent(JSON.parse(tail))
    } catch {
      /* ignore */
    }
  }
}
