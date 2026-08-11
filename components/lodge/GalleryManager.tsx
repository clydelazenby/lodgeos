'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { callApi, errorMessage } from '@/lib/clientFetch'
import { formatBytes } from '@/lib/images'
import { GalleryComposer } from '@/components/lodge/GalleryComposer'
import { notify } from '@/lib/toast'

/**
 * The lodge's photographs, managed from the dashboard.
 *
 * The public site has advertised a Gallery in its navigation since it
 * was built; clicking it scrolled you to four empty gold boxes. This is
 * the other half.
 *
 * RESIZED IN THIS BROWSER, BEFORE ANYTHING IS SENT. See lib/images.ts.
 * Measured on a 4032x3024 phone photograph in Chromium: 5.2 MB becomes
 * an 835 KB display image and a 72 KB thumbnail — so twenty of them is
 * a 1.4 MB gallery rather than a 105 MB one. The officer is told what
 * it saved, because otherwise nobody would know it happened.
 *
 * SEVERAL AT ONCE, ONE AFTER ANOTHER. A Secretary with an evening's
 * photographs picks them all; they upload in sequence rather than in
 * parallel, so a slow connection degrades into a queue rather than
 * twenty stalled requests, and the count says where he is.
 *
 * CAPTIONS SAVE ON BLUR, not on every keystroke — a caption is prose
 * and the writer pauses mid-sentence. Everything else saves on the
 * click, because a toggle is a decision.
 */

type Photo = {
  id: string
  url: string
  thumb_url: string | null
  caption: string | null
  alt_text: string | null
  taken_on: string | null
  is_published: boolean
  width: number | null
  height: number | null
  bytes: number | null
}

type Settings = {
  gallery_enabled: boolean
  gallery_heading: string | null
  gallery_intro: string | null
}

