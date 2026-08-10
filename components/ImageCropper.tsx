'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Square image cropper — drag to reposition, slider to zoom.
 *
 * Hand-rolled on a canvas rather than pulling in a cropping library.
 * The whole job is "map a pan/zoom onto drawImage's source rectangle",
 * which is about as much code as configuring a dependency would be, and
 * it keeps a photo-editing library out of a bundle that every brother
 * loads to look at his dues.
 *
 * Exports a JPEG at a fixed size: an avatar is displayed at 84px and
 * smaller, so shipping the 12-megapixel original a phone camera
 * produces wastes the lodge's storage and the brother's data on every
 * page that shows his face.
 */

const OUTPUT_SIZE = 512
const VIEWPORT = 260

export function ImageCropper({
  file,
  onCancel,
  onCropped,
  busy = false,
  shape = 'circle',
}: {
  file: File
  onCancel: () => void
  onCropped: (blob: Blob) => void
  busy?: boolean
  /** Only the preview mask differs — the export is square either way. */
  shape?: 'circle' | 'square'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  // Load the file into an <img> once, and revoke the object URL after —
  // these leak for the life of the document otherwise, and a brother
  // trying three photos would leak all three.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setReady(true)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  /**
   * The scale at which the image exactly covers the square. Everything
   * else is relative to it, so zoom=1 always means "fills the frame"
   * regardless of whether the photo is portrait, landscape or square.
   */
  const coverScale = () => {
    const img = imageRef.current
    if (!img) return 1
    return Math.max(VIEWPORT / img.width, VIEWPORT / img.height)
  }

  /** Keeps the image covering the frame — no blank corners. */
  const clamp = (next: { x: number; y: number }, z: number) => {
    const img = imageRef.current
    if (!img) return next
    const scale = coverScale() * z
    const maxX = Math.max(0, (img.width * scale - VIEWPORT) / 2)
    const maxY = Math.max(0, (img.height * scale - VIEWPORT) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  // Redraw whenever the view changes.
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img || !ready) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scale = coverScale() * zoom
    const w = img.width * scale
    const h = img.height * scale

    ctx.clearRect(0, 0, VIEWPORT, VIEWPORT)
    ctx.fillStyle = '#0A0E1A'
    ctx.fillRect(0, 0, VIEWPORT, VIEWPORT)
    ctx.drawImage(img, (VIEWPORT - w) / 2 + offset.x, (VIEWPORT - h) / 2 + offset.y, w, h)
  }, [zoom, offset, ready])

  const startDrag = (x: number, y: number) => { dragRef.current = { x: x - offset.x, y: y - offset.y } }
  const moveDrag = (x: number, y: number) => {
    if (!dragRef.current) return
    setOffset(clamp({ x: x - dragRef.current.x, y: y - dragRef.current.y }, zoom))
  }
  const endDrag = () => { dragRef.current = null }

  const apply = () => {
    const img = imageRef.current
    if (!img) return
    const out = document.createElement('canvas')
    out.width = OUTPUT_SIZE
    out.height = OUTPUT_SIZE
    const ctx = out.getContext('2d')
    if (!ctx) return

    // Same geometry as the preview, scaled up to the output size, so
    // what he framed is exactly what gets saved.
    const ratio = OUTPUT_SIZE / VIEWPORT
    const scale = coverScale() * zoom * ratio
    const w = img.width * scale
    const h = img.height * scale
    ctx.fillStyle = '#0A0E1A'
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    ctx.drawImage(img, (OUTPUT_SIZE - w) / 2 + offset.x * ratio, (OUTPUT_SIZE - h) / 2 + offset.y * ratio, w, h)

    out.toBlob((blob) => { if (blob) onCropped(blob) }, 'image/jpeg', 0.9)
  }

  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }

  return (
    <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, padding: '1.25rem', maxWidth: VIEWPORT + 40 }}>
      <div style={{ position: 'relative', width: VIEWPORT, height: VIEWPORT, margin: '0 auto', borderRadius: shape === 'circle' ? '50%' : 6, overflow: 'hidden', cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={VIEWPORT}
          height={VIEWPORT}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); startDrag(e.clientX, e.clientY) }}
          onPointerMove={(e) => moveDrag(e.clientX, e.clientY)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ display: 'block', width: VIEWPORT, height: VIEWPORT }}
        />
      </div>

      <p style={{ textAlign: 'center', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', fontSize: '0.85rem', margin: '0.75rem 0 1rem' }}>
        Drag to reposition
      </p>

      <label style={labelStyle} htmlFor="lodgeos-crop-zoom">Zoom</label>
      <input
        id="lodgeos-crop-zoom"
        type="range"
        min={1}
        max={3}
        step={0.01}
        value={zoom}
        onChange={(e) => {
          const next = Number(e.target.value)
          setZoom(next)
          setOffset((o) => clamp(o, next))
        }}
        style={{ width: '100%', accentColor: '#C9A84C' }}
      />

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button onClick={apply} disabled={!ready || busy} className="btn-gold" style={{ flex: 1, fontSize: '0.66rem', opacity: !ready || busy ? 0.6 : 1, cursor: !ready || busy ? 'not-allowed' : 'pointer' }}>
          {busy ? 'Saving...' : 'Save Photo'}
        </button>
        <button onClick={onCancel} disabled={busy} className="btn-outline" style={{ fontSize: '0.66rem', cursor: busy ? 'not-allowed' : 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
