'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AvatarUpload({ currentUrl, initials }: { currentUrl: string | null; initials: string }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')

    const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
    if (!ALLOWED.has(file.type)) { setError('Please choose a JPEG, PNG, or WebP image.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB.'); return }

    // Show an instant local preview via object URL while the real
    // upload is in flight, rather than leaving the old photo showing
    // (or a blank state) for the several seconds an upload can take —
    // this is purely visual feedback and gets replaced by the real
    // uploaded URL once the request resolves.
    setPreview(URL.createObjectURL(file))
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Upload failed')
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
          {uploading ? 'Uploading…' : currentUrl ? 'Change Photo' : 'Upload Photo'}
          <input
            type="file" accept="image/jpeg,image/png,image/webp"
            onChange={e => handleFile(e.target.files?.[0])}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
        <div style={{ color: '#B8B0A0', fontSize: '0.72rem', marginTop: '6px' }}>JPEG, PNG, or WebP · up to 5MB</div>
        {error && <div style={{ color: '#E74C3C', fontSize: '0.72rem', marginTop: '4px' }}>{error}</div>}
      </div>
    </div>
  )
}
