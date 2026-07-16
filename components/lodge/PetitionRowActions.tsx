'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Petition = {
  id: string
  status: 'new' | 'under_review' | 'approved' | 'denied'
}

// From any given status, only the actions that make sense are offered.
// 'approved'/'denied' are terminal in this UI — reopening a decided
// petition is a real, consequential action and shouldn't be one
// accidental click away.
function actionsFor(status: Petition['status']) {
  if (status === 'new') return ['under_review', 'denied'] as const
  if (status === 'under_review') return ['approved', 'denied'] as const
  return [] as const
}

const ACTION_LABEL: Record<string, string> = {
  under_review: 'Mark Under Review',
  approved: 'Approve',
  denied: 'Deny',
}

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  under_review: { background: 'transparent', border: '1px solid #C9A84C', color: '#C9A84C' },
  approved: { background: '#5DBE85', border: '1px solid #5DBE85', color: '#0A0E1A' },
  denied: { background: 'transparent', border: '1px solid #E74C3C', color: '#E74C3C' },
}

export function PetitionRowActions({
  petitionId, tenantId, status,
}: { petitionId: string; tenantId: string; status: Petition['status'] }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const actions = actionsFor(status)

  const runAction = async (newStatus: string) => {
    if (newStatus === 'denied' && !window.confirm('Deny this petition? This can be changed later by an admin, but the petitioner will not be automatically notified.')) {
      return
    }
    setPending(newStatus)
    setError('')
    try {
      const res = await fetch('/api/petitions/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, petitionId, status: newStatus }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Update failed')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPending(null)
    }
  }

  if (actions.length === 0) {
    return <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', fontStyle: 'italic' }}>Decided</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        {actions.map(a => (
          <button
            key={a}
            onClick={() => runAction(a)}
            disabled={pending !== null}
            style={{
              ...ACTION_STYLE[a],
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.58rem',
              letterSpacing: '0.05em',
              padding: '5px 10px',
              borderRadius: '3px',
              cursor: pending !== null ? 'not-allowed' : 'pointer',
              opacity: pending !== null && pending !== a ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {pending === a ? 'Saving…' : ACTION_LABEL[a]}
          </button>
        ))}
      </div>
      {error && <div style={{ color: '#E74C3C', fontSize: '0.58rem', fontFamily: 'JetBrains Mono, monospace' }}>{error}</div>}
    </div>
  )
}
