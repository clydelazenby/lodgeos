'use client'
import { useRef, useState } from 'react'
import { T } from '@/lib/designTokens'
import { notify } from '@/lib/toast'
import { errorMessage } from '@/lib/clientFetch'
import { prepareForGallery, fileFrom, formatBytes, type PreparedImage } from '@/lib/images'

/**
 * Choose the photographs, say what they are, THEN post them.
 *
 * The first version uploaded the moment a file was picked and let you
 * caption it afterwards. That is backwards: the photograph was already
 * on the lodge's public website, in front of the world, before anyone
 * had written a word about it — and if the brethren were being told, it
 * had already gone out untitled. Every editor a person recognises works
 * the other way round: assemble, review, post.
 *
 * SO NOTHING LEAVES THIS PAGE UNTIL "POST" IS PRESSED. Files are read
 * and resized in the browser as they are chosen, so the previews are
 * real and the sizes are honest, but the bytes stay here. A picture can
 * be dropped from the batch, or the whole thing abandoned, and the
 * website never knew about it.
 */

type Staged = {
  key: string
  name: string
  originalBytes: number
  prepared: PreparedImage
  previewUrl: string
  caption: string
  altText: string
  takenOn: string
  /** Set while it is going up, so the card can show its own progress. */
  state: 'ready' | 'posting' | 'done' | 'failed'
  error?: string
}

