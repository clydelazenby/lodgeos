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

  /**
   * THE GALLERY, and the reason this list exists at all.
   *
   * The front page is regenerated at most once an hour. A Secretary who
   * posted the lodge's first photograph therefore kept being served the
   * HTML from BEFORE it existed — in which there were no photographs,
   * so the gallery section was omitted and, with it, the Gallery entry
   * in both navigation menus. The photograph was posted correctly, the
   * database was right, and the website said nothing had happened.
   * That was reported, correctly, as "the gallery button doesn't work".
   *
   * Every page that renders gallery rows has to be listed here, or the
   * same bug comes straight back on whichever one is forgotten.
   */
  revalidatePath(`/${slug}/gallery`)

  // The donate page is separately cached and separately gated: it 404s
  // until donations are enabled. Without purging it too, a secretary who
  // visited /donate before switching donations on would keep getting the
  // cached 404 for up to an hour after saving — the button would appear
  // on the homepage and lead somewhere that still said the lodge did not
  // exist.
  revalidatePath(`/${slug}/donate`)
}
