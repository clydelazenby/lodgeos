'use client'

import { useState } from 'react'
import { T } from '@/lib/designTokens'

/**
 * Roster import from Excel or CSV.
 *
 * PARSING HAPPENS IN THE BROWSER
 *
 * A .xlsx is a zip archive; posting one to the server would run into
 * Vercel's 4.5MB request-body cap and force the API to handle binaries.
 * The sheet is read here and only validated JSON rows cross the wire.
 *
 * SheetJS is pinned to 0.20.3 FROM THE VENDOR'S OWN CDN, not npm.
 * SheetJS stopped publishing to npm at 0.18.5, which still carries two
 * unpatched advisories — prototype pollution (CVE-2023-30533, fixed in
 * 0.19.3) and a ReDoS (CVE-2024-22363, fixed in 0.20.2). Since this
 * parses files a secretary was handed by someone else, running the
 * patched build matters. See the xlsx entry in package.json.
 */

type Parsed = {
  row: number
  firstName?: string
  lastName?: string
  email?: string
  degree?: string
  lodgeRole?: string
  tenantRole?: string
  phone?: string
}

type Report = {
  rowsRead: number
  toImport: number
  alreadyOnRoster: number
  skipped: number
  preview: { name: string; email: string; degree: string; lodgeRole: string | null; tenantRole: string }[]
  warnings: string[]
}