export function GalleryManager({
  tenantId, slug, photos: initial, settings: initialSettings,
}: {
  tenantId: string
  slug: string
  photos: Photo[]
  settings: Settings
}) {
  const router = useRouter()
  const [photos, setPhotos] = useState<Photo[]>(initial)
  const [settings, setSettings] = useState(initialSettings)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const flashError = (e: unknown, fallback: string) => {
    const message = errorMessage(e, fallback)
    setError(message)
    notify.error(message)
  }

  /**
   * Posting is the composer's job now — see GalleryComposer. It hands
   * back the rows that actually landed, and whether the lodge is to be
   * told, once the officer has pressed Post.
   */
  const afterPost = async (landed: any[], tellBrethren: boolean) => {
    setPhotos(p => [...p, ...landed])
    router.refresh()
    if (!tellBrethren || !landed.length) return
    try {
      const data = await callApi('/api/gallery/announce', {
        method: 'POST',
        body: { tenantId, photoIds: landed.map(x => x.id) },
      })
      if (data.message) notify.info(data.message)
    } catch (e) {
      // The photographs are up. Saying otherwise would have an officer
      // post them a second time.
      notify.error(`Posted, but the lodge could not be told: ${errorMessage(e, 'unknown error')}`)
    }
  }

  // ----------------------------------------------------------- edit
  const patch = async (photoId: string, body: Record<string, unknown>, optimistic: Partial<Photo>) => {
    const before = photos.find(p => p.id === photoId)
    setPhotos(p => p.map(x => (x.id === photoId ? { ...x, ...optimistic } : x)))
    setBusy(photoId)
    setError('')
    try {
      await callApi('/api/gallery', { method: 'PATCH', body: { tenantId, photoId, ...body } })
      notify.saved(
        'isPublished' in body
          ? (body.isPublished ? 'Showing on the site' : 'Hidden from the site')
          : 'Saved'
      )
      router.refresh()
    } catch (e) {
      if (before) setPhotos(p => p.map(x => (x.id === photoId ? before : x)))
      flashError(e, 'That change could not be saved.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (photoId: string) => {
    const before = photos
    setConfirmDelete(null)
    setBusy(photoId)
    /**
     * COLLAPSES OUT, then goes. A row that simply vanishes leaves the
     * eye asking what moved; one that folds away answers it. Removed
     * from state only after the animation, so the two do not fight.
     */
    setRemoving(photoId)
    await new Promise(r => setTimeout(r, 300))
    setPhotos(p => p.filter(x => x.id !== photoId))
    setRemoving(null)
    try {
      await callApi('/api/gallery', { method: 'DELETE', body: { tenantId, photoId } })
      notify.saved('Photograph deleted')
      router.refresh()
    } catch (e) {
      setPhotos(before)
      flashError(e, 'That photograph could not be deleted.')
    } finally {
      setBusy(null)
    }
  }

  /** The whole new arrangement, not a nudge — see the route. */
  const move = async (photoId: string, direction: -1 | 1) => {
    const index = photos.findIndex(p => p.id === photoId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= photos.length) return

    const next = [...photos]
    ;[next[index], next[target]] = [next[target], next[index]]
    const before = photos
    setPhotos(next)
    setError('')
    try {
      await callApi('/api/gallery', {
        method: 'PATCH',
        body: { tenantId, order: next.map(p => p.id) },
      })
      notify.saved('Order saved')
      router.refresh()
    } catch (e) {
      setPhotos(before)
      flashError(e, 'The order could not be saved.')
    }
  }

  const saveSettings = async (body: Partial<{ enabled: boolean; heading: string; intro: string }>) => {
    const before = settings
    setSettings(s => ({
      ...s,
      ...(body.enabled !== undefined ? { gallery_enabled: body.enabled } : {}),
      ...(body.heading !== undefined ? { gallery_heading: body.heading } : {}),
      ...(body.intro !== undefined ? { gallery_intro: body.intro } : {}),
    }))
    try {
      await callApi('/api/gallery/settings', { method: 'PATCH', body: { tenantId, ...body } })
      notify.saved('Saved')
      router.refresh()
    } catch (e) {
      setSettings(before)
      flashError(e, 'That setting could not be saved.')
    }
  }

  // --------------------------------------------------------- styles
  const card: React.CSSProperties = {
    background: T.bgCard, border: `1px solid ${T.border}`,
    borderRadius: T.radius, padding: '1.25rem', marginBottom: '1.25rem',
  }
  const eyebrow: React.CSSProperties = {
    fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.14em',
    color: T.gold, textTransform: 'uppercase', marginBottom: '6px',
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
  const published = photos.filter(p => p.is_published).length

  return (
    <div style={{ minWidth: 0 }}>
      {error && (
        <div style={{ background: T.dangerDim, border: '1px solid rgba(231,76,60,0.3)', color: T.danger, padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem', fontFamily: T.body, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* ------------------------------------------------- the section */}
      <div style={card}>
        <div style={eyebrow}>The gallery section</div>

        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={settings.gallery_enabled}
            onChange={e => saveSettings({ enabled: e.target.checked })}
            style={{ accentColor: T.gold, marginTop: 3 }}
          />
          <span>
            <span style={{ fontFamily: T.body, fontSize: '0.92rem', color: T.ink }}>
              Show the gallery on the public site
            </span>
            {/* The section and the nav link move together on purpose —
                see the settings route. */}
            <span style={{ display: 'block', fontFamily: T.body, fontSize: '0.84rem', color: T.inkFainter }}>
              Turning this off removes the Gallery link from the site&rsquo;s menu as well, so
              nothing points at a section that isn&rsquo;t there.
            </span>
          </span>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.9rem' }}>
          <div>
            <label style={smallLabel} htmlFor="g-heading">Heading</label>
            <input
              id="g-heading"
              defaultValue={settings.gallery_heading ?? ''}
              placeholder="Our Lodge"
              onBlur={e => e.target.value !== (settings.gallery_heading ?? '') && saveSettings({ heading: e.target.value })}
              style={input}
            />
          </div>
          <div>
            <label style={smallLabel} htmlFor="g-intro">Introduction (optional)</label>
            <input
              id="g-intro"
              defaultValue={settings.gallery_intro ?? ''}
              placeholder="A few words above the photographs"
              onBlur={e => e.target.value !== (settings.gallery_intro ?? '') && saveSettings({ intro: e.target.value })}
              style={input}
            />
          </div>
        </div>

        <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.08em', color: T.inkFainter, marginTop: '0.9rem' }}>
          {published} SHOWING · {photos.length - published} HIDDEN ·{' '}
          <a href={`/${slug}#gallery`} target="_blank" rel="noreferrer" style={{ color: T.gold }}>
            VIEW THE PUBLIC PAGE ↗
          </a>
        </div>
      </div>

      <GalleryComposer tenantId={tenantId} onPosted={afterPost} />

      {/* ----------------------------------------------------- the set */}
      {photos.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '3rem 1.25rem' }}>
          <div style={{ fontFamily: T.body, fontStyle: 'italic', color: T.inkFaint }}>
            No photographs yet. Until there are some, the gallery section stays off the public
            site rather than showing empty frames.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className={removing === photo.id ? 'lodgeos-removing' : 'lodgeos-stage-in'}
              style={{
                ...card, marginBottom: 0, opacity: busy === photo.id ? 0.5 : 1,
                display: 'grid', gridTemplateColumns: 'minmax(0, 150px) minmax(0, 1fr)',
                gap: '1rem', alignItems: 'start',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Storage URL, not a static local asset */}
              <img
                src={photo.thumb_url || photo.url}
                alt={photo.alt_text || photo.caption || 'Lodge photograph'}
                style={{
                  width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: '6px',
                  border: `1px solid ${T.border}`, display: 'block',
                  filter: photo.is_published ? 'none' : 'grayscale(1) opacity(0.5)',
                }}
              />

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem' }}>
                  <div>
                    <label style={smallLabel}>Description (optional)</label>
                    <input
                      defaultValue={photo.caption ?? ''}
                      placeholder="Installation night, 2025"
                      onBlur={e => e.target.value !== (photo.caption ?? '') &&
                        patch(photo.id, { caption: e.target.value }, { caption: e.target.value || null })}
                      style={input}
                    />
                  </div>

                  <div>
                    <label style={smallLabel}>Alt text — for screen readers</label>
                    <input
                      defaultValue={photo.alt_text ?? ''}
                      placeholder="What the photograph shows"
                      onBlur={e => e.target.value !== (photo.alt_text ?? '') &&
                        patch(photo.id, { altText: e.target.value }, { alt_text: e.target.value || null })}
                      style={input}
                    />
                  </div>

                  <div>
                    <label style={smallLabel}>Date taken (optional)</label>
                    <input
                      type="date"
                      defaultValue={photo.taken_on ?? ''}
                      onBlur={e => e.target.value !== (photo.taken_on ?? '') &&
                        patch(photo.id, { takenOn: e.target.value }, { taken_on: e.target.value || null })}
                      style={input}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.8rem' }}>
                  <Action
                    onClick={() => patch(photo.id, { isPublished: !photo.is_published }, { is_published: !photo.is_published })}
                    tone={photo.is_published ? T.inkFaint : T.success}
                  >
                    {photo.is_published ? 'Hide from the site' : 'Show on the site'}
                  </Action>

                  <Action onClick={() => move(photo.id, -1)} disabled={i === 0} tone={T.inkFaint}>↑ Earlier</Action>
                  <Action onClick={() => move(photo.id, 1)} disabled={i === photos.length - 1} tone={T.inkFaint}>↓ Later</Action>

                  {confirmDelete === photo.id ? (
                    <>
                      <Action onClick={() => remove(photo.id)} tone={T.danger}>Delete for good</Action>
                      <Action onClick={() => setConfirmDelete(null)} tone={T.inkFaint}>Keep it</Action>
                    </>
                  ) : (
                    <Action onClick={() => setConfirmDelete(photo.id)} tone={T.danger}>Delete</Action>
                  )}

                  <span style={{ fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.08em', color: T.inkFainter, marginLeft: 'auto' }}>
                    {photo.width && photo.height ? `${photo.width}×${photo.height}` : ''}
                    {photo.bytes ? ` · ${formatBytes(photo.bytes)}` : ''}
                  </span>
                </div>

                {/* Deleting is the one thing here that cannot be undone,
                    so it says so rather than relying on a second click
                    to imply it. */}
                {confirmDelete === photo.id && (
                  <div style={{ fontFamily: T.body, fontSize: '0.86rem', color: T.danger, marginTop: '0.5rem' }}>
                    This removes the file itself. If you only want it off the public site, hide it
                    instead — that can be undone.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Action({
  children, onClick, tone, disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  tone: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '4px',
        color: tone, fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em',
        textTransform: 'uppercase', padding: '6px 10px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  )
}
