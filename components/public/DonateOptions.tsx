'use client'

import { useState } from 'react'

/**
 * Amount picker plus the lodge's payment methods.
 *
 * WHY THE AMOUNT MATTERS HERE
 *
 * Cash App and Venmo both accept an amount in the URL, so choosing one
 * here means the donor lands in the app with the figure already entered
 * and only has to confirm. That is the difference between a gift that
 * completes and one abandoned halfway.
 *
 * Zelle has NO universal deep link — it is implemented inside each
 * bank's own app, so there is nothing to hand off to. The lodge's
 * details are shown to copy instead, which is the honest presentation
 * rather than a button that would not work.
 */

const PRESETS = [25, 50, 100, 250]

export function DonateOptions({
  lodgeName,
  cashapp,
  venmo,
  zelle,
  zelleName,
}: {
  lodgeName: string
  cashapp: string | null
  venmo: string | null
  zelle: string | null
  zelleName: string | null
}) {
  const [amount, setAmount] = useState<string>('50')
  const [copied, setCopied] = useState('')

  // Guard the deep links: a blank or non-numeric box must not produce
  // cash.app/$handle/NaN. Falling back to the handle alone still opens
  // the right payee, just without a prefilled figure.
  const numeric = Number(amount)
  const validAmount = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 100) / 100 : null

  const note = `Donation to ${lodgeName}`

  const cashappUrl = cashapp
    ? `https://cash.app/$${encodeURIComponent(cashapp)}${validAmount ? `/${validAmount}` : ''}`
    : null

  const venmoUrl = venmo
    ? `https://venmo.com/u/${encodeURIComponent(venmo)}` +
      (validAmount ? `?txn=pay&amount=${validAmount}&note=${encodeURIComponent(note)}` : '')
    : null

  const copy = async (value: string, which: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      // Clipboard is blocked in some in-app browsers; the value is
      // visible on screen either way, so this is not worth an error.
    }
  }

  const gold = '#C9A84C'
  const panel = '#142234'
  const cream = '#F5F0E8'

  const card = {
    background: panel,
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 8,
    padding: '1.25rem',
    marginBottom: '0.9rem',
  }

  const payButton = {
    display: 'block',
    textAlign: 'center' as const,
    background: gold,
    color: '#0A0E1A',
    fontFamily: 'Cinzel, serif',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    padding: '13px 20px',
    borderRadius: 4,
    textDecoration: 'none',
    marginTop: '0.9rem',
  }

  const label = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.58rem',
    letterSpacing: '0.2em',
    color: gold,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    display: 'block',
  }

  return (
    <div>
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        <label style={label} htmlFor="donation-amount">Amount</label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              style={{
                flex: '1 1 70px',
                background: String(p) === amount ? gold : 'transparent',
                color: String(p) === amount ? '#0A0E1A' : cream,
                border: `1px solid ${String(p) === amount ? gold : 'rgba(201,168,76,0.3)'}`,
                borderRadius: 4,
                padding: '11px 8px',
                fontFamily: 'Cinzel, serif',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              ${p}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#B8B0A0' }}>$</span>
          <input
            id="donation-amount"
            type="number"
            min="1"
            step="1"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Other amount"
            style={{
              flex: 1,
              background: '#0A0E1A',
              border: '1px solid rgba(201,168,76,0.25)',
              color: cream,
              padding: '12px 14px',
              fontFamily: 'Crimson Pro, serif',
              fontSize: '1.1rem',
              borderRadius: 4,
              outline: 'none',
              minWidth: 0,
            }}
          />
        </div>
      </div>

      {cashappUrl && (
        <div style={card}>
          <span style={label}>Cash App</span>
          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', color: cream }}>
            ${cashapp}
          </div>
          <a href={cashappUrl} target="_blank" rel="noopener noreferrer" style={payButton}>
            {validAmount ? `Give $${validAmount} with Cash App` : 'Open Cash App'}
          </a>
        </div>
      )}

      {venmoUrl && (
        <div style={card}>
          <span style={label}>Venmo</span>
          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', color: cream }}>
            @{venmo}
          </div>
          <a href={venmoUrl} target="_blank" rel="noopener noreferrer" style={payButton}>
            {validAmount ? `Give $${validAmount} with Venmo` : 'Open Venmo'}
          </a>
        </div>
      )}

      {zelle && (
        <div style={card}>
          <span style={label}>Zelle</span>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: '#B8B0A0', margin: '0 0 0.9rem', lineHeight: 1.6 }}>
            Zelle lives inside your own banking app, so open it there and send to:
          </p>

          <div style={{ background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 4, padding: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem', color: cream, wordBreak: 'break-all' }}>
                {zelle}
              </span>
              <button
                type="button"
                onClick={() => copy(zelle, 'zelle')}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em',
                  background: 'transparent', border: `1px solid ${gold}`, color: gold,
                  padding: '6px 12px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {copied === 'zelle' ? 'COPIED' : 'COPY'}
              </button>
            </div>

            {/* Zelle transfers cannot be reversed. Confirming the payee
                name is the only check a donor gets, so it is shown
                prominently rather than left to chance. */}
            {zelleName && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(201,168,76,0.15)' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.15em', color: '#918879', textTransform: 'uppercase', marginBottom: 4 }}>
                  Confirm this name before sending
                </div>
                <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1rem', color: cream }}>{zelleName}</div>
              </div>
            )}
          </div>

          {validAmount && (
            <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: '#B8B0A0', margin: '0.9rem 0 0' }}>
              Enter <strong style={{ color: cream }}>${validAmount}</strong> as the amount.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
