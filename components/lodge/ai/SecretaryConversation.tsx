'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSecretary } from './useSecretary'
import { formatReply, suggestionsFor } from './format'
import { splitDraft, stageForCompose, type ParsedDraft } from '@/lib/ai/draft'
import { stageForMinutes } from '@/lib/minutesHandoff'
import { SquareAndCompasses } from './Emblem'

/**
 * The conversation itself, shared by the docked panel and the full page.
 *
 * IT WAS A CHAT WINDOW BOLTED ONTO A LODGE APP. Grey bubbles, a generic
 * sparkle, sans-serif everywhere — the one screen in LodgeOS that looked
 * like it came from somewhere else. And bubbles are the wrong shape for
 * what this thing mostly produces: a set of minutes is a document, not a
 * text message, and putting it in a rounded speech balloon with a tail
 * tells the officer to read it as chatter.
 *
 * So: the officer's own questions are small right-aligned mono, the way
 * a marginal note reads. The replies are full-width serif on the paper
 * background, the way the rest of the app renders prose. And a DRAFT —
 * which the model marks for us — gets a bordered card with a gold rule,
 * its subject line, and its own actions along the foot. It looks like
 * the document it is, and it has a way out of the box it was written in.
 */

const GOLD = '#C9A84C'
const CREAM = '#F5F0E8'
const INK = '#E8E2D5'
const INK_SOFT = '#B8B0A0'
const PAPER = '#0A0E1A'
const RULE = 'rgba(201,168,76,0.18)'

const mono = 'JetBrains Mono, monospace'
const serif = 'Crimson Pro, serif'
const display = 'Cinzel, serif'

/** How close to the foot counts as "following along". */
const STICK_THRESHOLD = 90

