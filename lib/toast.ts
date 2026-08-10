/**
 * App-wide save/error notifications.
 *
 * WHY AN EVENT BUS RATHER THAN REACT CONTEXT
 *
 * Feedback is needed from roughly twenty places: page components,
 * shared controls like DuesRateEditor and ProficiencyControl, and
 * inline table edits that save on change. Threading a context provider
 * to all of them would mean converting server-component layouts into
 * client wrappers and adding a hook call to every caller.
 *
 * A module-level event bus is callable from anywhere — including
 * outside React — with no provider, no prop drilling and no re-render
 * cost for components that never notify. One <Toaster/> mounted per
 * layout listens.
 *
 * SSR-safe: dispatch is a no-op when `window` is undefined, so a
 * server component importing something that calls notify() will not
 * crash the render.
 */

export type ToastTone = 'success' | 'error' | 'info'

export type ToastPayload = {
  id: string
  tone: ToastTone
  message: string
}

const EVENT = 'lodgeos:toast'

function dispatch(tone: ToastTone, message: string) {
  if (typeof window === 'undefined') return
  const detail: ToastPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tone,
    message,
  }
  window.dispatchEvent(new CustomEvent<ToastPayload>(EVENT, { detail }))
}

export const notify = {
  /** Something was written successfully. */
  saved: (message = 'Saved') => dispatch('success', message),
  /** A write failed. Pass the server's own wording where there is one —
   *  "could not save" tells the officer nothing actionable. */
  error: (message = 'Could not save') => dispatch('error', message),
  info: (message: string) => dispatch('info', message),
}

export function onToast(handler: (t: ToastPayload) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => handler((e as CustomEvent<ToastPayload>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
