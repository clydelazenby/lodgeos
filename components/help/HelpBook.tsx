'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { T } from '@/lib/designTokens'
import { HELP_GROUPS, HELP_TOPICS, searchHelp, type HelpTopic } from '@/lib/help'
import { HelpArticle } from './HelpArticle'

/**
 * The whole guide, in the app.
 *
 * The ? in the header answers the page you are on. This is where you
 * end up when the question is not about the page you are on — "how do
 * dues work" asked from the dashboard, or the new Secretary reading
 * ahead of December.
 *
 * ONE OPEN AT A TIME, and the search box above it. Thirty-six sections
 * laid out flat is the PDF again, and the PDF is what this replaces.
 */
export function HelpBook({ initialTopic }: { initialTopic?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(initialTopic ?? null)
  const scrolled = useRef(false)

  const results = useMemo(() => searchHelp(query), [query])

  /**
   * Arriving from "the whole guide →" lands on a page whose section is
   * far below the fold; without this the reader sees a search box and
   * has to hunt for the thing he pressed to get here. Once only — a
   * later search must not yank the page back.
   */
  useEffect(() => {
    if (!initialTopic || scrolled.current) return
    scrolled.current = true
    const el = document.getElementById(`help-${initialTopic}`)
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [initialTopic])

  const byGroup = HELP_GROUPS
    .map(group => ({ group, topics: results.filter(t => t.group === group) }))
    .filter(g => g.topics.length > 0)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search — dues, minutes, invitation, permissions…"
          aria-label="Search the guide"
          style={{
            width: '100%', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
            color: T.ink, fontFamily: T.body,
            // 16px, and not smaller: iOS zooms the whole page in on any
            // input under it, which on a phone throws the layout out
            // the moment somebody taps the search box.
            fontSize: '16px',
            padding: '11px 13px',
          }}
        />
        <div style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.1em', color: T.inkFainter, marginTop: '6px', textTransform: 'uppercase' }}>
          {query
            ? `${results.length} of ${HELP_TOPICS.length} sections`
            : `${HELP_TOPICS.length} sections`}
        </div>
      </div>

      {byGroup.length === 0 && (
        <p style={{ fontFamily: T.body, fontSize: '1rem', color: T.inkFaint }}>
          Nothing in the guide mentions that. Try one word rather than a sentence — “dues”,
          “invite”, “minutes”.
        </p>
      )}

      {byGroup.map(({ group, topics }) => (
        <section key={group} style={{ marginBottom: '1.8rem' }}>
          <div
            style={{
              fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.2em', color: T.gold,
              textTransform: 'uppercase', marginBottom: '0.6rem',
            }}
          >
            {group}
          </div>

          <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {topics.map((topic, i) => (
              <Section
                key={topic.key}
                topic={topic}
                open={open === topic.key}
                first={i === 0}
                onToggle={() => setOpen(open === topic.key ? null : topic.key)}
                onFollow={key => {
                  setQuery('')
                  setOpen(key)
                  const el = document.getElementById(`help-${key}`)
                  if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Section({
  topic, open, first, onToggle, onFollow,
}: {
  topic: HelpTopic
  open: boolean
  first: boolean
  onToggle: () => void
  onFollow: (key: string) => void
}) {
  return (
    <div id={`help-${topic.key}`} style={{ borderTop: first ? 'none' : `1px solid ${T.border}`, scrollMarginTop: '76px' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left', background: open ? T.bgPanel : 'transparent',
          border: 'none', cursor: 'pointer', padding: '0.9rem 1rem',
          display: 'flex', alignItems: 'flex-start', gap: '0.8rem',
        }}
      >
        <span
          aria-hidden="true"
          style={{ color: T.gold, fontFamily: T.mono, fontSize: '11px', marginTop: '4px', flexShrink: 0 }}
        >
          {open ? '−' : '+'}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: T.display, fontSize: '1rem', color: T.ink }}>
            {topic.title}
          </span>
          <span style={{ display: 'block', fontFamily: T.body, fontSize: '0.9rem', color: T.inkFainter, fontStyle: 'italic', marginTop: '2px' }}>
            {topic.lead}
          </span>
          <span style={{ display: 'block', fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.1em', color: T.inkFainter, textTransform: 'uppercase', marginTop: '5px' }}>
            {topic.where}
          </span>
        </span>
      </button>

      {open && (
        <div className="lodgeos-stage-in" style={{ padding: '0.2rem 1rem 1.2rem', minWidth: 0 }}>
          <HelpArticle topic={topic} onFollow={onFollow} />
        </div>
      )}
    </div>
  )
}
