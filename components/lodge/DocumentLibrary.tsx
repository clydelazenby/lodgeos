'use client'
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { DocumentDownloadLink, DocumentDeleteButton, DocumentPlayer } from '@/components/lodge/DocumentUpload'
import { isPlayable, formatDuration } from '@/lib/documents'
import { formatLabel, kindFor, KIND_LABEL, KIND_ORDER, type UploadKind } from '@/lib/uploads'
import { degreeShortLabel } from '@/lib/degrees'

/**
 * The library, made navigable.
 *
 * WHAT WAS WRONG. The page had category tiles that were plain divs
 * showing a count — clicking one did nothing — and it listed only four
 * of the six categories the upload form offers, so anything filed under
 * Training or Other was counted nowhere. There was no search at all.
 * The structure existed; none of it did anything.
 *
 * NO FOLDER TREE, deliberately. A lodge library is tens to low hundreds
 * of files. At that size a tree is where documents go to be lost:
 * everything is one click further away and findable only if you guess
 * the same branch the uploader did. Filter plus search beats a
 * hierarchy until the collection is far larger than this will ever be.
 *
 * Filtering happens here rather than on the server because the whole
 * library is already loaded — a round trip per keystroke would be
 * slower and would fight the user's typing.
 */

const ACCESS_PILL: Record<string, string> = {
  all: 'pill-active',
  EA: 'pill-ea',
  FC: 'pill-fc',
  MM: 'pill-mm',
}