function Actions({
  text,
  draft,
  canSendNotices,
  onSendAsNotice,
  onSaveAsMinutes,
}: {
  text: string
  draft: ParsedDraft | null
  canSendNotices: boolean
  onSendAsNotice: (draft: ParsedDraft) => void
  /** Present only when the draft reads as a set of minutes. */
  onSaveAsMinutes: ((draft: ParsedDraft) => void) | null
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused outright; saying nothing beats
      // an error the officer can do nothing about.
    }
  }

  const button = (label: string, onClick: () => void, accent = false) => (
    <button
      onClick={onClick}
      style={{
        background: accent ? 'rgba(201,168,76,0.12)' : 'none',
        border: `1px solid ${accent ? 'rgba(201,168,76,0.45)' : 'rgba(201,168,76,0.22)'}`,
        borderRadius: 3,
        color: GOLD,
        cursor: 'pointer',
        fontFamily: mono,
        fontSize: '0.56rem',
        letterSpacing: '0.14em',
        padding: '6px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button
        onClick={copy}
        style={{
          background: 'none',
          border: `1px solid ${copied ? 'rgba(93,190,133,0.5)' : 'rgba(201,168,76,0.22)'}`,
          borderRadius: 3,
          color: copied ? '#5DBE85' : GOLD,
          cursor: 'pointer',
          fontFamily: mono,
          fontSize: '0.56rem',
          letterSpacing: '0.14em',
          padding: '6px 10px',
          whiteSpace: 'nowrap',
        }}
      >
        {copied ? '✓ COPIED' : 'COPY'}
      </button>

      {/* Only offered to officers who may actually send one. The route
          checks the tier again regardless; this stops the interface
          advertising a door that opens onto a 403. */}
      {draft && canSendNotices && button('SEND AS NOTICE →', () => onSendAsNotice(draft), true)}

      {/* A set of minutes does not go out by email — it goes into the
          minute book, is read at the next meeting and approved there.
          Offering "send as notice" for it would be offering the wrong
          door. */}
      {draft && onSaveAsMinutes && button('SAVE TO MINUTE BOOK →', () => onSaveAsMinutes(draft), true)}
    </div>
  )
}

function DraftCard({
  draft,
  canSendNotices,
  onSendAsNotice,
  onSaveAsMinutes,
}: {
  draft: ParsedDraft
  canSendNotices: boolean
  onSendAsNotice: (d: ParsedDraft) => void
  onSaveAsMinutes: ((d: ParsedDraft) => void) | null
}) {
  return (
    <div
      style={{
        border: `1px solid ${RULE}`,
        background: 'rgba(201,168,76,0.03)',
        marginTop: 4,
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: '9px 14px',
          borderBottom: `1px solid ${RULE}`,
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '0.22em', color: GOLD }}>
          DRAFT
        </span>
        {draft.subject && (
          <span
            style={{
              fontFamily: display,
              fontSize: '0.8rem',
              color: CREAM,
              overflowWrap: 'anywhere',
              minWidth: 0,
            }}
          >
            {draft.subject}
          </span>
        )}
      </div>

      <div
        style={{
          padding: '14px',
          fontFamily: serif,
          fontSize: '0.95rem',
          lineHeight: 1.7,
          color: INK,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          minWidth: 0,
        }}
        dangerouslySetInnerHTML={{ __html: formatReply(draft.body) }}
      />

      <div style={{ padding: '10px 14px', borderTop: `1px solid ${RULE}` }}>
        <Actions
          text={draft.subject ? `${draft.subject}\n\n${draft.body}` : draft.body}
          draft={draft}
          canSendNotices={canSendNotices}
          onSendAsNotice={onSendAsNotice}
          onSaveAsMinutes={onSaveAsMinutes}
        />
      </div>
    </div>
  )
}

export function SecretaryConversation({
  tenantId,
  slug,
  canSendNotices,
  onClose,
  onNavigate,
}: {
  tenantId: string
  slug: string
  canSendNotices: boolean
  /** Present in the docked panel, absent on the full page. */
  onClose?: () => void
  /** Lets the panel close itself before the browser leaves the page. */
  onNavigate?: () => void
}) {
  const { messages, live, statuses, loading, error, send, stop, clear } = useSecretary(tenantId)
  const [input, setInput] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  const logRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const suggestions = useMemo(() => suggestionsFor(pathname ?? ''), [pathname])

  /**
   * Follow the stream, but stop following the moment the officer scrolls
   * up — he is reading something further back, and yanking him to the
   * foot on every token would make a long draft impossible to read while
   * it is being written.
   */
  const onScroll = useCallback(() => {
    const el = logRef.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
  }, [])

  useEffect(() => {
    if (!stick.current) return
    const el = logRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: live ? 'auto' : 'smooth' })
  }, [messages, live, statuses, loading])

  const submit = (text: string) => {
    stick.current = true
    setInput('')
    send(text)
  }

  /**
   * The draft leaves the box.
   *
   * Up to here the assistant deliberately stopped at the draft, which is
   * right — nothing it writes should go to the lodge without a human
   * putting his name to it. But "right" was being paid for by the
   * officer: select four hundred words inside a scrolling panel on a
   * phone, navigate to Communications, paste. This carries it there and
   * leaves him in front of the compose form with his finger over Send,
   * which keeps the human decision exactly where it was.
   */
  const sendAsNotice = (draft: ParsedDraft) => {
    stageForCompose(draft)
    onNavigate?.()
    router.push(`/lodge/${slug}/communications`)
  }

  /**
   * Minutes go to the minute book, not into an email.
   *
   * The model marks a draft but does not say what KIND of draft it is,
   * and asking it to would be another instruction to get wrong. The
   * subject line and the opening of a set of minutes are unmistakable
   * in a way a condolence letter's are not — "the lodge was opened",
   * "minutes of the stated communication" — so the test is on the text
   * rather than on a promise from the model. A false negative costs a
   * copy and paste; a false positive shows one extra button.
   */
  const looksLikeMinutes = (draft: ParsedDraft): boolean => {
    const head = `${draft.subject}\n${draft.body.slice(0, 400)}`.toLowerCase()
    return (
      head.includes('minutes of') ||
      head.includes('opened in due form') ||
      head.includes('was opened in') ||
      /\bminutes\b/.test(draft.subject.toLowerCase())
    )
  }

  /**
   * Carried in sessionStorage for the same reason as the Communications
   * handoff: a set of minutes is hundreds of words and URL length
   * limits vary by browser and proxy.
   *
   * Lands on the minute book rather than on one meeting's editor,
   * because the assistant may have drafted from the most recent meeting
   * without either of us naming which — the officer picks the meeting
   * there, where they are listed with their dates.
   */
  const saveAsMinutes = (draft: ParsedDraft) => {
    stageForMinutes(draft.body)
    onNavigate?.()
    router.push(`/lodge/${slug}/minutes`)
  }

  const composerDisabled = loading || !input.trim()

  return (
    <>
      <div className="lodgeos-ai-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ color: GOLD }}>
            <SquareAndCompasses size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '0.24em', color: GOLD }}>
              AI SECRETARY
            </div>
            <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: '0.78rem', color: INK_SOFT }}>
              Reads live lodge data · drafts, doesn&apos;t send
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {messages.length > 0 && (
            <button
              onClick={clear}
              title="Start a new conversation"
              style={{
                background: 'none',
                border: 'none',
                color: INK_SOFT,
                cursor: 'pointer',
                fontFamily: mono,
                fontSize: '0.55rem',
                letterSpacing: '0.14em',
                padding: '10px 8px',
              }}
            >
              NEW
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                color: INK_SOFT,
                cursor: 'pointer',
                // A real touch target. The old 1.1rem × was a hard thing
                // to hit with a thumb, on the one control that gets you
                // out.
                fontSize: '1.4rem',
                lineHeight: 1,
                padding: '10px 14px',
                margin: '-10px -8px -10px -14px',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div ref={logRef} className="lodgeos-ai-log" onScroll={onScroll}>
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ color: INK_SOFT, fontSize: '0.9rem', fontFamily: serif, fontStyle: 'italic', margin: '0 0 4px' }}>
              Ask about dues, attendance, a particular brother, events or petitions — or paste rough
              notes to draft into minutes.
            </p>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                style={{
                  textAlign: 'left',
                  background: 'transparent',
                  border: `1px solid ${RULE}`,
                  color: GOLD,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontFamily: serif,
                  fontSize: '0.88rem',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === 'user') {
            // A QUESTION AND A PASTE ARE NOT THE SAME OBJECT. Right-
            // aligned mono reads like a note in the margin, which is
            // exactly right for "who owes dues?" and unreadable for the
            // four hundred words of rough meeting notes that are the
            // other main thing typed into this box: every line ends
            // flush right and starts somewhere different.
            const long = m.content.length > 140
            return (
              <div
                key={i}
                style={{
                  alignSelf: long ? 'stretch' : 'flex-end',
                  maxWidth: long ? '100%' : '88%',
                  textAlign: long ? 'left' : 'right',
                  fontFamily: mono,
                  fontSize: '0.68rem',
                  lineHeight: 1.6,
                  letterSpacing: '0.02em',
                  color: GOLD,
                  borderRight: long ? 'none' : `2px solid ${RULE}`,
                  borderLeft: long ? `2px solid ${RULE}` : 'none',
                  paddingRight: long ? 0 : 10,
                  paddingLeft: long ? 10 : 0,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  minWidth: 0,
                }}
              >
                {m.content}
              </div>
            )
          }

          const { prose, draft } = splitDraft(m.content)

          return (
            <div
              key={i}
              style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}
            >
              {prose && (
                <div
                  style={{
                    fontFamily: serif,
                    fontSize: '0.95rem',
                    lineHeight: 1.7,
                    color: INK,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    minWidth: 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: formatReply(prose) }}
                />
              )}

              {draft ? (
                <DraftCard
                  draft={draft}
                  canSendNotices={canSendNotices}
                  onSendAsNotice={sendAsNotice}
                  onSaveAsMinutes={looksLikeMinutes(draft) ? saveAsMinutes : null}
                />
              ) : (
                prose && (
                  <Actions
                    text={prose}
                    draft={null}
                    canSendNotices={canSendNotices}
                    onSendAsNotice={sendAsNotice}
                    onSaveAsMinutes={null}
                  />
                )
              )}
            </div>
          )
        })}

        {/* The answer as it is written. Same type as a finished reply, so
            nothing shifts when it lands. */}
        {live && (
          <div
            style={{
              alignSelf: 'stretch',
              fontFamily: serif,
              fontSize: '0.95rem',
              lineHeight: 1.7,
              color: INK,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              minWidth: 0,
            }}
          >
            <span dangerouslySetInnerHTML={{ __html: formatReply(live) }} />
            <span className="lodgeos-ai-caret" aria-hidden="true" />
          </div>
        )}

        {loading && !live && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(statuses.length ? statuses : ['Thinking']).map((s, i) => (
              <div
                key={`${s}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: INK_SOFT,
                  fontFamily: mono,
                  fontSize: '0.6rem',
                  letterSpacing: '0.1em',
                }}
              >
                <span className="lodgeos-ai-pulse" aria-hidden="true" />
                {s}…
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            style={{
              alignSelf: 'stretch',
              color: '#EC5B4B',
              fontSize: '0.75rem',
              fontFamily: mono,
              background: 'rgba(231,76,60,0.08)',
              border: '1px solid rgba(231,76,60,0.2)',
              padding: '8px 12px',
              overflowWrap: 'anywhere',
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div className="lodgeos-ai-compose">
        <textarea
          className="lodgeos-ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a real keyboard. On a touch keyboard Enter
            // IS the newline key, and sending there would make a second
            // paragraph of meeting notes impossible to type — which is
            // the longest thing anyone puts in this box.
            const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
            if (e.key === 'Enter' && !e.shiftKey && !touch) {
              e.preventDefault()
              submit(input)
            }
          }}
          placeholder="Ask, or paste notes…"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            background: PAPER,
            border: `1px solid ${RULE}`,
            color: CREAM,
            padding: '10px 12px',
            fontFamily: serif,
            outline: 'none',
            maxHeight: '160px',
            minWidth: 0,
          }}
        />

        {/* One button, two jobs. A separate Stop beside Ask would sit
            disabled and pointless for the whole time it is not needed,
            and the officer's hand is already here. */}
        {loading ? (
          <button
            onClick={stop}
            style={{
              background: 'transparent',
              color: GOLD,
              border: `1px solid rgba(201,168,76,0.45)`,
              padding: '0 16px',
              cursor: 'pointer',
              fontFamily: display,
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={() => submit(input)}
            disabled={composerDisabled}
            style={{
              background: GOLD,
              color: PAPER,
              border: 'none',
              padding: '0 18px',
              cursor: composerDisabled ? 'not-allowed' : 'pointer',
              fontFamily: display,
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              opacity: composerDisabled ? 0.45 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            Ask
          </button>
        )}
      </div>
    </>
  )
}
