'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * "Which of these two are you?"
 *
 * THE QUESTION NOBODY WAS ASKED, and the reason a Senior Warden of a
 * lodge already on LodgeOS filled in the form that signs up a new one.
 * His invitation email never reached him; he went to the sign-in page;
 * the only other thing on it said "Request Access"; and that took him
 * straight to a form headed FOR LODGES. He answered it honestly and
 * asked for a second Psalms of Job #1827.
 *
 * Nothing was broken. He was never asked the one question that
 * separates the two kinds of person who arrive here, so the form he
 * landed on was decided by which link happened to exist.
 *
 * A DIALOG, NOT A PAGE. It opens over the form he was heading for, so
 * a lodge that really is signing up loses nothing but one tap — and a
 * brother is caught before he has typed a word into the wrong place.
 */

type Lodge = { name: string; number: string | null; slug: string; where: string | null }

export function AccessChooser() {
  const router = useRouter()
  const [choice, setChoice] = useState<'unasked' | 'brother' | 'lodge'>('unasked')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Lodge[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const box = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (choice === 'brother') box.current?.focus()
  }, [choice])

  /**
   * Searched as he types, after a beat. A lodge list is small and the
   * query is cheap; making him press a button to find out whether his
   * own lodge is here is a step that teaches nothing.
   */
  useEffect(() => {
    if (choice !== 'brother') return
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearched(false); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lodges/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.lodges ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
        setSearched(true)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, choice])

  if (choice === 'lodge') return null

  const card = (
    title: string,
    blurb: string,
    onClick: () => void,
  ) => (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.25)',
        borderRadius: 8, padding: '1.1rem 1.2rem', marginBottom: '0.85rem',
      }}
    >
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#F5F0E8', marginBottom: 5 }}>
        {title}
      </div>
      <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#B8B0A0', lineHeight: 1.55 }}>
        {blurb}
      </div>
    </button>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Which of these are you?"
      style={{
        position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(6,10,17,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <div
        className="lodgeos-dialog-in"
        style={{
          background: '#141C2E', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 10,
          padding: '1.75rem', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.25em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          BEFORE YOU BEGIN
        </div>

        {choice === 'unasked' ? (
          <>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.35rem', color: '#F5F0E8', margin: '0 0 0.4rem' }}>
              Which of these are you?
            </h2>
            <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1rem', color: '#B8B0A0', lineHeight: 1.6, margin: '0 0 1.4rem' }}>
              These go to two different places, and the second one is not what most people need.
            </p>

            {card(
              'I am a brother, and I cannot sign in',
              'Your lodge already uses LodgeOS and you need a login — or the one you were sent never arrived. Your Secretary grants this, not us.',
              () => setChoice('brother')
            )}

            {card(
              'My lodge does not use LodgeOS yet',
              'You are asking on behalf of a lodge that is not on the platform, to have it set up.',
              () => setChoice('lodge')
            )}
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.35rem', color: '#F5F0E8', margin: '0 0 0.4rem' }}>
              Which lodge is yours?
            </h2>
            <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1rem', color: '#B8B0A0', lineHeight: 1.6, margin: '0 0 1.1rem' }}>
              Its name or its number — either will find it.
            </p>

            <input
              ref={box}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Psalms of Job, or 1827"
              aria-label="Search for your lodge"
              style={{
                width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.25)',
                borderRadius: 4, color: '#F5F0E8', fontFamily: 'Crimson Pro, serif',
                // 16px, or iOS zooms the page as soon as this is tapped.
                fontSize: '16px', padding: '11px 13px', boxSizing: 'border-box',
              }}
            />

            <div style={{ marginTop: '0.9rem' }}>
              {searching && (
                <div className="lodgeos-pulse" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.12em', color: '#C9A84C' }}>
                  LOOKING…
                </div>
              )}

              {results.map(lodge => (
                <button
                  key={lodge.slug}
                  onClick={() => router.push(`/${lodge.slug}/request-access`)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: 'transparent', border: '1px solid rgba(201,168,76,0.18)',
                    borderRadius: 6, padding: '0.8rem 0.95rem', marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: '#C9A84C' }}>
                    {lodge.name}{lodge.number ? ` #${lodge.number}` : ''}
                  </div>
                  {lodge.where && (
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#918879', marginTop: 3 }}>
                      {lodge.where.toUpperCase()}
                    </div>
                  )}
                </button>
              ))}

              {/* Not finding it is a real answer, and the way out has to
                  be here — otherwise he backs up and takes the wrong
                  door again, which is the whole failure this exists to
                  prevent. */}
              {searched && !searching && results.length === 0 && (
                <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#B8B0A0', lineHeight: 1.6 }}>
                  No lodge of that name is on LodgeOS. Check the spelling, or try the number on its
                  own — and if it really is not here, your lodge has not been set up yet.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid rgba(201,168,76,0.12)' }}>
              <button
                onClick={() => { setChoice('unasked'); setQuery(''); setResults([]); setSearched(false) }}
                style={{
                  background: 'transparent', border: '1px solid rgba(184,176,160,0.25)', borderRadius: 4,
                  color: '#B8B0A0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 13px', cursor: 'pointer',
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setChoice('lodge')}
                style={{
                  background: 'transparent', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 4,
                  color: '#C9A84C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 13px', cursor: 'pointer',
                }}
              >
                My lodge is not here — set it up
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
