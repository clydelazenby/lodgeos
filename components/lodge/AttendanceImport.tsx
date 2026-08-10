'use client'

import { useState } from 'react'
import { T } from '@/lib/designTokens'

/**
 * CSV import for historical attendance.
 *
 * Two-step by design: the file is always sent as a dry run first, and
 * nothing is written until the secretary reads the report and confirms.
 * A silent bulk import is the wrong shape for this — a column mapped
 * wrong writes hundreds of incorrect records into the permanent
 * attendance history, and there is no undo.
 */

type Report = {
  rowsParsed: number
  rowsToImport: number
  rowsSkipped: number
  eventsMatched: number
  eventsToCreate: number
  newEventTitles: string[]
  membersMatched: number
  unmatchedEmails: string[]
  warnings: string[]
}

const TEMPLATE = `event_date,event_title,member_email,status
2025-01-15,Stated Communication,brother@example.com,present
2025-01-15,Stated Communication,another@example.com,excused
2025-02-19,Stated Communication,brother@example.com,present`

export function AttendanceImport({ tenantId, onImported }: { tenantId: string; onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const reset = () => {
    setCsv('')
    setFileName('')
    setReport(null)
    setError('')
    setDone('')
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    reset()
    setFileName(file.name)
    setCsv(await file.text())
  }

  const send = async (dryRun: boolean) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/attendance/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, csv, dryRun }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Import failed.')
        // A rejected file still returns its warnings — those are what
        // tell the secretary WHICH lines were wrong.
        if (result.warnings?.length) {
          setReport({
            rowsParsed: 0, rowsToImport: 0, rowsSkipped: 0,
            eventsMatched: 0, eventsToCreate: 0, newEventTitles: [],
            membersMatched: 0, unmatchedEmails: result.unmatchedEmails ?? [],
            warnings: result.warnings,
          })
        }
        return
      }

      if (dryRun) {
        setReport(result)
      } else {
        setDone(`Imported ${result.imported} attendance records across ${result.eventsCreated} newly created meetings.`)
        setReport(null)
        setCsv('')
        setFileName('')
        onImported?.()
      }
    } catch (err: any) {
      setError(err?.message || 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const box = {
    background: T.bgCard,
    border: `1px solid ${T.goldBorder}`,
    borderRadius: 6,
    padding: '1.5rem',
    marginBottom: '2rem',
  }

  const mono = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.6rem',
    letterSpacing: '0.15em',
    color: T.gold,
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          ...mono,
          background: 'transparent',
          border: `1px solid ${T.goldBorder}`,
          color: T.gold,
          padding: '10px 18px',
          borderRadius: 4,
          cursor: 'pointer',
          marginBottom: '2rem',
          textTransform: 'uppercase',
        }}
      >
        ↑ Import Past Attendance
      </button>
    )
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={mono}>IMPORT PAST ATTENDANCE</span>
        <button
          onClick={() => { setOpen(false); reset() }}
          style={{ background: 'transparent', border: 'none', color: T.inkFaint, cursor: 'pointer', fontSize: '1.1rem' }}
          aria-label="Close import panel"
        >
          ×
        </button>
      </div>

      <p style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, lineHeight: 1.7, marginBottom: '1.25rem' }}>
        Load attendance from past meetings so the dashboard heatmap and analytics have history to work with.
        Meetings that don&apos;t exist yet are created automatically, and re-importing the same file is safe —
        it updates rather than duplicates.
      </p>

      <details style={{ marginBottom: '1.25rem' }}>
        <summary style={{ ...mono, cursor: 'pointer', marginBottom: '0.75rem' }}>REQUIRED FORMAT</summary>
        <pre
          style={{
            background: T.bg,
            border: `1px solid ${T.goldBorder}`,
            borderRadius: 4,
            padding: '1rem',
            overflowX: 'auto',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.68rem',
            color: T.inkFaint,
            lineHeight: 1.8,
            marginTop: '0.5rem',
          }}
        >
          {TEMPLATE}
        </pre>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: T.inkFainter, marginTop: '0.5rem' }}>
          Dates must be YYYY-MM-DD. <code>status</code> is optional and defaults to <code>present</code>;
          it accepts present, absent, or excused. Emails must match members already on the roster.
        </p>
      </details>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, marginBottom: '1rem', display: 'block' }}
      />

      {fileName && (
        <div style={{ ...mono, color: T.inkFaint, marginBottom: '1rem' }}>
          FILE: {fileName}
        </div>
      )}

      {error && (
        <div
          style={{
            background: T.dangerDim,
            border: `1px solid rgba(231,76,60,0.3)`,
            color: T.danger,
            padding: '10px 14px',
            borderRadius: 4,
            marginBottom: '1rem',
            fontFamily: 'Crimson Pro, serif',
          }}
        >
          {error}
        </div>
      )}

      {done && (
        <div
          style={{
            background: T.successDim,
            border: '1px solid rgba(93,190,133,0.3)',
            color: T.success,
            padding: '10px 14px',
            borderRadius: 4,
            marginBottom: '1rem',
            fontFamily: 'Crimson Pro, serif',
          }}
        >
          ✓ {done}
        </div>
      )}

      {report && (
        <div
          style={{
            background: T.bg,
            border: `1px solid ${T.goldBorder}`,
            borderRadius: 4,
            padding: '1.25rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ ...mono, marginBottom: '0.75rem' }}>PREVIEW — NOTHING SAVED YET</div>

          <div style={{ fontFamily: 'Crimson Pro, serif', color: T.ink, lineHeight: 2 }}>
            <div>{report.rowsToImport} records will be imported</div>
            <div>{report.membersMatched} members matched by email</div>
            <div>{report.eventsMatched} existing meetings matched</div>
            <div>{report.eventsToCreate} new meetings will be created</div>
            {report.rowsSkipped > 0 && (
              <div style={{ color: T.danger }}>{report.rowsSkipped} rows will be skipped</div>
            )}
          </div>

          {report.newEventTitles.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ ...mono, color: T.inkFaint, marginBottom: '0.5rem' }}>MEETINGS TO CREATE</div>
              <ul style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                {report.newEventTitles.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}

          {report.warnings.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ ...mono, color: T.danger, marginBottom: '0.5rem' }}>
                WARNINGS ({report.warnings.length})
              </div>
              <ul
                style={{
                  fontFamily: 'Crimson Pro, serif',
                  color: T.inkFaint,
                  paddingLeft: '1.25rem',
                  lineHeight: 1.8,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => send(true)}
          disabled={!csv || busy}
          style={{
            ...mono,
            background: 'transparent',
            border: `1px solid ${T.goldBorder}`,
            color: T.gold,
            padding: '11px 20px',
            borderRadius: 4,
            cursor: !csv || busy ? 'not-allowed' : 'pointer',
            opacity: !csv || busy ? 0.5 : 1,
            textTransform: 'uppercase',
          }}
        >
          {busy ? 'Checking…' : 'Preview'}
        </button>

        {report && report.rowsToImport > 0 && (
          <button
            onClick={() => send(false)}
            disabled={busy}
            className="btn-gold"
            style={{ cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Importing…' : `Import ${report.rowsToImport} Records`}
          </button>
        )}
      </div>
    </div>
  )
}
