'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/lodge/ConfirmDialog'

import { createClient } from '@/lib/supabase/client'
import { notify } from '@/lib/toast'
import { DegreeOptions } from '@/components/DegreeOptions'
import { isPlayable, formatDuration, formatBytes } from '@/lib/documents'
import { UPLOAD_ACCEPT, UPLOAD_FAMILIES, contentTypeFor, formatFor, refusalMessage } from '@/lib/uploads'

const CATEGORIES = ['Degree Materials', 'Minutes', 'Administration', 'Grand Lodge', 'Training', 'Other']

/* The accepted formats live in lib/uploads.ts, which the storage
   bucket's allow-list and /api/documents/record also read. Three gates
   agreeing is the whole point: this one is only a suggestion to the
   file picker, and the bucket refuses an upload before any of our code
   runs. */
const ACCEPT = UPLOAD_ACCEPT

const MAX_SIZE = 500 * 1024 * 1024

/* isPlayable / formatDuration / formatBytes MOVED to lib/documents.ts.
   They were exported from this file, which is a client module — so a
   Server Component importing them received client REFERENCES, and
   calling one threw "Attempted to call isPlayable() from the server".
   The lodge Documents page does exactly that in its row loop, so it
   broke the moment the library had a row in it. They are pure
   functions with no browser dependency and belong in neither half.
   Deliberately NOT re-exported from here: a re-export through a client
   module is still a client reference, which would leave the same trap
   in place for the next caller. */

/**
 * Reads playback length from a media file in the browser, before upload.
 * Resolves null rather than rejecting — duration is a nicety, and a
 * codec the browser can't decode must not block the upload of a file
 * that other brothers may still be able to play.
 */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) return resolve(null)
    const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio')
    const url = URL.createObjectURL(file)
    const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v) }
    el.preload = 'metadata'
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null)
    el.onerror = () => done(null)
    // Don't hang the upload button on a file the browser won't decode.
    setTimeout(() => done(null), 5000)
    el.src = url
  })
}

