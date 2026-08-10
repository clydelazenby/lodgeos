'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEGREE_TITLE, STARTER_OUTLINE, type CurriculumDegree, type Step } from '@/lib/curriculum'
import { DEGREES } from '@/lib/degrees'

/** Blue Lodge first — it is what anyone opens this page for. */
const GROUP_ORDER = ['Blue Lodge', 'York Rite', 'Scottish Rite', 'Shrine']
import { callApi, errorMessage } from '@/lib/clientFetch'

/**
 * Writing down what a degree actually requires.
 *
 * The lodge already recorded that a candidate was conferred on one date
 * and passed his proficiency on another, with nothing in between — so
 * the only answer to "how is he getting on?" was "no progress in 45
 * days". This is where the middle gets written.
 *
 * Per lodge, and the starter outline is offered rather than imposed:
 * jurisdictions differ on what is required, in what order, and what is
 * merely customary. An outline written into every lodge at signup would
 * be wrong for most of them and would carry the app's authority while
 * being wrong.
 */
export function CurriculumEditor({
  tenantId,
  steps,
  documents,
  canEdit,
}: {
  tenantId: string
  steps: Step[]
  documents: { id: string; name: string; category: string }[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [degree, setDegree] = useState<CurriculumDegree>('EA')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', description: '', documentId: '', required: true })

  const forDegree = steps
    .filter((s) => s.degree === degree)
    .sort((a, b) => a.sort_order - b.sort_order)

  const call = async (method: string, body: any) => {
    setBusy(true)
    setError('')
    try {
      // callApi retries once on a network-level failure and turns
      // Safari's bare "Load failed" into a sentence that says what
      // happened and whether anything was saved. See lib/clientFetch.
      await callApi('/api/curriculum', { method, body: { tenantId, degree, ...body } })
      router.refresh()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async () => {
    if (!draft.title.trim()) return
    const ok = await call('POST', draft)
    if (ok) {
      setDraft({ title: '', description: '', documentId: '', required: true })
      setAdding(false)
    }
  }

  const label = (t: string) => (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0', marginBottom: 4 }}>{t}</div>
  )

  const input: React.CSSProperties = {
    width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)',
    color: '#F5F0E8', padding: '9px 11px', borderRadius: 4,
    fontFamily: 'Crimson Pro, serif', fontSize: '16px',
  }

  return (
    <div>
      {/* A DROPDOWN, NOT SEVENTEEN BUTTONS. Blue Lodge first, then the
          appendant bodies grouped as they actually are — a flat row of
          seventeen chips is a wall, and the three anyone touches weekly
          would be lost in it. */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0', display: 'block', marginBottom: 4 }}>
          DEGREE
        </label>
        <select
          value={degree}
          onChange={(e) => setDegree(e.target.value)}
          style={{ ...input, maxWidth: 340, fontSize: '0.95rem', cursor: 'pointer' }}
        >
          {GROUP_ORDER.map((group) => (
            <optgroup key={group} label={group}>
              {DEGREES.filter((d) => d.group === group).map((d) => {
                const n = steps.filter((s) => s.degree === d.value).length
                return (
                  <option key={d.value} value={d.value}>
                    {d.label}{n ? ` — ${n} steps` : ''}
                  </option>
                )
              })}
            </optgroup>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', color: '#EC5B4B', padding: '9px 12px', borderRadius: 4, fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <div className="data-box">
        <div className="data-box-head">
          <span>{DEGREE_TITLE[degree]}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
            {forDegree.filter((s) => s.required).length} required
          </span>
        </div>

        {forDegree.length === 0 ? (
          <div style={{ padding: '2.5rem 1.4rem', textAlign: 'center' }}>
            <p style={{ color: '#B8B0A0', fontStyle: 'italic', fontFamily: 'Crimson Pro, serif', marginBottom: '1rem' }}>
              Nothing written down for the {DEGREE_TITLE[degree]} degree yet. A candidate sees a flat
              library and has to work out the order for himself.
            </p>
            {canEdit && (STARTER_OUTLINE[degree] ? (
              <>
                <button onClick={() => call('POST', { action: 'seed' })} disabled={busy} className="btn-gold" style={{ fontSize: '0.68rem' }}>
                  {busy ? 'Working…' : 'Start from the standard outline'}
                </button>
                <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.85rem', color: '#918879', margin: '0.8rem 0 0' }}>
                  A conventional set of steps to edit, not a rule. Your jurisdiction decides what is
                  required and in what order — change, remove and add freely.
                </p>
              </>
            ) : (
              /* No outline beyond the Blue Lodge, on purpose: the app
                 has no business inventing what the appendant bodies
                 require. Those steps are the lodge's to write. */
              <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.9rem', color: '#918879', margin: 0 }}>
                There is no standard outline for this degree — the app does not presume to know what
                the appendant bodies ask. Add the steps below as your lodge mentors them.
              </p>
            ))}
          </div>
        ) : (
          forDegree.map((s, i) => {
            const doc = documents.find((d) => d.id === s.document_id)
            return (
              <div key={s.id} style={{ padding: '0.85rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', gap: '0.9rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#918879', minWidth: 22, paddingTop: 3 }}>
                  {i + 1}
                </span>

                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem', color: '#F5F0E8' }}>
                    {s.title}
                    {!s.required && (
                      <span className="pill pill-new" style={{ marginLeft: 8 }}>Optional</span>
                    )}
                  </div>
                  {s.description && (
                    <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: '#B8B0A0', marginTop: 2 }}>
                      {s.description}
                    </div>
                  )}
                  {doc && (
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', marginTop: 4 }}>
                      📄 {doc.name}
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button onClick={() => call('PATCH', { stepId: s.id, move: 'up' })} disabled={busy || i === 0}
                      aria-label="Move up" title="Move up"
                      style={{ background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', cursor: 'pointer', borderRadius: 3, padding: '4px 8px', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                    <button onClick={() => call('PATCH', { stepId: s.id, move: 'down' })} disabled={busy || i === forDegree.length - 1}
                      aria-label="Move down" title="Move down"
                      style={{ background: 'none', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', cursor: 'pointer', borderRadius: 3, padding: '4px 8px', opacity: i === forDegree.length - 1 ? 0.3 : 1 }}>↓</button>
                    <select
                      value={s.document_id ?? ''}
                      onChange={(e) => call('PATCH', { stepId: s.id, documentId: e.target.value })}
                      aria-label={`Material for ${s.title}`}
                      style={{ background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#B8B0A0', borderRadius: 3, padding: '4px 6px', fontSize: '0.7rem', maxWidth: 150 }}
                    >
                      <option value="">— no material —</option>
                      {documents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <button onClick={() => call('DELETE', { stepId: s.id })} disabled={busy}
                      aria-label={`Remove ${s.title}`}
                      style={{ background: 'none', border: '1px solid rgba(231,76,60,0.25)', color: '#EC5B4B', cursor: 'pointer', borderRadius: 3, padding: '4px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem' }}>✕</button>
                  </div>
                )}
              </div>
            )
          })
        )}

        {canEdit && (
          <div style={{ padding: '1rem 1.4rem' }}>
            {adding ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <div>{label('STEP')}<input value={draft.title} onChange={(e) => setDraft(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Catechism — second section" style={input} /></div>
                <div>{label('WHAT IT MEANS')}<input value={draft.description} onChange={(e) => setDraft(p => ({ ...p, description: e.target.value }))} placeholder="Optional — a line for the candidate" style={input} /></div>
                <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    {label('MATERIAL')}
                    <select value={draft.documentId} onChange={(e) => setDraft(p => ({ ...p, documentId: e.target.value }))} style={{ ...input, fontSize: '0.85rem' }}>
                      <option value="">— none —</option>
                      {documents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', paddingBottom: 9 }}>
                    <input type="checkbox" checked={draft.required} onChange={(e) => setDraft(p => ({ ...p, required: e.target.checked }))} style={{ accentColor: '#C9A84C' }} />
                    <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: '#F5F0E8' }}>Required</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button onClick={add} disabled={busy || !draft.title.trim()} className="btn-gold" style={{ fontSize: '0.65rem' }}>Add Step</button>
                  <button onClick={() => setAdding(false)} disabled={busy} style={{ background: 'transparent', border: '1px solid rgba(184,176,160,0.25)', color: '#B8B0A0', padding: '9px 16px', borderRadius: 4, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.7rem' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} style={{ background: 'transparent', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', padding: '9px 16px', borderRadius: 4, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.1em' }}>
                + ADD A STEP
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
