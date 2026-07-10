import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin'

// Explicit allowlist rather than accepting an arbitrary request body.
// Deliberately EXCLUDES: id, slug (URL-identifying, changing it would
// break every existing link/QR code/bookmark to the lodge), member_count
// (system-maintained by a trigger, not hand-editable), stripe_customer_id/
// stripe_subscription_id (managed by the Stripe webhook, hand-editing
// would desync billing state), created_at/updated_at.
const EDITABLE_FIELDS = new Set([
  'name', 'number', 'address', 'city', 'state', 'zip',
  'email', 'phone', 'website',
  'primary_color', 'secondary_color', 'logo_url',
  'dues_amount', 'dues_due_month', 'timezone', 'is_active',
  'rite', 'jurisdiction',
  'about_text', 'history_text', 'meeting_schedule',
  'plan', 'subscription_status', // super admin specifically may need to override these directly (e.g. comping a lodge, resolving a stuck billing state) — a lodge's own Settings page does NOT expose these
])

export async function POST(request: Request) {
  try {
    const { tenantId, updates } = await request.json()
    if (!tenantId || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Missing tenantId or updates' }, { status: 400 })
    }

    const auth = await requireSuperAdmin()
    if (!auth.ok) return auth.response

    const sanitized: Record<string, unknown> = {}
    const rejected: string[] = []
    for (const [key, value] of Object.entries(updates)) {
      if (EDITABLE_FIELDS.has(key)) sanitized[key] = value
      else rejected.push(key)
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: 'No editable fields in updates', rejected }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: updated, error } = await supabase
      .from('tenants')
      .update(sanitized)
      .eq('id', tenantId)
      .select()
      .single()

    if (error) throw error
    if (!updated) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    return NextResponse.json({ success: true, tenant: updated, rejectedFields: rejected })
  } catch (error: any) {
    console.error('Super admin update tenant error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
