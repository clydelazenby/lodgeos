/**
 * Calling our own API from the browser, and failing usefully.
 *
 * WHY THIS EXISTS. An officer tapped "Start from the standard outline"
 * and got a red box reading "Load failed". That is Safari's wording for
 * a fetch that never completed, passed straight through to the screen
 * because every action helper in the app did `setError(e.message)`.
 *
 * It is the wrong message in two ways. It does not say what happened,
 * and it does not say what to do — the officer has no idea whether he
 * broke something, whether the lodge's data is now half-written, or
 * whether tapping again is safe. Meanwhile the actual cause was almost
 * certainly a deployment swapping under him, which is both harmless and
 * over in seconds.
 *
 * THE RETRY IS THE REAL FIX. These officers use the app standing in a
 * lodge building, frequently on one bar of signal. A request that dies
 * at the network layer — no response, no status — has by definition not
 * been processed, so retrying it once is safe in a way that retrying a
 * 500 is not. One retry turns the most common transient failure into
 * nothing at all.
 *
 * Only network-level failures are retried. A 4xx or 5xx means the
 * server DID answer, the request may well have taken effect, and
 * repeating it could double-charge a brother or duplicate a plan.
 */

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const NETWORK_FAILURE =
  'Could not reach the lodge server. This is usually a moment of bad signal, or the app updating. Nothing was saved — try again.'

/** A fetch that never got a response, as each browser words it. */
function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false
  const m = error.message.toLowerCase()
  return (
    m.includes('load failed') ||       // Safari
    m.includes('failed to fetch') ||   // Chrome
    m.includes('networkerror') ||      // Firefox
    m.includes('network request failed')
  )
}

async function once(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init)
}

/**
 * POST/PATCH/PUT/DELETE JSON to our own API and get the parsed body.
 *
 * Throws ApiError with the server's own message on a 4xx/5xx, and a
 * plain Error with a human sentence when the request never landed.
 */
export async function callApi<T = any>(
  url: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  }

  let res: Response
  try {
    res = await once(url, init)
  } catch (error) {
    // Deliberately not retried: the caller cancelled on purpose.
    if ((error as any)?.name === 'AbortError') throw error
    if (!isNetworkFailure(error)) throw error

    // One retry, after a beat. Long enough for a deployment swap or a
    // dropped packet, short enough that the officer is still looking at
    // the screen.
    await new Promise((r) => setTimeout(r, 700))
    try {
      res = await once(url, init)
    } catch (retryError) {
      if ((retryError as any)?.name === 'AbortError') throw retryError
      throw new Error(NETWORK_FAILURE)
    }
  }

  /**
   * A 500 that renders as an HTML error page — which is what a crashed
   * function returns — would make res.json() throw a parse error, and
   * the officer would see "Unexpected token <" instead of anything
   * useful. Read as text and only then attempt JSON.
   */
  const raw = await res.text()
  let data: any = null
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    throw new ApiError(
      data?.error ||
        (res.status >= 500
          ? 'The lodge server hit an error. Nothing was saved.'
          : `That was refused (${res.status}).`),
      res.status
    )
  }

  return (data ?? {}) as T
}

/** The sentence to show a user for any error thrown by callApi. */
export function errorMessage(error: unknown, fallback = 'That did not work.'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