/**
 * Column matching is deliberately forgiving. A real lodge roster says
 * "First Name", "FIRST", "Given Name" or "first_name" depending on who
 * built the sheet, and rejecting a file over a header spelling is a
 * pointless obstacle. Order does not matter either — headers are read
 * by name.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  firstName: ['first name', 'firstname', 'first', 'given name', 'first_name'],
  lastName: ['last name', 'lastname', 'last', 'surname', 'family name', 'last_name'],
  email: ['email', 'email address', 'e-mail', 'mail', 'email_address'],
  degree: ['degree', 'masonic degree', 'rank'],
  lodgeRole: ['lodge role', 'office', 'station', 'title', 'lodge_role', 'position'],
  tenantRole: ['access', 'access level', 'portal access', 'role', 'tenant role', 'permission'],
  phone: ['phone', 'phone number', 'mobile', 'cell', 'telephone'],
}

function matchField(header: string): string | null {
  const h = header.trim().toLowerCase()
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h)) return field
  }
  return null
}

export function MemberImport({ tenantId, onImported }: { tenantId: string; onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Parsed[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [sendInvites, setSendInvites] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [unmatched, setUnmatched] = useState<string[]>([])

  const reset = () => {
    setFileName(''); setRows([]); setReport(null); setError(''); setDone(''); setUnmatched([])
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    reset()
    setFileName(file.name)
    setBusy(true)

    try {
      // Dynamic import: SheetJS is ~800KB and only a secretary doing an
      // import ever needs it. Loading it lazily keeps it out of the
      // bundle every other officer downloads.
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]

      if (!sheet) throw new Error('That file has no readable sheet.')

      // header:1 gives raw arrays so the header row can be matched by
      // alias rather than trusting exact key names.
      const grid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })
      if (grid.length < 2) throw new Error('That sheet needs a header row and at least one brother.')

      const headers = (grid[0] as any[]).map((h) => String(h ?? ''))
      const mapping: (string | null)[] = headers.map(matchField)

      const unknown = headers.filter((h, i) => h.trim() && !mapping[i])
      setUnmatched(unknown)

      if (!mapping.includes('email')) {
        throw new Error(
          `No email column found. Headers read: ${headers.filter(Boolean).join(', ') || '(none)'}. ` +
          'One column must be named Email.'
        )
      }

      const parsed: Parsed[] = []
      for (let r = 1; r < grid.length; r++) {
        const cells = grid[r] as any[]
        if (!cells || cells.every((c) => String(c ?? '').trim() === '')) continue
        const entry: Parsed = { row: r + 1 } // 1-indexed, header is row 1
        mapping.forEach((field, i) => {
          if (field) (entry as any)[field] = String(cells[i] ?? '').trim()
        })
        parsed.push(entry)
      }

      setRows(parsed)
    } catch (err: any) {
      setError(err?.message || 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  const send = async (dryRun: boolean) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, rows, dryRun, sendInvites }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Import failed.')
        if (result.warnings?.length) {
          setReport({ rowsRead: 0, toImport: 0, alreadyOnRoster: 0, skipped: 0, preview: [], warnings: result.warnings })
        }
        return
      }

      if (dryRun) {
        setReport(result)
      } else {
        setDone(
          `Added ${result.imported} ${result.imported === 1 ? 'brother' : 'brothers'}.` +
          (result.invited ? ` ${result.invited} invitation ${result.invited === 1 ? 'email' : 'emails'} sent.` : '') +
          (result.alreadyOnRoster ? ` ${result.alreadyOnRoster} already on the roster.` : '') +
          (result.failed ? ` ${result.failed} failed.` : '')
        )
        setReport(null)
        setRows([])
        setFileName('')
        onImported?.()
      }
    } catch (err: any) {
      setError(err?.message || 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const mono = {
    fontFamily: T.mono, fontSize: '0.6rem', letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  }
  const ghost = {
    ...mono, background: 'transparent', border: `1px solid ${T.goldBorder}`,
    color: T.gold, padding: '10px 18px', borderRadius: 4, cursor: 'pointer',
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={ghost}>
        ↑ Import Roster
      </button>
    )
  }

  return (
    <div className="data-box" style={{ padding: '1.5rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ ...mono, color: T.gold }}>Import Roster</span>
        <button onClick={() => { setOpen(false); reset() }} aria-label="Close"
          style={{ background: 'transparent', border: 'none', color: T.inkFaint, cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
      </div>

      <p style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, lineHeight: 1.7, marginTop: 0, marginBottom: '1.25rem' }}>
        Upload the lodge roster as an Excel workbook (.xlsx) or CSV. Column order doesn&apos;t matter —
        columns are matched by heading.
      </p>

      <details style={{ marginBottom: '1.25rem' }}>
        <summary style={{ ...mono, color: T.gold, cursor: 'pointer' }}>Columns it understands</summary>
        <div style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, lineHeight: 1.9, marginTop: '0.75rem', fontSize: '0.92rem' }}>
          <div><strong style={{ color: T.ink }}>Email</strong> — required. Creates the brother&apos;s portal login.</div>
          <div><strong style={{ color: T.ink }}>First Name</strong>, <strong style={{ color: T.ink }}>Last Name</strong> — required.</div>
          <div><strong style={{ color: T.ink }}>Degree</strong> — EA, FC or MM. Defaults to MM.</div>
          <div><strong style={{ color: T.ink }}>Lodge Role</strong> — the office title, e.g. Senior Warden.</div>
          <div><strong style={{ color: T.ink }}>Access</strong> — portal permission tier. Defaults to member.</div>
          <div><strong style={{ color: T.ink }}>Phone</strong> — optional.</div>
        </div>
      </details>

      <input
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        onChange={onFile}
        style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, marginBottom: '1rem', display: 'block' }}
      />

      {fileName && (
        <div style={{ ...mono, color: T.inkFaint, marginBottom: '1rem', textTransform: 'none' }}>
          {fileName} — {rows.length} {rows.length === 1 ? 'row' : 'rows'} read
        </div>
      )}

      {unmatched.length > 0 && (
        <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: T.gold, marginBottom: '1rem', lineHeight: 1.6 }}>
          Ignored {unmatched.length === 1 ? 'column' : 'columns'}: {unmatched.join(', ')} — nothing in LodgeOS maps to {unmatched.length === 1 ? 'it' : 'them'}.
        </div>
      )}

      {error && (
        <div style={{ background: T.dangerDim, border: '1px solid rgba(231,76,60,0.3)', color: T.danger, padding: '10px 14px', borderRadius: 4, marginBottom: '1rem', fontFamily: 'Crimson Pro, serif', lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      {done && (
        <div style={{ background: T.successDim, border: '1px solid rgba(93,190,133,0.3)', color: T.success, padding: '10px 14px', borderRadius: 4, marginBottom: '1rem', fontFamily: 'Crimson Pro, serif' }}>
          ✓ {done}
        </div>
      )}

      {report && (
        <div style={{ background: T.bg, border: `1px solid ${T.goldBorder}`, borderRadius: 4, padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ ...mono, color: T.gold, marginBottom: '0.75rem' }}>Preview — nothing saved yet</div>
          <div style={{ fontFamily: 'Crimson Pro, serif', color: T.ink, lineHeight: 2 }}>
            <div>{report.toImport} brothers will be added</div>
            {report.alreadyOnRoster > 0 && <div style={{ color: T.inkFaint }}>{report.alreadyOnRoster} already on the roster — left unchanged</div>}
            {report.skipped > 0 && <div style={{ color: T.danger }}>{report.skipped} rows will be skipped</div>}
          </div>

          {report.preview.length > 0 && (
            <div style={{ marginTop: '1rem', maxHeight: 220, overflowY: 'auto' }}>
              {report.preview.map((p) => (
                <div key={p.email} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '3px 0', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: T.inkFaint }}>
                  <span>Bro. {p.name}{p.lodgeRole ? ` · ${p.lodgeRole}` : ''}</span>
                  <span style={{ fontFamily: T.mono, fontSize: '0.62rem' }}>{p.degree} · {p.tenantRole}</span>
                </div>
              ))}
            </div>
          )}

          {report.warnings.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ ...mono, color: T.danger, marginBottom: '0.4rem' }}>Warnings ({report.warnings.length})</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: T.inkFaint, lineHeight: 1.8, maxHeight: 180, overflowY: 'auto' }}>
                {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Opt-in, and off by default. A secretary loading last year's
          roster to get the data in should not thereby email the whole
          lodge — that is a separate decision from the import. */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: '1.25rem', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={sendInvites}
          onChange={(e) => setSendInvites(e.target.checked)}
          style={{ marginTop: 4, accentColor: T.gold }}
        />
        <span style={{ fontFamily: 'Crimson Pro, serif', color: T.ink, lineHeight: 1.6 }}>
          Send each brother a welcome email with sign-in instructions
          <span style={{ display: 'block', fontSize: '0.85rem', color: T.inkFaint }}>
            Leave off to load the roster quietly now and invite them later from the Members page.
          </span>
        </span>
      </label>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button onClick={() => send(true)} disabled={!rows.length || busy} style={{ ...ghost, opacity: !rows.length || busy ? 0.5 : 1 }}>
          {busy ? 'Working…' : 'Preview'}
        </button>
        {report && report.toImport > 0 && (
          <button onClick={() => send(false)} disabled={busy} className="btn-gold" style={{ fontSize: '0.68rem', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Importing…' : `Import ${report.toImport} ${report.toImport === 1 ? 'Brother' : 'Brothers'}${sendInvites ? ' & Invite' : ''}`}
          </button>
        )}
      </div>
    </div>
  )
}
