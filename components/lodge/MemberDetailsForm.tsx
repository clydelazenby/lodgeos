'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { DegreeOptions } from '@/components/DegreeOptions'
import { OfficeSelect } from '@/components/lodge/OfficeSelect'
import { callApi, errorMessage } from '@/lib/clientFetch'
import { notify } from '@/lib/toast'

/**
 * The Secretary's register entry for one brother, editable where he is
 * already standing.
 *
 * His office and his degree were settable only from dropdowns in the
 * roster table; his address and date of birth were settable nowhere at
 * all. So the man's own page showed six things you might want to
 * correct, as plain text, and you had to leave it to change two of them.
 *
 * ONE FORM, ONE SAVE, rather than the per-field optimistic writes used
 * for the permission toggles. A toggle is one decision and should feel
 * instant; a register entry is a sitting-down job where you fix the
 * address and the phone and the office together, and eleven separate
 * saves would be eleven chances to half-finish.
 *
 * His EMAIL is shown and not editable. It is his sign-in — changing it
 * from here would lock him out with no warning and no way for him to
 * find out why. The route refuses it too; this only explains why.
 */

type Fields = {
  first_name: string
  last_name: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  date_of_birth: string
  degree: string
  lodge_role: string
  dues_status: string
  joined_date: string
}