export function DocumentUploadButton({
  tenantId,
  existing = [],
}: {
  tenantId: string
  /** Current documents, so a new upload can say which one it replaces. */
  existing?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [accessLevel, setAccessLevel] = useState('all')
  // What this upload replaces, if anything. See lib/migrations/032.
  const [supersedesId, setSupersedesId] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const reset = () => { setFile(null); setName(''); setCategory(CATEGORIES[0]); setAccessLevel('all'); setDescription(''); setError(''); setProgress('') }

  /**
   * Uploads straight from the browser to Supabase Storage, then asks
   * the server to record the metadata row.
   *
   * This used to POST the file to /api/documents/upload as form data.
   * That path is capped by Vercel at a 4.5MB request body — well under
   * the 25MB the route claimed to allow, and nowhere near a training
   * video. Going direct removes that ceiling entirely. It is still
   * authorized: migration 007's storage policy checks is_tenant_admin()
   * against the tenant-id folder being written to.
   */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Choose a file first.'); return }
    if (file.size > MAX_SIZE) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(0)}MB. The limit is 500MB.`)
      return
    }

    /**
     * WHAT THIS FILE ACTUALLY IS, decided from its extension.
     *
     * file.type is the operating system's guess, and for Office files
     * it is frequently '' or 'application/octet-stream' — a .pptx on a
     * Windows machine with no Office installed commonly arrives that
     * way. supabase-js would then upload it under a default content
     * type, the bucket's allow-list would refuse it, and the officer
     * would be told his presentation could not be uploaded when
     * nothing was wrong with it.
     */
    const contentType = contentTypeFor(file.name, file.type)
    if (!contentType) { setError(refusalMessage(file.name)); return }

    setUploading(true)
    setError('')
    setProgress('Reading file…')

    try {
      const supabase = createClient()
      const duration = await readDuration(file)

      // Same shape the old server route used: {tenant}/{uuid}-{safe name}.
      // The uuid prevents two uploads of "minutes.pdf" from colliding,
      // and the tenant folder is what storage RLS authorizes against.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${tenantId}/${crypto.randomUUID()}-${safeName}`

      setProgress(file.size > 5 * 1024 * 1024 ? 'Uploading — large files can take a minute…' : 'Uploading…')

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { contentType, upsert: false })

      if (uploadError) throw new Error(uploadError.message)

      setProgress('Saving to the library…')

      const res = await fetch('/api/documents/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          storagePath,
          name: name || file.name.replace(/\.[^.]+$/, ''),
          category,
          accessLevel,
          description,
          supersedesId: supersedesId || null,
          // What was actually stored, not what the machine guessed —
          // the row must describe the object, since it is this value
          // the player and the download route later trust.
          mimeType: contentType,
          fileSize: file.size,
          durationSeconds: duration,
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        // The file landed but the row didn't. Clean up so the bucket
        // doesn't hold an object nothing references.
        await supabase.storage.from('documents').remove([storagePath])
        throw new Error(result.error || 'Could not save the document.')
      }

      reset()
      setOpen(false)
      notify.saved('Document uploaded')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
      setProgress('')
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
              <label style={labelStyle}>File · max 500MB</label>
              <input
                type="file"
                accept={ACCEPT}
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  setError('')
                  if (!f) return
                  /* Refuse it here rather than after the upload has
                     run. "Choose a file, fill in four fields, press
                     Upload, wait, then be told the format is wrong" is
                     the same refusal delivered as late as possible. */
                  if (!contentTypeFor(f.name, f.type)) { setError(refusalMessage(f.name)); return }
                  if (!name) setName(f.name.replace(/\.[^.]+$/, '')) // a sensible name from the filename, still editable
                  // Training material is nearly always what a recording
                  // is for. Read from the table, not from f.type, which
                  // is empty for a .mov on plenty of machines.
                  const kind = formatFor(f.name)?.kind
                  if (kind === 'video' || kind === 'audio') setCategory('Training')
                }}
                style={{ ...inputStyle, padding: '7px 10px' }}
              />
              <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.78rem', color: '#918879', marginTop: 5, lineHeight: 1.45 }}>
                {UPLOAD_FAMILIES.charAt(0).toUpperCase() + UPLOAD_FAMILIES.slice(1)}.
              </div>
              {file && (
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', marginTop: 6 }}>
                  {formatBytes(file.size)} · {file.type || 'unknown type'}
                </div>
              )}
              {/* .mov is what an iPhone produces, and Chrome/Firefox on
                  Android often cannot play its HEVC variant. Accepting
                  it and warning is better than rejecting a file the
                  officer just recorded — but they should know before
                  half the lodge reports a black screen. */}
              {file?.type === 'video/quicktime' && (
                <div style={{ fontSize: '0.75rem', color: '#C9A84C', marginTop: 6, lineHeight: 1.5 }}>
                  QuickTime (.mov) does not play in every browser. Converting to MP4 first will reach
                  more brothers.
                </div>
              )}
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
                  <DegreeOptions mode="access" />
                </select>
              </div>
            </div>

            {/* VERSIONING, at the only moment anyone knows the answer.
                Every document library converges on Bylaws.pdf beside
                Bylaws_v2.pdf beside Bylaws_v3_FINAL_final.pdf, with
                nothing to say which governs. The uploader knows for
                certain what he is replacing; asking him here costs one
                dropdown and saves the guess forever. */}
            {existing.length > 0 && (
              <div>
                <label style={labelStyle}>Replaces an existing document (optional)</label>
                <select value={supersedesId} onChange={e => setSupersedesId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">— this is a new document —</option>
                  {existing.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <p style={{ fontSize: '0.78rem', color: '#918879', fontStyle: 'italic', marginTop: 4 }}>
                  The old copy is kept but stops being the current one — it collapses under this in
                  the library rather than sitting beside it.
                </p>
              </div>
            )}

            <div>
              <label style={labelStyle}>Description (optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {error && <div style={{ color: '#EC5B4B', fontSize: '0.78rem' }}>{error}</div>}
            {progress && !error && (
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#C9A84C', letterSpacing: '0.08em' }}>
                {progress}
              </div>
            )}

            <button type="submit" disabled={uploading} className="btn-gold" style={{ opacity: uploading ? 0.6 : 1 }}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        </div>
      )}
    </>
  )
}

/**
 * Inline player for video/audio documents.
 *
 * Fetches the same short-lived signed URL the download link uses, so
 * playback goes through the identical degree-based access check —
 * there is no second, weaker path to the file just because it happens
 * to be a video.
 *
 * The URL is signed for 5 minutes server-side. That is ample to START
 * playback, and browsers keep streaming from an already-open connection
 * past expiry, but seeking far ahead in a long recording after the
 * window closes can stall. Reopening the player re-signs, which is why
 * the control stays available while playing.
 */
