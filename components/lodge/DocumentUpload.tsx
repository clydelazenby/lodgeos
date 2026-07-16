'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Degree Materials', 'Minutes', 'Administration', 'Grand Lodge', 'Other']

export function DocumentUploadButton({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [accessLevel, setAccessLevel] = useState('all')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setFile(null); setName(''); setCategory(CATEGORIES[0]); setAccessLevel('all'); setDescription(''); setError('') }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Choose a file first.'); return }
    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('tenantId', tenantId)
    formData.append('name', name || file.name)
    formData.append('category', category)
    formData.append('accessLevel', accessLevel)
    formData.append('description', description)

    try {
      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Upload failed')
      reset()
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const inputStyle = { width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '9px 12px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', outline: 'none', borderRadius: '4px', boxSizing: 'border-box' as const }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.15em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '4px', display: 'block' }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-gold" style={{ fontSize: '0.68rem' }}>+ Upload Document</button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <form onSubmit={submit} style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '8px', padding: '1.75rem', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#F5F0E8' }}>Upload Document</span>
              <button type="button" onClick={() => { reset(); setOpen(false) }} style={{ background: 'none', border: 'none', color: '#B8B0A0', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
            </div>

            <div>
              <label style={labelStyle}>File (PDF, Word, or image · max 25MB)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  if (f && !name) setName(f.name.replace(/\.[^.]+$/, '')) // pre-fill a sensible name from the filename, still editable
                }}
                style={{ ...inputStyle, padding: '7px 10px' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Display Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 2026 Bylaws" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Access Level</label>
                <select value={accessLevel} onChange={e => setAccessLevel(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="all">All Brothers</option>
                  <option value="EA">EA and above</option>
                  <option value="FC">FC and above</option>
                  <option value="MM">Master Mason only</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description (optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {error && <div style={{ color: '#E74C3C', fontSize: '0.78rem' }}>{error}</div>}

            <button type="submit" disabled={uploading} className="btn-gold" style={{ opacity: uploading ? 0.6 : 1 }}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        </div>
      )}
    </>
  )
}

export function DocumentDownloadLink({ documentId, label = 'View' }: { documentId: string; label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/documents/${documentId}/download`)
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Could not open document')
      // Signed URL is short-lived (5 min, set server-side) — open
      // immediately rather than storing it anywhere, since by design
      // it's meant to be used once and expire quickly.
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <span>
      <button
        onClick={download}
        disabled={loading}
        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', padding: '4px 10px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
      >
        {loading ? '...' : label}
      </button>
      {error && <div style={{ color: '#E74C3C', fontSize: '0.6rem', marginTop: '4px' }}>{error}</div>}
    </span>
  )
}
