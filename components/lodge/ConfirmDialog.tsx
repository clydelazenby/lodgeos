'use client'

import { useEffect, useRef, useState } from 'react'
import { T } from '@/lib/designTokens'

/**
 * Destructive-action confirmation.
 *
 * Uses a real modal rather than window.confirm() for two reasons: the
 * native dialog can't explain consequences (which matters here, because
 * "remove from roster" keeps history and people reasonably assume
 * otherwise), and it can't be styled to look like the rest of the app.
 *
 * `requireTyping` demands the exact name be typed before the confirm
 * button enables. Reserved for actions with no undo — deleting a
 * document destroys the stored file.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  requireTyping,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: React.ReactNode
  confirmLabel: string
  requireTyping?: string
  busy?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTyped('')
      // Focus after paint so the field is ready without the user
      // reaching for the mouse.
      const id = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(id)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  /**
   * FORGIVING ABOUT THE TYPING, STRICT ABOUT THE INTENT.
   *
   * This was an exact, case-sensitive, whitespace-sensitive comparison
   * — so "Bylaws 2024.pdf" typed as "bylaws 2024.pdf", or with a double
   * space the file name happens to contain, left the button quietly
   * disabled. Clicking it then did NOTHING AT ALL, with no hint why,
   * which reads as a broken button rather than an unmet condition. It
   * was reported as exactly that.
   *
   * The point of the gate is to make a destructive act deliberate, and
   * typing the name in any case with any spacing is deliberate. What it
   * must not accept is an empty box or a stray keypress, and it does
   * not.
   */
  const normalise = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase()
  const ready = !requireTyping || normalise(typed) === normalise(requireTyping)
  const started = typed.trim().length > 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: '1rem',
      }}
      onClick={() => { if (!busy) onCancel() }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="lodgeos-dialog-in"
        style={{
          background: T.bgCard,
          border: '1px solid rgba(231,76,60,0.35)',
          borderRadius: 8,
          padding: '1.75rem',
          width: '100%',
          maxWidth: 460,
        }}
      >
        <h2
          style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '1.1rem',
            color: T.ink,
            marginBottom: '0.9rem',
          }}
        >
          {title}
        </h2>

        <div
          style={{
            fontFamily: 'Crimson Pro, serif',
            fontSize: '1rem',
            color: T.inkFaint,
            lineHeight: 1.7,
            marginBottom: requireTyping ? '1.25rem' : '1.75rem',
          }}
        >
          {body}
        </div>

        {requireTyping && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.58rem',
                letterSpacing: '0.15em',
                color: T.gold,
                textTransform: 'uppercase',
                marginBottom: 6,
                display: 'block',
              }}
            >
              Type “{requireTyping}” to confirm
            </label>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              // Enter finishes it, the way any other confirmation field
              // would. Only once it matches, so the key cannot commit a
              // destruction the box does not yet agree to.
              onKeyDown={(e) => { if (e.key === 'Enter' && ready && !busy) onConfirm() }}
              style={{
                width: '100%',
                background: T.bg,
                border: `1px solid ${ready ? 'rgba(93,190,133,0.5)' : started ? 'rgba(231,76,60,0.4)' : T.goldBorder}`,
                color: T.ink,
                padding: '10px 13px',
                fontFamily: 'Crimson Pro, serif',
                fontSize: '16px',
                outline: 'none',
                borderRadius: 4,
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
            />
            {/* SAYS WHY THE BUTTON IS STILL GREY. A disabled control
                with no explanation is the thing that gets reported as
                "I pressed it and nothing happened". */}
            <div
              aria-live="polite"
              style={{
                fontFamily: 'Crimson Pro, serif', fontSize: '0.84rem', marginTop: 6,
                color: ready ? T.success : started ? T.danger : T.inkFainter,
                minHeight: '1.2em',
              }}
            >
              {ready
                ? '✓ That matches — the button below is ready.'
                : started
                  ? 'That does not match yet. Capitals and extra spaces do not matter.'
                  : ''}
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              background: T.dangerDim,
              border: '1px solid rgba(231,76,60,0.3)',
              color: T.danger,
              padding: '10px 14px',
              borderRadius: 4,
              marginBottom: '1.25rem',
              fontFamily: 'Crimson Pro, serif',
              fontSize: '0.92rem',
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'transparent',
              border: `1px solid ${T.goldBorder}`,
              color: T.inkFaint,
              padding: '11px 20px',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || !ready}
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 700,
              background: busy || !ready ? 'rgba(231,76,60,0.25)' : T.danger,
              border: `1px solid ${T.danger}`,
              color: busy || !ready ? T.inkFaint : '#fff',
              padding: '11px 20px',
              borderRadius: 4,
              cursor: busy || !ready ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
