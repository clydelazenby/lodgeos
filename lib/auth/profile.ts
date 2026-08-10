import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a brother's profile row, or fills in blanks on one that
 * already exists — never overwrites identity fields that are set.
 *
 * WHY NOT A PLAIN UPSERT.
 *
 * `profiles` is GLOBAL: one row per person, shared by every lodge they
 * belong to. The names here come from whatever a Secretary typed into
 * an invite form or had in a roster spreadsheet. Upserting those
 * unconditionally means adding a brother to a SECOND lodge silently
 * renames him in his first one and in his own portal — spelling,
 * nickname, and all — because both memberships point at the same row.
 *
 * An invitation may supply a name the brother does not have yet. It
 * may not rewrite one he already has; that is his to change.
 */
export async function upsertProfilePreservingIdentity(
  admin: SupabaseClient,
  {
    id,
    email,
    firstName,
    lastName,
    phone,
  }: {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
    phone?: string | null
  }
): Promise<void> {
  const { data: existing } = await admin
    .from('profiles')
    .select('id, first_name, last_name, phone')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    // upsert rather than insert: the signup trigger may have created
    // the row in the moment since that read. Losing the race is
    // harmless — the trigger builds the row from the same user_metadata
    // this invitation just supplied.
    await admin.from('profiles').upsert({
      id,
      email,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
      ...(phone ? { phone } : {}),
    }, { onConflict: 'id' })
    return
  }

  // Blanks only. The existing email is left alone too — it is what
  // identified this brother in the first place.
  const patch: Record<string, string> = {}
  if (firstName && !existing.first_name) patch.first_name = firstName
  if (lastName && !existing.last_name) patch.last_name = lastName
  if (phone && !existing.phone) patch.phone = phone

  if (Object.keys(patch).length > 0) {
    await admin.from('profiles').update(patch).eq('id', id)
  }
}
