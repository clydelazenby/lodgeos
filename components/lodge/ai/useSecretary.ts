'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readNdjson } from './ndjson'

export type Msg = { role: 'user' | 'assistant'; content: string }

/**
 * The conversation, and what it takes to keep one.
 *
 * Two problems this exists to solve, both of which made the assistant
 * feel disposable rather than useful:
 *
 * IT FORGOT EVERYTHING ON EVERY CLICK. The thread lived in the state of
 * a component mounted inside the lodge layout, so asking "who owes
 * dues?" and then opening a brother's profile to look at him wiped the
 * question, the answer and the draft that followed it. That is the most
 * ordinary thing an officer would do next. sessionStorage keeps it for
 * the life of the tab — long enough to survive navigating, short enough
 * that a shared lodge computer does not hand the next man the last
 * man's conversation.
 *
 * IT COULD NOT BE STOPPED. There was no way out of a request that had
 * gone down the wrong path except to wait through it. An AbortController
 * on the fetch ends it at both ends: the browser stops reading and the
 * route stops generating, which also stops the bill.
 */

const KEY_PREFIX = 'lodgeos:ai:'

type Stored = { messages: Msg[]; raw: any[] }

function load(tenantId: string): Stored {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + tenantId)
    if (!raw) return { messages: [], raw: [] }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.messages) || !Array.isArray(parsed?.raw)) return { messages: [], raw: [] }
    return parsed
  } catch {
    return { messages: [], raw: [] }
  }
}

function save(tenantId: string, value: Stored) {
  try {
    sessionStorage.setItem(KEY_PREFIX + tenantId, JSON.stringify(value))
  } catch {
    // Quota, or storage refused in private browsing. The conversation
    // still works for as long as the component is mounted; it just
    // stops surviving navigation. Nothing here is worth an error.
  }
}

export function useSecretary(tenantId: string) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [rawConversation, setRawConversation] = useState<any[]>([])
  const [live, setLive] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [restored, setRestored] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  // Restored after mount, never during render: sessionStorage does not
  // exist on the server, and reading it in the initial state would make
  // the first client render disagree with the server's HTML.
  useEffect(() => {
    const stored = load(tenantId)
    setMessages(stored.messages)
    setRawConversation(stored.raw)
    setRestored(true)
  }, [tenantId])

  useEffect(() => {
    if (!restored) return
    save(tenantId, { messages, raw: rawConversation })
  }, [restored, tenantId, messages, rawConversation])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  /**
   * Closing the panel mid-answer cancels it.
   *
   * The reply lives in this component's state, so once it unmounts there
   * is nowhere for the remaining tokens to land — leaving the request
   * running would generate a full set of minutes into a void and bill
   * the lodge for it. Cancelling loses nothing that was not already
   * lost, and stops the meter.
   */
  useEffect(() => () => abortRef.current?.abort(), [])

  const clear = useCallback(() => {
    stop()
    setMessages([])
    setRawConversation([])
    setLive('')
    setStatuses([])
    setError('')
  }, [stop])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || loading) return

      setError('')
      setLive('')
      setStatuses([])
      setMessages((prev) => [...prev, { role: 'user', content: question }])
      setLoading(true)

      const nextConversation = [...rawConversation, { role: 'user', content: question }]

      const controller = new AbortController()
      abortRef.current = controller

      // Held outside React state as well, because the last fragments can
      // arrive in the same tick as the closing line and a state read
      // there would be one render behind.
      let buffered = ''

      try {
        const res = await fetch('/api/ai/secretary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, messages: nextConversation }),
          signal: controller.signal,
        })

        // Failures before the stream opens are still ordinary JSON.
        if (!res.ok) {
          const detail = await res.json().catch(() => null)
          throw new Error(detail?.error || `The AI Secretary hit an error (${res.status}).`)
        }
        if (!res.body) throw new Error('The AI Secretary returned nothing.')

        await readNdjson(res.body, (event) => {
          if (event.t === 'text') {
            buffered += event.v
            setLive(buffered)
          } else if (event.t === 'tools') {
            // What streamed during this round was the model talking its
            // way toward a lookup, not the answer. Clearing it keeps the
            // finished reply clean.
            buffered = ''
            setLive('')
            setStatuses(event.v ?? [])
          } else if (event.t === 'done') {
            setMessages((prev) => [...prev, { role: 'assistant', content: event.reply }])
            setRawConversation(event.conversation ?? [])
            buffered = ''
            setLive('')
            setStatuses([])
          } else if (event.t === 'error') {
            setError(event.v)
            buffered = ''
            setLive('')
            setStatuses([])
          }
        })
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          // Stopped on purpose. Keep whatever had already been written
          // rather than throwing it away — a half-finished draft is
          // often exactly why the officer stopped it.
          if (buffered.trim()) {
            setMessages((prev) => [...prev, { role: 'assistant', content: buffered }])
          }
        } else {
          setError(e?.message ?? 'The AI Secretary hit an error.')
        }
      } finally {
        abortRef.current = null
        setLive('')
        setStatuses([])
        setLoading(false)
      }
    },
    [loading, rawConversation, tenantId]
  )

  return { messages, live, statuses, loading, error, send, stop, clear }
}