export function GalleryComposer({
  tenantId,
  onPosted,
}: {
  tenantId: string
  /** Called with the ids that actually landed, once the batch is done. */
  onPosted: (photos: any[], tellBrethren: boolean) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [staged, setStaged] = useState<Staged[]>([])
  const [reading, setReading] = useState(0)
  const [posting, setPosting] = useState(false)
  const [tellBrethren, setTellBrethren] = useState(true)
  const [error, setError] = useState('')

  const choose = async (files: FileList | null) => {
    if (!files?.length) return
    setError('')
    const list = Array.from(files)
    setReading(list.length)

    for (const file of list) {
      try {
        const prepared = await prepareForGallery(file)
        setStaged(s => [...s, {
          key: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          originalBytes: file.size,
          prepared,
          previewUrl: URL.createObjectURL(prepared.thumb.blob),
          caption: '',
          altText: '',
          takenOn: '',
          state: 'ready',
        }])
      } catch (e) {
        // Named, and the rest continue — one file the browser cannot
        // decode must not lose the other nineteen.
        setError(`${file.name}: ${errorMessage(e, 'could not be read as an image.')}`)
      }
      setReading(n => n - 1)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const update = (key: string, patch: Partial<Staged>) =>
    setStaged(s => s.map(x => (x.key === key ? { ...x, ...patch } : x)))

  const drop = (key: string) => {
    setStaged(s => {
      const found = s.find(x => x.key === key)
      // Frees the object URL rather than leaking it for the life of the
      // page — twenty phone photographs is twenty decoded bitmaps.
      if (found) URL.revokeObjectURL(found.previewUrl)
      return s.filter(x => x.key !== key)
    })
  }

  const post = async () => {
    if (!staged.length || posting) return
    setPosting(true)
    setError('')

    const landed: any[] = []
    let failed = 0

    for (const item of staged) {
      if (item.state === 'done') continue
      update(item.key, { state: 'posting', error: undefined })
      try {
        const form = new FormData()
        form.append('tenantId', tenantId)
        form.append('file', fileFrom(item.prepared.display, 'photo.jpg'))
        form.append('thumb', fileFrom(item.prepared.thumb, 'thumb.jpg'))
        form.append('width', String(item.prepared.display.width))
        form.append('height', String(item.prepared.display.height))
        form.append('caption', item.caption)
        form.append('altText', item.altText)
        form.append('takenOn', item.takenOn)

        const res = await fetch('/api/gallery', { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Upload failed.')

        update(item.key, { state: 'done' })
        landed.push(data.photo)
      } catch (e) {
        failed += 1
        update(item.key, { state: 'failed', error: errorMessage(e, 'could not be posted.') })
      }
    }

    setPosting(false)

    if (landed.length) {
      // The ones that made it leave the tray; anything that failed
      // stays, with its reason, so it can be tried again rather than
      // silently lost.
      setStaged(s => s.filter(x => x.state !== 'done'))
      notify.saved(
        `${landed.length} photograph${landed.length === 1 ? '' : 's'} posted to the gallery` +
        (failed ? ` — ${failed} could not be posted` : '')
      )
      onPosted(landed, tellBrethren)
    } else if (failed) {
      notify.error('Nothing was posted. Each photograph below says why.')
    }
  }

  const totalSaved = staged.reduce(
    (n, s) => n + Math.max(0, s.originalBytes - s.prepared.display.blob.size), 0
  )

  const card: React.CSSProperties = {
    background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: T.radius, padding: '1.25rem', marginBottom: '1.25rem',
  }
  const smallLabel: React.CSSProperties = {
    fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.1em',
    color: T.inkFainter, textTransform: 'uppercase', marginBottom: '3px', display: 'block',
  }
  const input: React.CSSProperties = {
    width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink,
    padding: '7px 10px', borderRadius: '5px', fontFamily: T.body,
    fontSize: '16px', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={card}>
      <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.14em', color: T.gold, textTransform: 'uppercase', marginBottom: '6px' }}>
        Add photographs
      </div>
      <p style={{ fontFamily: T.body, fontSize: '0.88rem', color: T.inkFaint, marginTop: 0, marginBottom: '0.9rem' }}>
        Pick as many as you like and write a description for each. <strong style={{ color: T.ink }}>Nothing
        goes on the website until you press Post.</strong> They are resized in this browser first,
        so the gallery stays quick for a visitor on a poor signal — your originals are untouched.
      </p>

      {error && (
        <div style={{ background: T.dangerDim, border: '1px solid rgba(231,76,60,0.3)', color: T.danger, padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem', fontFamily: T.body, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={posting}
        onChange={e => choose(e.target.files)}
        style={{ fontFamily: T.body, fontSize: '0.88rem', color: T.inkFaint }}
      />

      {reading > 0 && (
        <div className="lodgeos-pulse" style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.1em', color: T.gold, marginTop: '0.8rem' }}>
          PREPARING {reading} MORE…
        </div>
      )}

      {staged.length > 0 && (
        <>
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
            {staged.map(item => (
              <div
                key={item.key}
                className="lodgeos-stage-in"
                style={{
                  border: `1px solid ${item.state === 'failed' ? 'rgba(231,76,60,0.45)' : item.state === 'done' ? 'rgba(93,190,133,0.45)' : T.borderStrong}`,
                  borderRadius: '8px', padding: '0.9rem',
                  display: 'grid', gridTemplateColumns: 'minmax(0, 120px) minmax(0, 1fr)', gap: '0.9rem',
                  alignItems: 'start',
                  opacity: item.state === 'posting' ? 0.6 : 1,
                  transition: 'opacity 0.25s, border-color 0.25s',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL for a file not yet uploaded */}
                <img
                  src={item.previewUrl}
                  alt=""
                  style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: '5px', border: `1px solid ${T.border}`, display: 'block' }}
                />

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem' }}>
                    <div>
                      <label style={smallLabel}>Description (optional)</label>
                      <input
                        value={item.caption}
                        placeholder="Installation night, 2025"
                        disabled={posting}
                        onChange={e => update(item.key, { caption: e.target.value })}
                        style={input}
                      />
                    </div>
                    <div>
                      <label style={smallLabel}>Alt text — for screen readers</label>
                      <input
                        value={item.altText}
                        placeholder="What the photograph shows"
                        disabled={posting}
                        onChange={e => update(item.key, { altText: e.target.value })}
                        style={input}
                      />
                    </div>
                    <div>
                      <label style={smallLabel}>Date taken (optional)</label>
                      <input
                        type="date"
                        value={item.takenOn}
                        disabled={posting}
                        onChange={e => update(item.key, { takenOn: e.target.value })}
                        style={input}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.7rem' }}>
                    <button
                      onClick={() => drop(item.key)}
                      disabled={posting}
                      style={{
                        background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '4px',
                        color: T.inkFaint, fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em',
                        textTransform: 'uppercase', padding: '6px 10px',
                        cursor: posting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Remove
                    </button>

                    <span style={{ fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.06em', color: T.inkFainter }}>
                      {item.prepared.display.width}×{item.prepared.display.height} ·{' '}
                      {formatBytes(item.originalBytes)} → {formatBytes(item.prepared.display.blob.size)}
                    </span>

                    {item.state === 'posting' && (
                      <span className="lodgeos-pulse" style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.1em', color: T.gold }}>
                        POSTING…
                      </span>
                    )}
                    {item.state === 'done' && (
                      <span style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.1em', color: T.success }}>
                        ✓ POSTED
                      </span>
                    )}
                  </div>

                  {item.error && (
                    <div style={{ fontFamily: T.body, fontSize: '0.86rem', color: T.danger, marginTop: '0.5rem' }}>
                      {item.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Decided before Post, not after. */}
          <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', margin: '1.1rem 0 0.9rem' }}>
            <input
              type="checkbox"
              checked={tellBrethren}
              disabled={posting}
              onChange={e => setTellBrethren(e.target.checked)}
              style={{ accentColor: T.gold, marginTop: 3 }}
            />
            <span>
              <span style={{ fontFamily: T.body, fontSize: '0.92rem', color: T.ink }}>
                Email the brethren when these are posted
              </span>
              <span style={{ display: 'block', fontFamily: T.body, fontSize: '0.84rem', color: T.inkFainter }}>
                One email for the whole batch, with a link to the gallery. Leave it off for a quiet
                addition. Any brother can switch these off for himself.
              </span>
            </span>
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={post}
              disabled={posting || reading > 0}
              className={posting ? 'lodgeos-pulse' : undefined}
              style={{
                background: T.gold, color: T.bg, border: 'none', padding: '12px 28px', borderRadius: '6px',
                fontFamily: T.display, fontSize: '0.88rem', fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: posting || reading > 0 ? 'not-allowed' : 'pointer',
                opacity: posting || reading > 0 ? 0.6 : 1,
                transition: 'opacity 0.2s, transform 0.1s',
              }}
            >
              {posting
                ? 'Posting…'
                : `Post ${staged.length} photograph${staged.length === 1 ? '' : 's'}`}
            </button>

            {!posting && totalSaved > 0 && (
              <span style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em', color: T.inkFainter }}>
                {formatBytes(totalSaved)} SAVED FOR EVERY VISITOR
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
