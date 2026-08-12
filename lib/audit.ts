import { createServiceClient } from '@/lib/supabase/server'

/**
 * Recording who did what.
 *
 * Called from the routes that make changes worth answering for later —
 * money, roster, degrees, records. The three rules this file exists to
 * enforce:
 *
 * IT NEVER BREAKS THE THING IT IS RECORDING. Every call is best-effort
 * and swallows its own failure. A dues payment that succeeded must not
 * be reported as failed because the audit insert hit a constraint, and
 * an officer must never be told to retry an action that already worked.
 * A missing audit row is a gap; a failed write the officer repeats is
 * a double charge.
 *
 * IT IS WRITTEN AFTER THE FACT, NOT BEFORE. Log what happened, not what
 * is about to. An entry written first would claim a change that a
 * subsequent error rolled back.
 *
 * THE SUMMARY IS THE RECORD. One sentence, written where the code knows
 * what it just did, in the words a Secretary would use. The audit page
 * renders these; it does not reassemble prose from columns, and a
 * summary that reads "UPDATE tenant_members SET dues_status" helps
 * nobody standing in front of a brother with a receipt.
 */

export type AuditEntry = {
  tenantId: string
  /** Machine-readable verb, e.g. 'member.removed', 'dues.charged'. */
  action: string
  /** One sentence in plain language. This is what the page shows. */
  summary: string
  /** The profile that acted; omit for a system actor such as a cron. */
  actorId?: string | null
  /** Their name at the time of acting — see below for why it is stored. */
  actorName?: string | null
  entityType?: string | null
  entityId?: string | null
  detail?: Record<string, any> | null
}

/**
 * The actor's name is DENORMALISED ON PURPOSE.
 *
 * Joining to profiles at read time would give the officer's name as it
 * is today, not as it was when he acted — and worse, an entry made by
 * someone since removed from the lodge would render as a blank. An
 * audit trail whose oldest and most interesting entries lose their
 * author is not much of one. The name is copied in at write time and
 * never updated.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('audit_log').insert({
      tenant_id: entry.tenantId,
      actor_id: entry.actorId ?? null,
      actor_name: entry.actorName ?? null,
      action: entry.action,
      summary: entry.summary.slice(0, 500),
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      detail: entry.detail ?? null,
    })
  } catch (error) {
    // Deliberately swallowed. See the header: the audit must never be
    // the reason a completed action reports failure. Logged so it is
    // discoverable in the server logs rather than silent everywhere.
    console.error('Audit write failed (the action itself succeeded):', error)
  }
}

/**
 * Looks up an actor's display name once, for routes that hold a user id
 * and nothing else. Best-effort, like everything here: a name that
 * cannot be read yields null and the entry is still written.
 */
export async function actorName(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .maybeSingle()
    if (!data) return null
    const name = `${(data as any).first_name ?? ''} ${(data as any).last_name ?? ''}`.trim()
    return name || null
  } catch {
    return null
  }
}

/** Labels for the audit page's filter, and its headings. */
export const AUDIT_ACTIONS: Record<string, string> = {
  'member.invited': 'Brother invited',
  'member.removed': 'Taken off the roster',
  'member.reinstated': 'Reinstated',
  'member.imported': 'Roster imported',
  'member.role_changed': 'Permission tier changed',
  'member.capability_changed': 'Permission changed',
  'office.capability_changed': 'Office permission changed',
  'member.degree_changed': 'Degree changed',
  'member.dates': 'Masonic dates recorded',
  'dues.rate_changed': 'Dues rate changed',
  'dues.charged': 'Charge added',
  'dues.reminded': 'Dues reminders sent',
  'degree.progress': 'Degree progress recorded',
  'communication.sent': 'Notice sent',
  'minutes.approved': 'Minutes approved',
  'document.uploaded': 'Document uploaded',
  'document.deleted': 'Document deleted',
  'document.updated': 'Document details changed',
  'member.invite_resent': 'Invitation sent again',
  'gallery.visibility': 'Photograph shown or hidden',
  'gallery.deleted': 'Photograph deleted',
  'gallery.announced': 'Lodge told about new photographs',
  'duties.updated': 'Officer duties rewritten',
  'duties.reset': 'Officer duties reset to standard',
  'petition.status': 'Petition status changed',
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action] ?? action
}
