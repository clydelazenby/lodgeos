import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { DonateOptions } from '@/components/public/DonateOptions'

/**
 * Public donation page.
 *
 * WHAT THIS DOES AND DELIBERATELY DOES NOT DO
 *
 * LodgeOS does not take the money. It presents the lodge's own payment
 * handles and, where the app supports it, builds a link with the amount
 * already filled in. Nothing is charged here and no card details are
 * collected — the donor completes the gift in Cash App, Venmo, or their
 * own banking app.
 *
 * That is a deliberate choice, not a shortcut. Processing donations
 * ourselves would mean holding another organisation's money in transit,
 * a payout schedule, refund handling, and 1099-K reporting. A lodge
 * taking gifts to its own Truist account through the apps its members
 * already use avoids all of that, and keeps every dollar.
 *
 * NO BANK DETAILS ARE STORED OR SHOWN. Zelle is addressed by the email
 * or phone enrolled with the bank, which is all a donor needs. Account
 * and routing numbers appear nowhere in this app.
 */

export const revalidate = 3600

export async function generateMetadata({
  params,
}: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createServiceClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, number')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!tenant) return { title: 'Lodge Not Found' }
  return {
    title: `Donate — ${tenant.name} #${tenant.number}`,
    description: `Support ${tenant.name} #${tenant.number}.`,
  }
}

export default async function DonatePage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  /**
   * select('*') rather than a column list, matching the lodge homepage.
   *
   * This page originally named all eleven columns explicitly. PostgREST
   * rejects the whole query if ANY named column is missing, so a
   * partially-applied migration returned an error, `data` came back
   * null, and the `!tenant` branch below rendered "No Lodge At This
   * Address" — a database error wearing a missing-lodge costume, with
   * nothing in the response to tell them apart. The homepage kept
   * working throughout because select('*') simply returns whatever
   * columns exist.
   */
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle()

  // A failed query is NOT a missing lodge. Conflating them is what made
  // this undiagnosable; rethrowing sends it to the error boundary with a
  // real message and puts the cause in the server log.
  if (error) {
    console.error('Donate page: tenant query failed', { slug: params.slug, error })
    throw new Error(`Could not load this lodge: ${error.message}`)
  }

  if (!tenant) notFound()

  const hasAnyMethod = Boolean(tenant.cashapp_handle || tenant.venmo_handle || tenant.zelle_handle)

  // A lodge that has switched donations off, or never configured a
  // handle, gets a 404 rather than an empty page inviting a gift it
  // cannot receive.
  if (!tenant.donations_enabled || !hasAnyMethod) notFound()

  const gold = '#C9A84C'
  const navy = '#0A0E1A'
  const panel = '#142234'
  const cream = '#F5F0E8'

  return (
    <div style={{ minHeight: '100vh', background: navy, color: cream, padding: '2.5rem 1rem' }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link
            href={`/${tenant.slug}`}
            style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', letterSpacing: '0.2em', color: '#B8B0A0', textDecoration: 'none' }}
          >
            ← {tenant.name} #{tenant.number}
          </Link>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.7rem', color: gold, margin: '1rem 0 0.5rem' }}>
            Support the Lodge
          </h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', color: '#DCCFB5', lineHeight: 1.7, margin: 0 }}>
            {tenant.donation_message ||
              `Your gift supports the work and charity of ${tenant.name} #${tenant.number}.`}
          </p>
        </div>

        <DonateOptions
          lodgeName={`${tenant.name} #${tenant.number}`}
          cashapp={tenant.cashapp_handle}
          venmo={tenant.venmo_handle}
          zelle={tenant.zelle_handle}
          zelleName={tenant.zelle_name}
        />

        <div
          style={{
            marginTop: '2rem', padding: '1.25rem', background: panel,
            border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8,
            fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: '#B8B0A0', lineHeight: 1.7,
          }}
        >
          Gifts go directly to the lodge through the app you choose — nothing is charged on this page
          and no card details are collected here.
          {tenant.email && (
            <>
              {' '}Questions about a donation? Write to{' '}
              <a href={`mailto:${tenant.email}`} style={{ color: gold }}>{tenant.email}</a>.
            </>
          )}
          <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#918879' }}>
            The lodge is not necessarily a registered charity — check with the Secretary before
            treating a gift as tax-deductible.
          </div>
        </div>
      </div>
    </div>
  )
}
