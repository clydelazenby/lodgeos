'use client'

import { useState } from 'react'
import { T } from '@/lib/designTokens'
import { notify } from '@/lib/toast'

/**
 * Downloads the roster as a spreadsheet.
 *
 * COLUMN HEADINGS ARE THE IMPORTER'S OWN ALIASES, ON PURPOSE.
 *
 * "First Name", "Last Name", "Email", "Degree", "Lodge Role", "Access"
 * and "Phone" are exactly the headings MemberImport recognises, so an
 * exported file can be edited in Excel and fed straight back in. That
 * round trip is the point: bulk-correcting forty degrees or office
 * titles in a spreadsheet is far easier than forty dropdowns, and a
 * lodge should never be locked out of its own roster.
 *
 * The trailing columns (Dues Status, Status, Joined) are informational.
 * The importer ignores headings it does not recognise and says so, so
 * their presence costs nothing on re-import.
 *
 * Runs entirely in the browser from data the page already has — no
 * request, and nothing leaves the device except the file the secretary
 * asked for.
 */

type Member = {
  degree?: string | null
  lodge_role?: string | null
  tenant_role?: string | null
  dues_status?: string | null
  is_active?: boolean | null
  created_at?: string | null
  profiles?: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

export function RosterExport({
  members,
  lodgeSlug,
}: {
  members: Member[]
  lodgeSlug: string
}) {
  const [busy, setBusy] = useState(false)

  const download = async (format: 'xlsx' | 'csv') => {
    if (!members.length) {
      notify.error('There is nobody on the roster to export yet.')
      return
    }

    setBusy(true)
    try {
      // Same lazy load as the importer — SheetJS is ~800KB and only a
      // secretary exporting or importing ever needs it.
      const XLSX = await import('xlsx')

      const rows = members.map((m) => ({
        'First Name': m.profiles?.first_name ?? '',
        'Last Name': m.profiles?.last_name ?? '',
        'Email': m.profiles?.email ?? '',
        'Degree': m.degree ?? '',
        'Lodge Role': m.lodge_role ?? '',
        'Access': m.tenant_role ?? '',
        'Phone': m.profiles?.phone ?? '',
        'Dues Status': m.dues_status ?? '',
        'Status': m.is_active ? 'Active' : 'Inactive',
        'Joined': m.created_at ? new Date(m.created_at).toISOString().slice(0, 10) : '',
      }))

      const sheet = XLSX.utils.json_to_sheet(rows)

      // Without explicit widths every column renders at Excel's default
      // and an email address is clipped to "jsmith@exa…", which is the
      // first thing a secretary would have to fix by hand.
      sheet['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 8 },
        { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 12 },
        { wch: 10 }, { wch: 12 },
      ]

      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, 'Roster')

      const stamp = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(book, `${lodgeSlug}-roster-${stamp}.${format}`, {
        bookType: format === 'csv' ? 'csv' : 'xlsx',
      })

      notify.saved(
        `Roster exported — ${rows.length} ${rows.length === 1 ? 'brother' : 'brothers'}`
      )
    } catch (err: any) {
      notify.error(err?.message || 'Could not build the export file.')
    } finally {
      setBusy(false)
    }
  }

  const ghost = {
    fontFamily: T.mono,
    fontSize: '0.6rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    background: 'transparent',
    border: `1px solid ${T.goldBorder}`,
    color: T.gold,
    padding: '10px 14px',
    borderRadius: 4,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
  }

  return (
    <span style={{ display: 'inline-flex', gap: 0 }}>
      <button
        onClick={() => download('xlsx')}
        disabled={busy}
        title="Download as an Excel workbook — the same columns the importer reads back"
        style={{ ...ghost, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
      >
        {busy ? 'Building…' : '↓ Export Roster'}
      </button>
      <button
        onClick={() => download('csv')}
        disabled={busy}
        title="Download as CSV instead"
        aria-label="Export roster as CSV"
        style={{
          ...ghost,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          borderLeft: 'none',
          padding: '10px 11px',
        }}
      >
        CSV
      </button>
    </span>
  )
}