export function DocumentPlayer({
  documentId,
  mimeType,
  name,
}: {
  documentId: string
  mimeType: string
  name: string
}) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const open = async () => {
    setLoading(true)
    setError('')
    try {
      // ?inline=1 — a video cannot be streamed from a URL signed
      // as an attachment, which is what the plain call now returns.
      const res = await fetch(`/api/documents/${documentId}/download?inline=1`)
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Could not open this recording')
      setUrl(result.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isVideo = mimeType.startsWith('video/')

  if (!url) {
    return (
      <span>
        <button
          onClick={open}
          disabled={loading}
          style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#0A0E1A',
            background: '#C9A84C', border: 'none', padding: '4px 12px',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '…' : '▶ Play'}
        </button>
        {error && <div style={{ color: '#EC5B4B', fontSize: '0.6rem', marginTop: 4 }}>{error}</div>}
      </span>
    )
  }

  return (
    /* width:100% with minWidth:0, NOT minWidth:260. The player sits in
       the row's action strip, which is indented to line up under the
       text column — 63px of indent plus a 260px floor is 323px, and a
       small phone is 320px wide. It overflowed by exactly 3px plus the
       padding, which is the sort of bug that only ever appears on the
       one device nobody tests on. */
    <div style={{ width: '100%', minWidth: 0, maxWidth: 420 }}>
      {isVideo ? (
        <video
          src={url}
          controls
          preload="metadata"
          style={{ width: '100%', borderRadius: 4, background: '#000', display: 'block' }}
        >
          Your browser cannot play this format.
        </video>
      ) : (
        <audio src={url} controls style={{ width: '100%' }} aria-label={name}>
          Your browser cannot play this format.
        </audio>
      )}
      <button
        onClick={() => setUrl('')}
        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#B8B0A0', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}
      >
        Close
      </button>
    </div>
  )
}

/**
 * Download — and it now genuinely downloads.
 *
 * THIS BUTTON SAID "VIEW" AND DID TWO DIFFERENT THINGS. The signed URL
 * was left plain, so the browser decided by content type: a PDF opened
 * in a tab, a PowerPoint dropped into the downloads folder. One label,
 * two behaviours, depending on a file property nobody can see from the
 * shelf. And what it saved was the storage object's name — a uuid and
 * a mangled filename — not what the lodge calls the document.
 *
 * The route now signs with Content-Disposition: attachment and the
 * document's own name, so every format behaves the same way and the
 * file arrives called what it is called here.
 */
export function DocumentDownloadLink({ documentId, label = 'Download' }: { documentId: string; label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/documents/${documentId}/download`)
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Could not open document')
      /**
       * An anchor rather than window.open. An attachment URL opened in
       * a new tab downloads and then leaves an empty tab sitting there
       * — on a phone that is a whole blank screen the brother has to
       * dismiss. A clicked anchor starts the same download and the page
       * he was reading never moves.
       *
       * Signed URL is short-lived (5 min, server-side), so it is used
       * immediately and stored nowhere.
       */
      const a = document.createElement('a')
      a.href = result.url
      a.rel = 'noopener'
      if (result.filename) a.download = result.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
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
      {error && <div style={{ color: '#EC5B4B', fontSize: '0.6rem', marginTop: '4px' }}>{error}</div>}
    </span>
  )
}

/**
 * Delete control for a single document. Requires the document's name to
 * be typed before it enables — this destroys the stored file, and there
 * is no recycle bin behind it.
 */
export function DocumentDeleteButton({
  documentId,
  documentName,
}: {
  documentId: string
  documentName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Could not delete this document.')
        return
      }
      setOpen(false)
      notify.saved('Document deleted')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Could not delete this document.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setError(''); setOpen(true) }}
        title="Delete document"
        aria-label={`Delete ${documentName}`}
        style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#EC5B4B',
          background: 'transparent', border: '1px solid rgba(231,76,60,0.25)',
          padding: '4px 10px', cursor: 'pointer', marginLeft: '6px',
        }}
      >
        Delete
      </button>

      <ConfirmDialog
        open={open}
        title="Delete this document?"
        confirmLabel="Delete Permanently"
        requireTyping={documentName}
        busy={busy}
        error={error}
        onCancel={() => { if (!busy) { setOpen(false); setError('') } }}
        onConfirm={remove}
        body={
          <>
            <p style={{ marginBottom: '0.9rem' }}>
              <strong style={{ color: '#F5F0E8' }}>{documentName}</strong> will be removed from the
              library and the stored file will be destroyed.
            </p>
            <p style={{ margin: 0 }}>
              This cannot be undone. If this is the lodge&apos;s only copy, download it first.
            </p>
          </>
        }
      />
    </>
  )
}
