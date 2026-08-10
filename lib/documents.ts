/**
 * Pure helpers for describing a document.
 *
 * THESE LIVE HERE BECAUSE OF A BOUNDARY RULE, not for tidiness.
 *
 * They used to be exported from components/lodge/DocumentUpload.tsx,
 * which begins with 'use client'. When a Server Component imports from
 * a client module, the bundler replaces every export with a client
 * REFERENCE — a marker saying "this lives in the browser". A component
 * reference can still be rendered, which is why DocumentPlayer and
 * DocumentDownloadLink worked fine. But a plain function reference
 * cannot be CALLED on the server; doing so throws
 *
 *   Attempted to call isPlayable() from the server but isPlayable is
 *   on the client.
 *
 * The lodge Documents page is a Server Component and calls both
 * isPlayable() and formatDuration() inside its row loop. So the page
 * threw — but only once the lodge had uploaded its first document,
 * because with an empty library the loop never ran and the calls never
 * happened. It looked like a page that broke by itself; it was a page
 * that had been waiting for a row.
 *
 * TypeScript cannot see this. The types are correct on both sides; the
 * rule is enforced at runtime by the bundler. Keeping the pure
 * functions in a module with no 'use client' is what makes them
 * genuinely shared — the same code, callable from either side.
 */

/** Whether this document can be played in the browser rather than downloaded. */
export const isPlayable = (mime?: string | null) =>
  !!mime && (mime.startsWith('video/') || mime.startsWith('audio/'))

/** "1:04:22" or "4:07". Null when there is no meaningful duration. */
export const formatDuration = (s?: number | null) => {
  if (!s || s < 1) return null
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

/** "512 KB" or "1.4 MB". Null for a missing or zero size. */
export const formatBytes = (b?: number | null) => {
  if (!b) return null
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}