export function DocumentLibrary({
  documents,
  canManage,
  hiddenCount,
}: {
  documents: any[]
  canManage: boolean
  /** Withheld for a higher degree — counted, never named. */
  hiddenCount: number
}) {
  const [category, setCategory] = useState<string>('')
  /**
   * The other axis: what a file IS, not what it is about.
   *
   * Asked for as "a PowerPoint tab, a video tab", and it is a second
   * filter rather than a tab because it is genuinely independent of
   * the category. A degree lecture is Degree Materials AND a slide
   * deck; making format a tab would have forced a choice between two
   * questions an officer asks together — "the training video" is both.
   */
  const [kind, setKind] = useState<UploadKind | ''>('')
  const [query, setQuery] = useState('')
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({})

  /**
   * Every category actually present, plus the ones the upload form
   * offers — so a filter never silently omits a category the way the
   * old tiles did, and an unexpected value typed in by an import still
   * appears rather than vanishing.
   */
  const categories = useMemo(() => {
    const found = new Set<string>()
    for (const d of documents) if (d.category) found.add(d.category)
    return Array.from(found).sort()
  }, [documents])

  /**
   * A document is CURRENT when nothing supersedes it. Older versions
   * collapse underneath rather than sitting beside it — the failure
   * this replaces is three copies of the bylaws in a row with nothing
   * to say which one governs.
   */
  const { current, priorsFor } = useMemo(() => {
    const supersededBy = new Map<string, any>()
    for (const d of documents) if (d.supersedes_id) supersededBy.set(d.supersedes_id, d)

    const byId = new Map(documents.map((d) => [d.id, d]))
    const current = documents.filter((d) => !supersededBy.has(d.id))

    // Walk each chain back from the current copy to collect its
    // ancestors, newest first.
    const priorsFor = new Map<string, any[]>()
    for (const head of current) {
      const chain: any[] = []
      let cursor = head.supersedes_id ? byId.get(head.supersedes_id) : null
      const seen = new Set<string>([head.id])
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id)
        chain.push(cursor)
        cursor = cursor.supersedes_id ? byId.get(cursor.supersedes_id) : null
      }
      if (chain.length) priorsFor.set(head.id, chain)
    }
    return { current, priorsFor }
  }, [documents])

  /**
   * Searching also matches the format, so typing "powerpoint" or
   * "video" finds them without anyone noticing the filter row exists.
   * The word a man types is the word he was going to look for.
   */
  const matchesQuery = (d: any, needle: string) => {
    if (!needle) return true
    return (
      (d.name ?? '').toLowerCase().includes(needle) ||
      (d.description ?? '').toLowerCase().includes(needle) ||
      (d.category ?? '').toLowerCase().includes(needle) ||
      (formatLabel(d.storage_path, d.mime_type) ?? '').toLowerCase().includes(needle) ||
      (kindFor(d.storage_path, d.mime_type)
        ? KIND_LABEL[kindFor(d.storage_path, d.mime_type)!].toLowerCase().includes(needle)
        : false)
    )
  }

  /**
   * Each chip's number is what you will actually see if you press it —
   * so the two rows cross-filter each other. A "Video 4" chip that
   * yields nothing because a category is also selected is worse than
   * no number at all: it reads as the app losing files.
   */
  const { results, byCategory, byKind, kinds, categoryAllCount, kindAllCount } = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const searched = current.filter((d) => matchesQuery(d, needle))

    const inKind = kind ? searched.filter((d) => kindFor(d.storage_path, d.mime_type) === kind) : searched
    const inCategory = category ? searched.filter((d) => d.category === category) : searched

    const byCategory = new Map<string, number>()
    for (const d of inKind) byCategory.set(d.category ?? '', (byCategory.get(d.category ?? '') ?? 0) + 1)

    const byKind = new Map<string, number>()
    for (const d of inCategory) {
      const k = kindFor(d.storage_path, d.mime_type)
      if (k) byKind.set(k, (byKind.get(k) ?? 0) + 1)
    }

    return {
      results: inKind.filter((d) => !category || d.category === category),
      byCategory,
      byKind,
      // Only the kinds this lodge actually holds. A row of seven
      // filters where five find nothing is noise a reader learns to
      // skip past.
      kinds: KIND_ORDER.filter((k) => current.some((d) => kindFor(d.storage_path, d.mime_type) === k)),
      // What "All" and "Any" would give: everything the OTHER filter
      // and the search still allow.
      categoryAllCount: inKind.length,
      kindAllCount: inCategory.length,
    }
  }, [current, category, kind, query])

  const chip = (label: string, count: number, active: boolean, onClick: () => void, key: string) => {
    return (
      <button
        key={key}
        onClick={onClick}
        aria-pressed={active}
        style={{
          background: active ? 'rgba(201,168,76,0.15)' : 'transparent',
          border: `1px solid ${active ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.18)'}`,
          color: active ? '#F5F0E8' : '#B8B0A0',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.58rem',
          letterSpacing: '0.08em',
          padding: '7px 11px',
          borderRadius: 3,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          // A chip that would show nothing says so by looking spent,
          // rather than by being pressed and emptying the page.
          opacity: count === 0 && !active ? 0.45 : 1,
        }}
      >
        {label.toUpperCase()} <span style={{ color: '#C9A84C' }}>{count}</span>
      </button>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the library — a name, a subject, “powerpoint”…"
          style={{
            width: '100%',
            background: '#0A0E1A',
            border: '1px solid rgba(201,168,76,0.2)',
            color: '#F5F0E8',
            padding: '11px 13px',
            borderRadius: 4,
            fontFamily: 'Crimson Pro, serif',
            // 16px, or iOS zooms the page when this is focused.
            fontSize: '16px',
            marginBottom: '0.7rem',
          }}
        />

        {/* WHAT IT IS ABOUT. These were counters. Now they filter,
            which is what a category is for. All of them are listed,
            not the four that happened to be hard-coded. */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chip('All', categoryAllCount, !category, () => setCategory(''), 'cat-all')}
          {categories.map((c) =>
            chip(c, byCategory.get(c) ?? 0, category === c, () => setCategory(category === c ? '' : c), `cat-${c}`)
          )}
        </div>

        {/* WHAT IT IS. Only shown once the library actually holds more
            than one kind — a lodge with nothing but PDFs does not need
            to be told they are all PDFs. */}
        {kinds.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.52rem',
                letterSpacing: '0.18em', color: '#918879', marginRight: 2,
              }}
            >
              FORMAT
            </span>
            {chip('Any', kindAllCount, !kind, () => setKind(''), 'kind-any')}
            {kinds.map((k) =>
              chip(KIND_LABEL[k], byKind.get(k) ?? 0, kind === k, () => setKind(kind === k ? '' : k), `kind-${k}`)
            )}
          </div>
        )}
      </div>

      <div className="data-box">
        <div className="data-box-head">
          <span>
            {[category, kind ? KIND_LABEL[kind] : ''].filter(Boolean).join(' · ') || 'Available To You'}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
            {results.length}
          </span>
        </div>

        {results.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontFamily: 'Crimson Pro, serif' }}>
            {documents.length === 0
              ? 'No documents uploaded yet. Upload degree materials, bylaws and Grand Lodge forms here.'
              : query.trim() || category || kind
                ? 'Nothing here matches that.'
                : 'No documents are available at your degree yet.'}
            {/* A dead end with two filters on is usually one filter too
                many, and the way out should not be to work out which. */}
            {(category || kind || query.trim()) && documents.length > 0 && (
              <div style={{ marginTop: '0.9rem' }}>
                <button
                  onClick={() => { setCategory(''); setKind(''); setQuery('') }}
                  style={{
                    background: 'transparent', border: '1px solid rgba(201,168,76,0.25)',
                    color: '#C9A84C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem',
                    letterSpacing: '0.1em', padding: '7px 11px', borderRadius: 3, cursor: 'pointer',
                  }}
                >
                  SHOW EVERYTHING
                </button>
              </div>
            )}
          </div>
        ) : (
          results.map((d) => {
            const priors = priorsFor.get(d.id) ?? []
            const open = !!showHistory[d.id]
            return (
              <div key={d.id} style={{ borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
                <div style={{ padding: '0.9rem 1.4rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem', color: '#F5F0E8', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {isPlayable(d.mime_type) && (
                        <span title="Recording" style={{ color: '#C9A84C', fontSize: '0.7rem' }}>
                          {d.mime_type?.startsWith('video/') ? '▶' : '♪'}
                        </span>
                      )}
                      {d.name}
                      {priors.length > 0 && (
                        <span className="pill pill-fc" title="Earlier versions exist">CURRENT</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#B8B0A0', marginTop: 2, fontFamily: 'Crimson Pro, serif' }}>
                      {d.description || ''}
                      {formatDuration(d.duration_seconds) && (
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', marginLeft: d.description ? 8 : 0 }}>
                          {formatDuration(d.duration_seconds)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#918879', marginTop: 4 }}>
                      {/* Which of them this is. A library holding PDFs,
                          slide decks, spreadsheets and recordings side
                          by side is unreadable without it — a brother
                          on a phone needs to know before he taps
                          whether it will open in a viewer or land in
                          his downloads. */}
                      {formatLabel(d.storage_path, d.mime_type) && (
                        <>{formatLabel(d.storage_path, d.mime_type)}{' · '}</>
                      )}
                      {d.category}
                      {' · '}
                      {format(new Date(d.created_at), 'MMM d, yyyy')}
                      {d.profiles ? ` · ${d.profiles.first_name} ${d.profiles.last_name}` : ''}
                    </div>
                  </div>

                  <span className={`pill ${ACCESS_PILL[d.access_level] ?? 'pill-new'}`}>
                    {d.access_level === 'all' ? 'All Brothers' : `${degreeShortLabel(d.access_level)}+`}
                  </span>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {isPlayable(d.mime_type)
                      ? <DocumentPlayer documentId={d.id} mimeType={d.mime_type} name={d.name} />
                      : <DocumentDownloadLink documentId={d.id} />}
                    {canManage && <DocumentDeleteButton documentId={d.id} documentName={d.name} />}
                  </div>
                </div>

                {/* Superseded copies. Kept, because a lodge is sometimes
                    asked what its bylaws said in 2019 and an amendment
                    history is itself a record — but out of the way, so
                    nobody reads the wrong one by accident. */}
                {priors.length > 0 && (
                  <div style={{ padding: '0 1.4rem 0.9rem' }}>
                    <button
                      onClick={() => setShowHistory((p) => ({ ...p, [d.id]: !open }))}
                      aria-expanded={open}
                      style={{ background: 'none', border: 'none', color: '#918879', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', padding: 0 }}
                    >
                      {open ? '▾' : '▸'} {priors.length} EARLIER {priors.length === 1 ? 'VERSION' : 'VERSIONS'}
                    </button>
                    {open && priors.map((p) => (
                      <div key={p.id} style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', padding: '6px 0 0 14px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: '#918879', flex: 1, minWidth: 160 }}>
                          {p.name}
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', marginLeft: 8 }}>
                            {format(new Date(p.created_at), 'MMM d, yyyy')}
                          </span>
                        </span>
                        <DocumentDownloadLink documentId={p.id} label="View" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {hiddenCount > 0 && (
        <div style={{ marginTop: '1rem', padding: '1rem 1.5rem', background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', fontFamily: 'Crimson Pro, serif', color: '#B8B0A0', fontStyle: 'italic' }}>
          {hiddenCount} further {hiddenCount === 1 ? 'document is' : 'documents are'} held for higher degrees and will appear here as you advance.
        </div>
      )}
    </div>
  )
}
