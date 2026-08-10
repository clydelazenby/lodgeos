'use client'
import { useState } from 'react'
import Link from 'next/link'
import { DocumentLibrary } from '@/components/lodge/DocumentLibrary'
import { CurriculumEditor } from '@/components/lodge/CurriculumEditor'
import type { Step } from '@/lib/curriculum'

/**
 * Two things live on this page, and they are not the same thing.
 *
 * THE LIBRARY is where a file is kept. THE CURRICULUM is what a
 * candidate does next, in order — and it points AT the library rather
 * than duplicating it. Keeping them on one page is deliberate: the
 * officer attaching material to a step needs the library in front of
 * him, and the two drift apart if they live in different rooms.
 */
export function DocumentsTabs({
  slug,
  tenantId,
  documents,
  curriculumSteps,
  canManage,
  canEditCurriculum,
  hiddenCount,
}: {
  slug: string
  tenantId: string
  documents: any[]
  curriculumSteps: Step[]
  canManage: boolean
  canEditCurriculum: boolean
  hiddenCount: number
}) {
  const [tab, setTab] = useState<'library' | 'curriculum'>('library')

  const tabButton = (key: 'library' | 'curriculum', label: string, count: number) => {
    const active = tab === key
    return (
      <button
        onClick={() => setTab(key)}
        aria-pressed={active}
        style={{
          background: 'none',
          border: 'none',
          borderBottom: `2px solid ${active ? '#C9A84C' : 'transparent'}`,
          color: active ? '#F5F0E8' : '#B8B0A0',
          fontFamily: 'Cinzel, serif',
          fontSize: '0.85rem',
          padding: '10px 4px',
          marginRight: '1.6rem',
          cursor: 'pointer',
        }}
      >
        {label}{' '}
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#C9A84C' }}>{count}</span>
      </button>
    )
  }

  return (
    <div>
      <div style={{ borderBottom: '1px solid rgba(201,168,76,0.12)', marginBottom: '1.4rem', display: 'flex', flexWrap: 'wrap' }}>
        {tabButton('library', 'Library', documents.length)}
        {tabButton('curriculum', 'Degree Curriculum', curriculumSteps.length)}
      </div>

      {tab === 'library' ? (
        <>
          <DocumentLibrary documents={documents} canManage={canManage} hiddenCount={hiddenCount} />

          {/* TWO PLAUSIBLE HOMES FOR MINUTES NOW EXIST, and left alone
              they will drift: someone files a set here, someone else
              writes them in the book, and in a year nobody knows which
              is authoritative. Said plainly on the page rather than
              left to be worked out. */}
          <div style={{ marginTop: '1rem', padding: '1rem 1.5rem', background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', fontFamily: 'Crimson Pro, serif', color: '#B8B0A0' }}>
            <strong style={{ color: '#F5F0E8' }}>Minutes belong in the minute book</strong> — where they
            are read, approved and dated. Keep scans of the old bound volumes here under Minutes;
            everything from now on goes in{' '}
            <Link href={`/lodge/${slug}/minutes`} style={{ color: '#C9A84C' }}>the book</Link>, so
            there is one authoritative copy rather than two plausible ones.
          </div>
        </>
      ) : (
        <>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: '0 0 1.2rem' }}>
            What a candidate does, in order — and where the material for each step lives. A folder
            says where a file is kept; this says what to do next. Sign-offs are recorded against each
            candidate on the{' '}
            <Link href={`/lodge/${slug}/degrees`} style={{ color: '#C9A84C' }}>Degrees</Link> page.
          </p>
          <CurriculumEditor
            tenantId={tenantId}
            steps={curriculumSteps}
            documents={documents.map((d) => ({ id: d.id, name: d.name, category: d.category }))}
            canEdit={canEditCurriculum}
          />
        </>
      )}
    </div>
  )
}
