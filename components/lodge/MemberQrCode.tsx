'use client'
import { QRCodeSVG } from 'qrcode.react'
import { T } from '@/lib/designTokens'

export function MemberQrCode({ qrToken }: { qrToken: string | null }) {
  if (!qrToken) {
    return (
      <div style={{ width: '140px', height: '140px', background: T.bgPanel, border: `1px dashed ${T.border}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkFainter, fontSize: '11px', textAlign: 'center', padding: '10px' }}>
        No QR code on file — contact your Secretary
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', display: 'inline-block', lineHeight: 0 }}>
      <QRCodeSVG value={qrToken} size={120} level="M" />
    </div>
  )
}
