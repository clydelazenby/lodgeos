'use server'

import { revalidatePath } from 'next/cache'

/**
 * Purges the cached public lodge page after a secretary edits lodge
 * settings.
 *
 * app/[slug]/page.tsx is now incrementally statically regenerated with
 * a one-hour window (see the `revalidate` export there). That window is
 * the fallback for changes nobody told us about; this action is the
 * fast path for the change we DO know about, so an edit to the lodge
 * name, meeting times, or about text is live immediately rather than up
 * to an hour later.
 *
 * Safe to call from a client component — it takes only a slug, and
 * revalidation grants no data access of its own. Worst case someone
 * calls it with an arbitrary slug and causes that public page to be
 * regenerated from the database, which is exactly what it would do on
 * its own an hour later anyway.
 */
export async function revalidateLodgePage(slug: string) {
  revalidatePath(`/${slug}`)

  // The donate page is separately cached and separately gated: it 404s
  // until donations are enabled. Without purging it too, a secretary who
  // visited /donate before switching donations on would keep getting the
  // cached 404 for up to an hour after saving — the button would appear
  // on the homepage and lead somewhere that still said the lodge did not
  // exist.
  revalidatePath(`/${slug}/donate`)
}
