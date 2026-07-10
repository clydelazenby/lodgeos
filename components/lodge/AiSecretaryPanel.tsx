'use client'
import { useState, useRef, useEffect } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Who currently owes dues?',
  'Any candidates need a mentor check-in?',
  "Draft minutes from my notes below.",
  "Draft a condolence letter for a brother's passing.",
]

export function AiSecretaryPanel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [rawConversation, setRawConversation] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: '20px', right: '16px', zIndex: 50,
          background: '#C9A84C', color: '#0A0E1A', border: 'none',
          padding: '12px 20px', borderRadius: '999px', cursor: 'pointer',
          fontFamily: 'Cinzel, serif', fontSize: '0.8rem', fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        ✦ Ask the Secretary
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: '16px', right: '16px', zIndex: 50,
      width: '380px', maxWidth: 'calc(100vw - 32px)',
      height: '560px', maxHeight: 'calc(100vh - 32px)',
      background: '#141C2E', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '10px',
      display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(201,168,76,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: '#C9A84C' }}>AI Secretary</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>Reads live lodge data · drafts, doesn't send</div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#B8B0A0', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ color: '#B8B0A0', fontSize: '0.8rem', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', marginBottom: '4px' }}>
              Ask about dues, candidates, events, or petitions — or paste rough notes to draft into minutes.
            </p>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} style={{
                textAlign: 'left', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
                color: '#C9A84C', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
              }}>{s}</button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%', background: m.role === 'user' ? 'rgba(201,168,76,0.15)' : '#0A0E1A',
            border: `1px solid ${m.role === 'user' ? 'rgba(201,168,76,0.3)' : 'rgba(184,176,160,0.15)'}`,
            color: '#F5F0E8', padding: '10px 13px', borderRadius: '8px', fontSize: '0.82rem', lineHeight: 1.5,
            whiteSpace: 'pre-wrap', fontFamily: 'Crimson Pro, serif',
          }}>{m.content}</div>
        ))}

        {loading && (
          <div style={{ alignSelf: 'flex-start', color: '#B8B0A0', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>
            Checking the roster…
          </div>
        )}
        {error && (
          <div style={{ alignSelf: 'flex-start', color: '#E74C3C', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid rgba(201,168,76,0.15)', display: 'flex', gap: '8px' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Ask a question or paste meeting notes…"
          rows={1}
          style={{
            flex: 1, resize: 'none', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)',
            color: '#F5F0E8', padding: '9px 12px', borderRadius: '6px', fontFamily: 'Crimson Pro, serif',
            fontSize: '0.82rem', outline: 'none', maxHeight: '100px',
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{
            background: '#C9A84C', color: '#0A0E1A', border: 'none', padding: '0 16px', borderRadius: '6px',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontFamily: 'Cinzel, serif',
            fontSize: '0.75rem', fontWeight: 700, opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >Ask</button>
      </div>
    </div>
  )
}
