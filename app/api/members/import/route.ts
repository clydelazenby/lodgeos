import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole, type TenantRole } from '@/lib/auth/requireTenantAdmin'
import { sendWelcomeEmail, APP_URL } from '@/lib/email'
import { createInviteLink } from '@/lib/auth/inviteLink'
import { upsertProfilePreservingIdentity } from '@/lib/auth/profile'
import { DEGREE_VALUES } from '@/lib/degrees'
import { LODGE_BRAND_COLUMNS, toLodgeBrand } from '@/lib/email/brand'

/**
 * Bulk roster import.
 *
 * A secretary joining LodgeOS has the roster already — in a spreadsheet,
 * because that is what every lodge keeps. Typing forty brothers into the
 * one-at-a-time invite form is the single biggest obstacle to actually
 * adopting this, and it is entirely avoidable.
 *
 * The file is parsed IN THE BROWSER (see MemberImport.tsx) and arrives
 * here as plain rows. That keeps a binary .xlsx away from Vercel's
 * 4.5MB request-body limit and means this route only ever handles
 * validated JSON.
 *
 * SAFETY
 *
 * - dryRun returns the full report — every warning, every duplicate,
 *   every row that would be skipped — and writes nothing. The UI runs it
 *   first and makes the secretary confirm. Creating forty auth users and
 *   emailing forty brothers is not something to do on a mis-click.
 * - Invitation emails are opt-in and separate from the import itself. A
 *   secretary loading last year's roster to get the data in should not
 *   thereby email the whole lodge.
 * - Brothers already on the roster are reported and skipped, never
 *   duplicated or silently overwritten.
 * - Privilege escalation is blocked the same way the single-invite route
 *   blocks it: a Worshipful Master cannot use a spreadsheet column to
 *   grant someone admin or secretary access he does not hold himself.
 */

const MAX_ROWS = 500

const VALID_DEGREES = new Set(DEGREE_VALUES)
const VALID_TIERS = new Set<TenantRole>([
  'admin', 'secretary', 'grand_master', 'worshipful_master', 'treasurer', 'warden', 'deacon', 'member',
])
const ADMIN_TIER_ROLES = new Set<TenantRole>(['admin', 'secretary', 'grand_master'])

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type IncomingRow = {
  row: number
  firstName?: string
  lastName?: string
  email?: string
  degree?: string
  lodgeRole?: string
  tenantRole?: string
  phone?: string
}

