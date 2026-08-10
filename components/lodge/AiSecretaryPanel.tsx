'use client'
import { useState, useRef, useEffect } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

/**
 * How far the officer must scroll down before the launcher gets out of
 * the way. Small enough to react, large enough that a stray pixel of
 * momentum does not make it flicker.
 */
const HIDE_AFTER_SCROLL = 24

const SUGGESTIONS = [
  'Who currently owes dues?',
  'How has attendance been lately?',
  'Any candidates need a mentor check-in?',
  'Draft minutes from my notes below.',
]

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
function formatReply(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:JetBrains Mono,monospace;font-size:0.92em;">$1</code>')
    .split('\n')
    .map(line => {
      const bullet = line.match(/^\s*[-•]\s+(.*)$/)
      if (bullet) return `<span style="display:block;padding-left:1em;text-indent:-1em;">•&nbsp;${bullet[1]}</span>`
      const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/)
      if (numbered) return `<span style="display:block;padding-left:1.4em;text-indent:-1.4em;">${numbered[1]}.&nbsp;${numbered[2]}</span>`
      return line
    })
    .join('\n')
}

export function AiSecretaryPanel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [rawConversation, setRawConversation] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastY = useRef(0)

  /**
   * THE LAUNCHER GETS OUT OF THE WAY WHILE READING.
   *
   * It is fixed to the bottom-right, so it sits on top of whatever
   * happens to be under it — the Stations Filled count on the Lodge
   * Room, a row of the Sent Communications table. Padding at the foot
   * of the page only helps at the very bottom; scrolling past anything
   * else still puts a gold pill over it.
   *
   * So: scrolling DOWN (reading) tucks it away, scrolling UP or
   * stopping brings it back.
   */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const goingDown = y > lastY.current
      if (Math.abs(y - lastY.current) > 4) {
        setHidden(goingDown && y > HIDE_AFTER_SCROLL)
        lastY.current = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /**
   * On a phone the panel is a full-screen sheet, and the page behind it
   * must stop scrolling — otherwise a swipe meant for the conversation
   * drags the lodge dashboard around underneath, which is a large part
   * of why the whole thing felt broken. Desktop keeps its docked card
   * and its scrollable page.
   */
  useEffect(() => {
    if (!open) return
    if (!window.matchMedia('(max-width: 640px)').matches) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    setError('')
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    const nextConversation = [...rawConversation, { role: 'user', content: text }]

    try {
      const res = await fetch('/api/ai/secretary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, messages: nextConversation }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'The AI Secretary hit an error.')

      setMessages(prev => [...prev, { role: 'assistant', content: result.reply }])
      setRawConversation(result.conversation)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * The whole point of a draft is to move it somewhere else — into a
   * notice, into the minute book. Without this the officer had to
   * select 400 words of text inside a scrolling box on a phone.
   */
  const copy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(index)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard access can be refused outright; saying nothing beats
      // an error the officer can do nothing about.
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="lodgeos-ai-launcher"
        aria-label="Ask the Secretary"
        style={{
          position: 'fixed', bottom: '20px', right: '16px', zIndex: 50,
          background: '#C9A84C', color: '#0A0E1A', border: 'none',
          padding: '12px 20px', borderRadius: '999px', cursor: 'pointer',
          fontFamily: 'Cinzel, serif', fontSize: '0.8rem', fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '8px',
          // Tucked away while reading, not removed: a display:none
          // button cannot be tabbed back to, and the transform keeps it
          // reachable by keyboard throughout.
          transform: hidden ? 'translateY(120%)' : 'translateY(0)',
          opacity: hidden ? 0 : 1,
          transition: 'transform 0.22s ease, opacity 0.22s ease',
        }}
      >
        <span aria-hidden="true">✦</span>
        <span className="lodgeos-ai-launcher-label">Ask the Secretary</span>
      </button>
    )
  }

  return (
    <div className="lodgeos-ai-panel" role="dialog" aria-label="AI Secretary">
      <div className="lodgeos-ai-head">
        <div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: '#C9A84C' }}>AI Secretary</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
            Reads live lodge data · drafts, doesn&apos;t send
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{
            background: 'none', border: 'none', color: '#B8B0A0', cursor: 'pointer',
            // A real touch target. The old 1.1rem × was a hard thing to
            // hit with a thumb, on the one control that gets you out.
            fontSize: '1.4rem', lineHeight: 1, padding: '10px 14px', margin: '-10px -14px',
          }}
        >×</button>
      </div>

      <div ref={scrollRef} className="lodgeos-ai-log">
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ color: '#B8B0A0', fontSize: '0.85rem', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', marginBottom: '4px' }}>
              Ask about dues, attendance, a particular brother, events or petitions — or paste rough notes to draft into minutes.
            </p>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} style={{
                textAlign: 'left', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
                color: '#C9A84C', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
              }}>{s}</button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'stretch',
              // A draft of minutes is a document, not a chat bubble. The
              // assistant's replies run the full width so long text is
              // readable; only the officer's own lines are bubbled.
              maxWidth: m.role === 'user' ? '85%' : '100%',
              background: m.role === 'user' ? 'rgba(201,168,76,0.15)' : '#0A0E1A',
              border: `1px solid ${m.role === 'user' ? 'rgba(201,168,76,0.3)' : 'rgba(184,176,160,0.15)'}`,
              color: '#F5F0E8', padding: '11px 13px', borderRadius: '8px',
              fontSize: '0.88rem', lineHeight: 1.6, fontFamily: 'Crimson Pro, serif',
              whiteSpace: 'pre-wrap',
              // Without these a pasted URL or a long unbroken token in a
              // draft pushes the panel wider than the screen, and the
              // whole page scrolls sideways.
              overflowWrap: 'anywhere', wordBreak: 'break-word', minWidth: 0,
            }}
          >
            {m.role === 'assistant'
              ? <span dangerouslySetInnerHTML={{ __html: formatReply(m.content) }} />
              : m.content}

            {m.role === 'assistant' && (
              <button
                onClick={() => copy(m.content, i)}
                style={{
                  display: 'block', marginTop: 10, background: 'none',
                  border: '1px solid rgba(201,168,76,0.25)', borderRadius: 4,
                  color: copied === i ? '#5DBE85' : '#C9A84C', cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
                  letterSpacing: '0.1em', padding: '6px 10px',
                }}
              >
                {copied === i ? '✓ COPIED' : 'COPY'}
              </button>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ alignSelf: 'flex-start', color: '#B8B0A0', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>
            {/* "Checking the roster" was shown even when drafting a
                condolence letter, which touches no roster at all. */}
            Working…
          </div>
        )}
        {error && (
          <div style={{ alignSelf: 'flex-start', color: '#EC5B4B', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', padding: '8px 12px', borderRadius: '6px', overflowWrap: 'anywhere' }}>
            {error}
          </div>
        )}
      </div>

      <div className="lodgeos-ai-compose">
        <textarea
          className="lodgeos-ai-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            // Enter sends on a real keyboard. On a touch keyboard Enter
            // IS the newline key, and sending there would make a second
            // paragraph of meeting notes impossible to type — which is
            // the longest thing anyone puts in this box.
            const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
            if (e.key === 'Enter' && !e.shiftKey && !touch) {
              e.preventDefault()
              send(input)
            }
          }}
          placeholder="Ask, or paste notes…"
          rows={1}
          style={{
            flex: 1, resize: 'none', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)',
            color: '#F5F0E8', padding: '10px 12px', borderRadius: '6px', fontFamily: 'Crimson Pro, serif',
            outline: 'none', maxHeight: '120px', minWidth: 0,
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{
            background: '#C9A84C', color: '#0A0E1A', border: 'none', padding: '0 18px', borderRadius: '6px',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontFamily: 'Cinzel, serif',
            fontSize: '0.75rem', fontWeight: 700, opacity: loading || !input.trim() ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >Ask</button>
      </div>
    </div>
  )
}
