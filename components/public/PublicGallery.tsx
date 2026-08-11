'use client'
import { useEffect, useState, useCallback } from 'react'

/**
 * The lodge's photographs, as a visitor sees them.
 *
 * WHAT MAKES A GALLERY LOOK CHEAP, and what is done about each:
 *
 * IT JUMPS while the images arrive. Every tile reserves its space with
 * a fixed aspect ratio, so the page is its final height before a single
 * byte of photograph has loaded. This is why the upload records width
 * and height at all.
 *
 * IT MAKES YOU WAIT. The grid shows the 480px thumbnails; the full
 * 1600px image is fetched only when someone opens one. Twenty
 * thumbnails is a few hundred kilobytes.
 *
 * IT CROPS BADLY. Tiles crop with object-fit for the grid — reversible,
 * and the whole photograph is there in the lightbox. Nothing is cropped
 * on the way in.
 *
 * IT IS A DEAD END. Clicking opens the photograph full-size with its
 * description, and arrow keys walk the set. A gallery you cannot look
 * at properly is a decoration, not a gallery.
 *
 * NO IMAGE IS UNLABELLED. alt falls back to the caption, then to a
 * generic description — a screen reader announcing "image" twenty times
 * is the accessible equivalent of the empty gold boxes this replaced.
 */

export type PublicPhoto = {
  id: string
  url: string
  thumb_url: string | null
  caption: string | null
  alt_text: string | null
  taken_on: string | null
  width: number | null
  height: number | null
}

const GOLD = '#C9A84C'
const CREAM = '#F4EFE6'
const DIM = '#DCCFB5'

export type ThumbLabel = 'caption' | 'caption_date' | 'date' | 'none'

export function PublicGallery({
  photos, lodgeName, thumbLabel = 'caption',
}: {
  photos: PublicPhoto[]
  lodgeName: string
  /**
   * What is printed OVER the picture in the grid. The lodge's choice —
   * a band of text is right over "Installation night, 2025" and wrong
   * over twenty portraits, where it covers the faces.
   *
   * Never affects the enlarged view or the alt text: this hides the
   * words from the tile, not from the visitor.
   */
  thumbLabel?: ThumbLabel
}) {
  const [open, setOpen] = useState<number | null>(null)

  /** The line for one tile, or nothing at all. */
  const tileLabel = (p: PublicPhoto): string | null => {
    if (thumbLabel === 'none') return null
    const month = p.taken_on ? formatTaken(p.taken_on) : ''
    if (thumbLabel === 'date') return month || null
    if (thumbLabel === 'caption_date') {
      return [p.caption, month].filter(Boolean).join(' · ') || null
    }
    return p.caption || null
  }

  const describe = (p: PublicPhoto) =>
    p.alt_text || p.caption || `A photograph from ${lodgeName}`

  const step = useCallback((delta: number) => {
    setOpen(current => {
      if (current === null) return null
      // Wraps, because reaching the end of a lightbox and having the
      // arrow key do nothing reads as broken rather than as finished.
      return (current + delta + photos.length) % photos.length
    })
  }, [photos.length])

  /**
   * The keyboard, and the page behind.
   *
   * Escape closes, arrows walk. The body's scroll is locked while it is
   * open — otherwise flicking through photographs on a phone scrolls
   * the page underneath, and closing leaves you somewhere you never
   * navigated to.
   */
  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, step])

  if (!photos.length) return null
  const current = open === null ? null : photos[open]

  return (
    <>
      <div
        style={{
          display: 'grid',
          // Tiles size themselves to the viewport rather than to a fixed
          // column count, so this is one rule instead of four breakpoints.
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: '1rem',
        }}
      >
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setOpen(i)}
            aria-label={`Open photograph: ${describe(photo)}`}
            style={{
              position: 'relative', padding: 0, border: `1px solid ${GOLD}25`,
              background: '#101827', cursor: 'zoom-in', overflow: 'hidden',
              // Reserves the tile's height before the image loads.
              aspectRatio: '4 / 3', display: 'block', width: '100%',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Storage URL, not a static local asset */}
            <img
              src={photo.thumb_url || photo.url}
              alt={describe(photo)}
              loading="lazy"
              decoding="async"
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />

            {tileLabel(photo) && (
              <span
                style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'left',
                  padding: '1.6rem 0.75rem 0.6rem',
                  background: 'linear-gradient(to top, rgba(8,12,20,0.92), rgba(8,12,20,0))',
                  color: CREAM, fontFamily: "'Crimson Pro', Georgia, serif", fontSize: '0.85rem',
                  lineHeight: 1.35,
                }}
              >
                {tileLabel(photo)}
              </span>
            )}
          </button>
        ))}
      </div>

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={describe(current)}
          onClick={() => setOpen(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(6,10,17,0.95)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <button
            onClick={() => setOpen(null)}
            aria-label="Close"
            style={{
              position: 'absolute', top: 12, right: 16, background: 'none', border: 'none',
              color: GOLD, fontSize: '2rem', lineHeight: 1, cursor: 'pointer', padding: '8px 12px',
            }}
          >
            ×
          </button>

          {photos.length > 1 && (
            <>
              <Arrow side="left" onClick={(e) => { e.stopPropagation(); step(-1) }} />
              <Arrow side="right" onClick={(e) => { e.stopPropagation(); step(1) }} />
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded Storage URL, not a static local asset */}
          <img
            src={current.url}
            alt={describe(current)}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 'min(100%, 1200px)', maxHeight: '78vh',
              objectFit: 'contain', display: 'block', cursor: 'default',
            }}
          />

          <div
            onClick={e => e.stopPropagation()}
            style={{ marginTop: '1rem', textAlign: 'center', maxWidth: 640, cursor: 'default' }}
          >
            {current.caption && (
              <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: '1rem', color: CREAM }}>
                {current.caption}
              </div>
            )}
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', color: DIM, marginTop: 6, textTransform: 'uppercase' }}>
              {current.taken_on ? `${formatTaken(current.taken_on)} · ` : ''}
              {(open ?? 0) + 1} of {photos.length}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Arrow({ side, onClick }: { side: 'left' | 'right'; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photograph' : 'Next photograph'}
      style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        [side]: 8, background: 'rgba(8,12,20,0.6)', border: `1px solid ${GOLD}40`,
        color: GOLD, fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer',
        // 44px is the smallest target a thumb reliably hits.
        width: 44, height: 44, borderRadius: '50%',
      }}
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  )
}

/** "June 2025" — a photograph is placed by month, not by day. */
function formatTaken(date: string): string {
  const d = new Date(date + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
