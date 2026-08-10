'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageCropper } from '@/components/ImageCropper'

/**
 * A photo straight off a phone is portrait, and every place this app
 * shows an avatar is a circle — so the old flow uploaded a 4000px
 * portrait and let object-fit crop it to whatever happened to be in
 * the middle, usually a chin. Cropping first means a brother chooses
 * his own framing, and the file that gets stored is 512px instead of
 * several megabytes.
 *
 * The chosen file is held locally until he confirms the crop; nothing
 * is uploaded until then, so cancelling costs nothing and re-cropping
 * an existing photo is just picking it again.
 */

export function AvatarUpload({ currentUrl, initials }: { currentUrl: string | null; initials: string }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [pending, setPending] = useState<File | null>(null)

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

    // Show an instant local preview via object URL while the real
    // upload is in flight, rather than leaving the old photo showing
    // (or a blank state) for the several seconds an upload can take —
    // this is purely visual feedback and gets replaced by the real
    // uploaded URL once the request resolves.
    setPreview(URL.createObjectURL(blob))
    setUploading(true)

    const formData = new FormData()
    // Always a JPEG now, whatever was chosen — the cropper re-encodes.
    formData.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))

    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Upload failed')
      setPending(null)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setPreview(null) // revert to the real (unchanged) photo on failure, rather than leaving a preview of a photo that never actually saved
    } finally {
      setUploading(false)
    }
  }

  const displayUrl = preview || currentUrl

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
      <div style={{
        width: '84px', height: '84px', borderRadius: '50%', overflow: 'hidden',
        background: '#0A0E1A', border: '2px solid rgba(201,168,76,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        opacity: uploading ? 0.5 : 1,
      }}>
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar is a user-uploaded external Supabase Storage URL, not a static local asset next/image is optimized for
          <img src={displayUrl} alt="Profile photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#C9A84C' }}>{initials}</span>
        )}
      </div>
      <div>
        <label style={{
          display: 'inline-block', cursor: uploading ? 'not-allowed' : 'pointer',
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.08em',
          color: '#C9A84C', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
          padding: '7px 14px', borderRadius: '4px', opacity: uploading ? 0.6 : 1,
        }}>
          {uploading ? 'Uploading…' : currentUrl ? 'Change or Crop Photo' : 'Upload Photo'}
          <input
            type="file" accept="image/jpeg,image/png,image/webp"
            onChange={e => { chooseFile(e.target.files?.[0]); e.target.value = '' }}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
        <div style={{ color: '#B8B0A0', fontSize: '0.72rem', marginTop: '6px' }}>JPEG, PNG, or WebP · up to 5MB · you choose the crop</div>
        {error && <div style={{ color: '#EC5B4B', fontSize: '0.72rem', marginTop: '4px' }}>{error}</div>}
      </div>
      </div>

      {pending && (
        <div style={{ marginTop: '1.25rem' }}>
          <ImageCropper
            file={pending}
            busy={uploading}
            onCancel={() => setPending(null)}
            onCropped={handleCropped}
          />
        </div>
      )}
    </div>
  )
}