export function MemberDetailsForm({
  tenantId, memberId, email, initial, canEdit,
}: {
  tenantId: string
  memberId: string
  email: string | null
  initial: Fields
  /** The 'roster' capability. The route is the authority. */
  canEdit: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<Fields>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [warning, setWarning] = useState('')

  const set = (k: keyof Fields, v: string) => {
    setForm(p => ({ ...p, [k]: v }))
    setSaved(false)
  }

  // Only what actually differs is sent. A form that posts every field
  // every time makes the audit line say he changed eleven things when
  // he corrected a postcode.
  const dirty = (Object.keys(form) as (keyof Fields)[]).filter(k => form[k] !== initial[k])

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    setWarning('')
    try {
      const fields: Record<string, string> = {}
      for (const k of dirty) fields[k] = form[k]
      const data = await callApi('/api/members/details', {
        method: 'PATCH',
        body: { tenantId, memberId, fields },
      })
      setSaved(true)
      // Named, so it is obvious WHAT was written — "Saved" beside an
      // eleven-field form leaves an officer wondering which of them.
      notify.saved(
        dirty.length === 1
          ? `${dirty[0].replace(/_/g, ' ')} saved`
          : `${dirty.length} details saved`
      )
      if (data.warning) { setWarning(data.warning); notify.info(data.warning) }
      router.refresh()
    } catch (e) {
      const message = errorMessage(e, 'Those details could not be saved.')
      setError(message)
      notify.error(message)
    } finally {
      setSaving(false)
    }
  }

  const label: React.CSSProperties = {
    fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.12em',
    color: T.inkFaint, textTransform: 'uppercase', marginBottom: '4px', display: 'block',
  }
  const input: React.CSSProperties = {
    width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink,
    padding: '9px 12px', borderRadius: '6px', fontFamily: T.body,
    // 16px on the rendered control stops iOS zooming the page on focus.
    fontSize: '16px', outline: 'none', boxSizing: 'border-box',
  }

  /**
   * A FUNCTION, NOT A COMPONENT, and called as `{field(...)}`.
   *
   * Declaring it as a component inside this one gives it a new identity
   * on every render, so React unmounts and remounts each input — which
   * on a text field means losing focus after a single keystroke. The
   * call form inlines the JSX into this component's tree instead, and
   * the inputs keep their identity.
   */
  const field = (k: keyof Fields, text: string, type = 'text', placeholder?: string) => (
    <div key={k}>
      <label style={label} htmlFor={`f-${k}`}>{text}</label>
      <input
        id={`f-${k}`}
        type={type}
        value={form[k]}
        placeholder={placeholder}
        disabled={!canEdit}
        onChange={e => set(k, e.target.value)}
        style={{ ...input, opacity: canEdit ? 1 : 0.6 }}
      />
    </div>
  )

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.25rem' }}>
      <div style={{ ...label, color: T.gold, letterSpacing: '0.14em' }}>Register entry</div>
      <p style={{ fontFamily: T.body, fontSize: '0.86rem', color: T.inkFaint, marginTop: 0, marginBottom: '1.1rem' }}>
        His particulars, his office and his degree. {canEdit
          ? 'Change what you need and save once.'
          : 'The Secretary’s office keeps this; you can read it here.'}
      </p>

      {error && <Note tone="danger">{error}</Note>}
      {warning && <Note tone="info">{warning}</Note>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.9rem' }}>
        {field('first_name', 'First name')}
        {field('last_name', 'Last name')}

        <div>
          <span style={label}>Email</span>
          <div style={{ ...input, opacity: 0.6, display: 'flex', alignItems: 'center', minHeight: 40, fontSize: '0.88rem' }}>
            {email || '—'}
          </div>
          {/* Not an oversight. See the header. */}
          <div style={{ fontFamily: T.body, fontSize: '0.78rem', color: T.inkFainter, marginTop: '3px' }}>
            His sign-in. Changing it would lock him out — invite him again instead.
          </div>
        </div>

        {field('phone', 'Phone', 'tel')}

        <div>
          <label style={label} htmlFor="f-office">Office</label>
          <OfficeSelect
            value={form.lodge_role}
            onChange={next => set('lodge_role', next)}
            ariaLabel="Lodge office"
            style={{ ...input, cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.6 }}
          />
          {/* An office is not decoration: it seats him in the Lodge Room
              and it carries whatever the Permissions page gave the chair. */}
          <div style={{ fontFamily: T.body, fontSize: '0.78rem', color: T.inkFainter, marginTop: '3px' }}>
            Seats him in the Lodge Room, and carries whatever that chair has been given.
          </div>
        </div>

        <div>
          <label style={label} htmlFor="f-degree">Degree</label>
          <select
            id="f-degree"
            value={form.degree}
            disabled={!canEdit}
            onChange={e => set('degree', e.target.value)}
            style={{ ...input, cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.6 }}
          >
            <DegreeOptions />
          </select>
        </div>

        <div>
          <label style={label} htmlFor="f-dues">Dues status</label>
          <select
            id="f-dues"
            value={form.dues_status}
            disabled={!canEdit}
            onChange={e => set('dues_status', e.target.value)}
            style={{ ...input, cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.6 }}
          >
            <option value="paid">Paid</option>
            <option value="due">Due</option>
            <option value="exempt">Exempt</option>
          </select>
        </div>

        {field('joined_date', 'Member since', 'date')}
        {field('date_of_birth', 'Date of birth', 'date')}
        {field('address', 'Address', 'text', '123 Main St')}
        {field('city', 'City')}
        {field('state', 'State')}
        {field('zip', 'ZIP')}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '1.1rem', flexWrap: 'wrap' }}>
          <button
            onClick={save}
            disabled={saving || dirty.length === 0}
            style={{
              background: T.gold, color: T.bg, border: 'none', padding: '10px 24px', borderRadius: '6px',
              fontFamily: T.display, fontSize: '0.82rem', fontWeight: 600,
              cursor: saving || dirty.length === 0 ? 'not-allowed' : 'pointer',
              opacity: saving || dirty.length === 0 ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save details'}
          </button>
          {/* Says what will be written, so nobody saves wondering. */}
          {dirty.length > 0 && !saving && (
            <span style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.08em', color: T.inkFainter }}>
              {dirty.length} CHANGE{dirty.length === 1 ? '' : 'S'} UNSAVED
            </span>
          )}
          {saved && dirty.length === 0 && (
            <span className="lodgeos-stage-in" style={{ color: T.success, fontFamily: T.mono, fontSize: '11px' }}>✓ Saved</span>
          )}
        </div>
      )}
    </div>
  )
}

function Note({ tone, children }: { tone: 'danger' | 'info'; children: React.ReactNode }) {
  const c = tone === 'danger'
    ? { bg: T.dangerDim, border: 'rgba(231,76,60,0.3)', text: T.danger }
    : { bg: T.infoDim, border: 'rgba(123,184,212,0.3)', text: T.info }
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem',
      fontFamily: T.body, fontSize: '0.9rem',
    }}>
      {children}
    </div>
  )
}