export async function POST(request: Request) {
  try {
    const { tenantId, rows, dryRun, sendInvites } = await request.json()

    if (!tenantId || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Missing tenantId or rows.' }, { status: 400 })
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'That file had no data rows.' }, { status: 400 })
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `That file has ${rows.length} rows; the limit is ${MAX_ROWS} per import.` },
        { status: 400 }
      )
    }

    const auth = await requireTenantRole(tenantId, ['admin', 'secretary', 'grand_master', 'worshipful_master'])
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    // ---- Validate ----------------------------------------------

    type ValidRow = {
      row: number
      firstName: string
      lastName: string
      email: string
      degree: string
      lodgeRole: string | null
      tenantRole: TenantRole
      phone: string | null
    }

    const warnings: string[] = []
    const valid: ValidRow[] = []

    const seen = new Set<string>()

    for (const raw of rows as IncomingRow[]) {
      const line = raw.row ?? 0
      const email = raw.email?.trim().toLowerCase()
      const firstName = raw.firstName?.trim()
      const lastName = raw.lastName?.trim()

      if (!email) {
        warnings.push(`Row ${line}: skipped — no email address. An email is required to create a portal login.`)
        continue
      }
      if (!EMAIL_SHAPE.test(email)) {
        warnings.push(`Row ${line}: skipped — "${email}" is not a valid email address.`)
        continue
      }
      if (!firstName || !lastName) {
        warnings.push(`Row ${line}: skipped — both a first and last name are required (${email}).`)
        continue
      }
      if (seen.has(email)) {
        warnings.push(`Row ${line}: skipped — "${email}" appears more than once in this file.`)
        continue
      }

      // A roster spreadsheet says "Knight Templar", not
      // "KNIGHT_TEMPLAR" — nobody types the stored form by hand. Fold
      // spaces to underscores so the labels a Secretary would actually
      // write match the values, same normalisation the tier field below
      // already does.
      const degree = (raw.degree?.trim().toUpperCase().replace(/\s+/g, '_') || 'MM')
      if (!VALID_DEGREES.has(degree)) {
        warnings.push(
          `Row ${line}: skipped — degree "${raw.degree}" is not one this lodge recognises (${email}). ` +
          `Use EA, FC, MM, or an appendant degree such as Royal Arch or Knight Templar.`
        )
        continue
      }

      const tier = (raw.tenantRole?.trim().toLowerCase().replace(/\s+/g, '_') || 'member') as TenantRole
      if (!VALID_TIERS.has(tier)) {
        warnings.push(`Row ${line}: skipped — access level "${raw.tenantRole}" is not a recognised role (${email}).`)
        continue
      }
      // Same escalation guard as the single-invite route: a spreadsheet
      // column must not be a way to hand out access the importer does
      // not hold himself.
      if (ADMIN_TIER_ROLES.has(tier) && !ADMIN_TIER_ROLES.has(auth.tenantRole)) {
        warnings.push(
          `Row ${line}: skipped — only a Secretary, Grand Master or admin can grant the "${tier}" role (${email}).`
        )
        continue
      }

      seen.add(email)
      valid.push({
        row: line, firstName, lastName, email, degree,
        lodgeRole: raw.lodgeRole?.trim() || null,
        tenantRole: tier,
        phone: raw.phone?.trim() || null,
      })
    }

    // ---- Who is already here -----------------------------------

    const emails = valid.map((v) => v.email)
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', emails.length ? emails : ['__none__'])

    const profileIdByEmail = new Map<string, string>()
    for (const p of existingProfiles ?? []) {
      if ((p as any).email) profileIdByEmail.set((p as any).email.toLowerCase(), (p as any).id)
    }

    const { data: existingMembers } = await supabase
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .in('user_id', Array.from(profileIdByEmail.values()).length
        ? Array.from(profileIdByEmail.values())
        : ['00000000-0000-0000-0000-000000000000'])

    const alreadyMemberIds = new Set((existingMembers ?? []).map((m: any) => m.user_id))
    const alreadyOnRoster = valid.filter((v) => {
      const id = profileIdByEmail.get(v.email)
      return id && alreadyMemberIds.has(id)
    })
    const toCreate = valid.filter((v) => {
      const id = profileIdByEmail.get(v.email)
      return !(id && alreadyMemberIds.has(id))
    })

    for (const dup of alreadyOnRoster) {
      warnings.push(`${dup.firstName} ${dup.lastName} (${dup.email}) is already on the roster — left unchanged.`)
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        rowsRead: rows.length,
        toImport: toCreate.length,
        alreadyOnRoster: alreadyOnRoster.length,
        skipped: rows.length - valid.length,
        preview: toCreate.slice(0, 25).map((v) => ({
          name: `${v.firstName} ${v.lastName}`, email: v.email,
          degree: v.degree, lodgeRole: v.lodgeRole, tenantRole: v.tenantRole,
        })),
        warnings,
      })
    }

    if (toCreate.length === 0) {
      return NextResponse.json(
        { error: 'Nothing to import — every valid row is already on the roster.', warnings },
        { status: 400 }
      )
    }

    // ---- Create ------------------------------------------------

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const { data: tenant } = await supabase
      .from('tenants')
      .select(`id, ${LODGE_BRAND_COLUMNS}`)
      .eq('id', tenantId)
      .single()

    const lodgeName = tenant ? `${tenant.name} #${tenant.number}` : 'your lodge'

    let imported = 0
    let invited = 0
    const failures: { email: string; reason: string }[] = []

    for (const v of toCreate) {
      let actionUrl: string | null = null

      try {
        let profileId = profileIdByEmail.get(v.email)

        if (!profileId) {
          // createInviteLink creates the auth user and mints the
          // sign-in link WITHOUT sending anything — the welcome email
          // below is the only message, and it goes out through Resend.
          // (Its predecessor here, inviteUserByEmail, delegated sending
          // to Supabase's own mailer; see lib/auth/inviteLink.ts for
          // why those invitations never arrived.) When the secretary
          // has asked NOT to notify anyone yet, createUser is used
          // instead so the roster loads silently and the brothers can
          // be emailed later.
          if (sendInvites) {
            const invite = await createInviteLink(supabase, {
              email: v.email,
              firstName: v.firstName,
              lastName: v.lastName,
              appUrl: APP_URL,
            })
            profileId = invite.userId ?? undefined
            actionUrl = invite.actionUrl
            if (invite.warning) warnings.push(`${v.email}: ${invite.warning}`)
          } else {
            const { data: created, error } = await supabase.auth.admin.createUser({
              email: v.email,
              email_confirm: false,
              user_metadata: { first_name: v.firstName, last_name: v.lastName },
            })
            if (error && !error.message.includes('already registered')) throw error
            profileId = created?.user?.id
          }

          // A brother who already had an auth account but no profile row
          // returns "already registered" above with no user payload.
          if (!profileId) {
            const { data: found } = await supabase
              .from('profiles').select('id').eq('email', v.email).maybeSingle()
            profileId = found?.id
          }
        }

        if (!profileId) {
          failures.push({ email: v.email, reason: 'Could not create or find an account for this address.' })
          continue
        }

        // The profiles row is normally created by a signup trigger;
        // this works whether or not that has fired yet, and so names
        // from the spreadsheet fill in blanks — which is what the
        // upsert here always claimed to do but did not: it overwrote
        // them, so importing a roster containing a brother who also
        // belongs to another lodge renamed him there.
        await upsertProfilePreservingIdentity(supabase, {
          id: profileId,
          email: v.email,
          firstName: v.firstName,
          lastName: v.lastName,
          phone: v.phone,
        })

        const { error: memberError } = await supabase.from('tenant_members').upsert({
          tenant_id: tenantId,
          user_id: profileId,
          degree: v.degree,
          lodge_role: v.lodgeRole,
          tenant_role: v.tenantRole,
          dues_status: 'due',
          is_active: true,
        }, { onConflict: 'tenant_id,user_id' })

        if (memberError) throw memberError

        imported++

        if (sendInvites) {
          try {
            await sendWelcomeEmail({
              to: v.email,
              firstName: v.firstName,
              lodgeName,
              lodgeSlug: tenant?.slug ?? '',
              loginUrl: `${appUrl}/auth/login`,
              actionUrl,
              brand: toLodgeBrand(tenant),
            })
            invited++
          } catch (mailErr: any) {
            // The brother IS on the roster; only the welcome email
            // failed. Report it without failing his import.
            warnings.push(`${v.email} was added, but the welcome email could not be sent: ${mailErr?.message}`)
          }
        }
      } catch (err: any) {
        failures.push({ email: v.email, reason: err?.message || 'Unknown error' })
      }
    }

    return NextResponse.json({
      success: imported > 0,
      imported,
      invited,
      alreadyOnRoster: alreadyOnRoster.length,
      failed: failures.length,
      failures,
      warnings,
    })
  } catch (error: any) {
    console.error('Member import error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
