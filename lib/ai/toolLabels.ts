/**
 * What to show the officer while a tool runs.
 *
 * The panel said "Working…" for the whole request — up to five rounds of
 * tool calls and three thousand tokens of drafting, which is twenty or
 * thirty seconds of a caret blinking at nothing. Naming the lookup turns
 * dead time into visible progress, and it costs nothing: the tool names
 * are already on the server the moment the model asks for them.
 *
 * Phrased as what a person would say, not as the function name. The
 * officer does not need to know there is a table called tenant_members.
 */
const TOOL_LABELS: Record<string, string> = {
  get_outstanding_dues: 'Checking who owes dues',
  get_roster_summary: 'Reading the roster',
  find_member: 'Looking up that brother',
  get_attendance_summary: 'Going through attendance',
  get_stalled_candidates: 'Checking candidate progress',
  get_upcoming_events: 'Checking the calendar',
  get_pending_petitions: 'Reading pending petitions',
  get_recent_attendance: 'Pulling up the last meeting',
  get_meeting_record: 'Reading the record of that meeting',
}

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? 'Looking that up'
}
