'use client'

import { useEffect, useState } from 'react'
import { onToast, type ToastPayload } from '@/lib/toast'
import { T } from '@/lib/designTokens'

/**
 * Renders save/error notifications from lib/toast.
 *
 * Mounted once per authenticated layout. Success messages clear
 * themselves after a few seconds; ERRORS DO NOT — a failed save is
 * something the officer has to act on, and a message that disappears
 * before it is read is worse than none. Errors are dismissed by tapping.
 *
 * Positioned bottom-centre rather than top-right: on a phone the top
 * corners are where the browser chrome and the app's own sticky header
 * live, and a toast there is easy to miss or awkward to reach.
 */

const TONE = {
  success: { bg: 'rgba(93,190,133,0.15)', border: 'rgba(93,190,133,0.45)', text: T.success, mark: '✓' },
  error: { bg: 'rgba(236,91,75,0.15)', border: 'rgba(236,91,75,0.5)', text: T.danger, mark: '✕' },
  info: { bg: 'rgba(123,184,212,0.15)', border: 'rgba(123,184,212,0.45)', text: T.info, mark: 'i' },
} as const

export function Toaster() {
  const [toasts, setToasts] = useState<ToastPayload[]>([])

  useEffect(() => {
    return onToast((t) => {
      setToasts((prev) => {
        // A page that saves several fields at once shouldn't stack five
        // identical "Saved" cards.
        const deduped = prev.filter((p) => !(p.tone === t.tone && p.message === t.message))
        return [...deduped, t].slice(-3)
      })

      if (t.tone !== 'error') {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((p) => p.id !== t.id))
        }, 3200)
      }
    })
  }, [])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((p) => p.id !== id))

  if (toasts.length === 0) return null

  return (
    <div
      // polite, not assertive: a save confirmation should not interrupt
      // a screen reader mid-sentence.
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 'calc(100% - 2rem)',
        maxWidth: 420,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const tone = TONE[t.tone]
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              width: '100%',
              textAlign: 'left',
              background: T.bgCard,
              backgroundImage: `linear-gradient(${tone.bg}, ${tone.bg})`,
              border: `1px solid ${tone.border}`,
              borderRadius: 8,
              padding: '12px 14px',
              cursor: 'pointer',
              boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
              animation: 'lodgeosToastIn 0.22s ease both',
            }}
          >
            <span style={{ color: tone.text, fontFamily: T.mono, fontSize: '0.8rem', lineHeight: 1.5, flexShrink: 0 }}>
              {tone.mark}
            </span>
            <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: T.ink, lineHeight: 1.5, flex: 1 }}>
              {t.message}
            </span>
            {t.tone === 'error' && (
              <span style={{ fontFamily: T.mono, fontSize: '0.55rem', color: T.inkFaint, letterSpacing: '0.1em', flexShrink: 0 }}>
                TAP TO DISMISS
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
