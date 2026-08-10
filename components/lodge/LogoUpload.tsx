'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageCropper } from '@/components/ImageCropper'

/**
 * The lodge's crest.
 *
 * It heads every email the lodge sends (lib/email/layout.ts) and there
 * was previously no way to set one — logo_url existed on the tenants
 * row and in the super-admin editor, with no upload behind it, so it
 * was null everywhere and the stationery fell back to a text header.
 *
 * Cropped before upload for the same reasons as an avatar: a crest
 * scanned or exported from a design tool arrives with whatever margins
 * it happened to have, and email clients will not fix that for you.
 */
export function LogoUpload({
  tenantId,
  currentUrl,
  onUploaded,
}: {
  tenantId: string
  currentUrl: string | null
  /**
   * The settings page holds the tenant row in local state and saves it
   * wholesale. Without this, uploading a crest would write logo_url on
   * the server while the page's copy stayed null — and the next "Save
   * Branding" would write that null straight back over the crest that
   * had just been uploaded.
   */
  onUploaded?: (logoUrl: string) => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const chooseFile = (file: File | undefined) => {
    if (!file) return
    setError('')
    const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
    if (!ALLOWED.has(file.type)) { setError('Please choose a JPEG, PNG, or WebP image.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB.'); return }
    setPending(file)
  }

  const handleCropped = async (blob: Blob) => {
    setError('')
    setPreview(URL.createObjectURL(blob))
    setUploading(true)

    const formData = new FormData()
    formData.append('file', new File([blob], 'crest.jpg', { type: 'image/jpeg' }))
    formData.append('tenantId', tenantId)

    try {
      const res = await fetch('/api/lodge/logo', { method: 'POST', body: formData })
      const raw = await res.text()
      let result: any = null
      try { result = raw ? JSON.parse(raw) : null } catch { /* handled below */ }
      if (!res.ok) throw new Error(result?.error || `Upload failed (${res.status})`)
      setPending(null)
      if (result?.logoUrl) onUploaded?.(result.logoUrl)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const displayUrl = preview || currentUrl

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{
          width: 96, height: 96, background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, overflow: 'hidden', opacity: uploading ? 0.5 : 1,
        }}>
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded Supabase Storage URL, not a static asset
            <img src={displayUrl} alt="Lodge crest" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.15em', color: 'rgba(184,176,160,0.5)', textAlign: 'center', padding: 8 }}>
              NO CREST
            </span>
          )}
        </div>

        <div>
          <label style={{
            display: 'inline-block', cursor: uploading ? 'not-allowed' : 'pointer',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.08em',
            color: '#C9A84C', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
            padding: '7px 14px', borderRadius: 4, opacity: uploading ? 0.6 : 1,
          }}>
            {uploading ? 'Uploading…' : currentUrl ? 'Change or Crop Crest' : 'Upload Crest'}
            <input
              type="file" accept="image/jpeg,image/png,image/webp"
              onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = '' }}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
          <div style={{ color: '#B8B0A0', fontSize: '0.72rem', marginTop: 6 }}>
            Shown at the top of every email the lodge sends.
          </div>
          {error && <div style={{ color: '#EC5B4B', fontSize: '0.72rem', marginTop: 4 }}>{error}</div>}
        </div>
      </div>

      {pending && (
        <div style={{ marginTop: '1.25rem' }}>
          {/* 320px, not the 512 an avatar gets.
              The crest is rendered at exactly 120px in the email header
              (lib/email/layout.ts) and is displayed nowhere else, so 320
              still covers a 2.6x retina screen with room to spare. At
              512/q0.9 it came out at 165KB — the same picture downloaded
              again by every brother on every notice the lodge sends, on
              whatever signal he happens to have.

              Measured through Chromium's own JPEG encoder on a
              crest-like test image: 65% smaller, which puts the current
              165KB crest near 57KB. A photographed or scanned crest
              should do better still, since downscaling throws away more
              from a photograph than from flat artwork. No visible
              difference at the 120px it is actually displayed at. */}
          <ImageCropper
            file={pending}
            busy={uploading}
            shape="square"
            outputSize={320}
            quality={0.82}
            onCancel={() => setPending(null)}
            onCropped={handleCropped}
          />
        </div>
      )}
    </div>
  )
}
