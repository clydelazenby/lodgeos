/**
 * Whether a piece of assigned work is done.
 *
 * THIS FUNCTION EXISTS BECAUSE THERE ARE TWO ANSWERS depending on what
 * was assigned, and re-deriving that on each page is how they end up
 * disagreeing:
 *
 * - A PLAIN TASK is completed by the brother himself. Nobody else can
 *   know when he has read the bylaws, so his own mark is the record and
 *   it lives on the assignment row.
 *
 * - A CURRICULUM STEP is signed off by an officer who heard it. Its
 *   completion lives in curriculum_progress and nowhere else. Storing a
 *   completed_at on the assignment as well would be a second source of
 *   truth, and the two would eventually differ — at which point the
 *   lodge has to decide which of its own records to believe.
 *
 * So: pass in the set of step ids this brother has been signed off on,
 * and this reads whichever answer applies.
 */

export type Assignment = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  step_id: string | null
  document_id: string | null
  completed_at: string | null
  cancelled_at: string | null
  submitted_at: string | null
  declined_at: string | null
  declined_by_name: string | null
  decline_note: string | null
  assigned_by_name: string | null
  created_at: string
}

export type AssignmentStatus =
  | 'open'
  | 'awaiting'    // he says he has done it; an officer has yet to decide
  | 'declined'    // sent back, with a reason
  | 'completed'
  | 'cancelled'
  | 'overdue'

export function assignmentStatus(
  a: Assignment,
  signedOffStepIds: Set<string>,
  today = new Date()
): AssignmentStatus {
  if (a.cancelled_at) return 'cancelled'

  const done = a.step_id ? signedOffStepIds.has(a.step_id) : !!a.completed_at
  if (done) return 'completed'

  /**
   * SUBMITTED OUTRANKS DECLINED, and both outrank overdue.
   *
   * A brother whose proficiency was sent back and who has since
   * resubmitted is waiting on an officer, not sitting on a refusal —
   * and the route clears declined_at when he resubmits, so this only
   * has to break the tie in the moment between the two writes.
   *
   * Both outrank overdue because "he is waiting on you" and "you sent
   * it back" are each more useful to show than "it is late", and the
   * due date is still printed beside the pill either way.
   */
  if (a.submitted_at) return 'awaiting'
  if (a.declined_at) return 'declined'

  /**
   * Overdue is compared on the DATE, not the instant. A task due today
   * is not overdue at nine in the morning, and treating a bare date as
   * midnight UTC would make it overdue before breakfast for anyone west
   * of Greenwich.
   */
  if (a.due_date) {
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    if (a.due_date < todayIso) return 'overdue'
  }

  return 'open'
}

/**
 * Whether the brother may SUBMIT this — which every assignment now
 * allows, task or degree work alike.
 *
 * Submitting is not completing. He is saying he has done it; an officer
 * decides whether it stands. That distinction is the whole point of the
 * flow: a proficiency the candidate marks off himself is not a
 * proficiency, and a task nobody was told about might as well not have
 * been finished.
 */
export function canSubmit(a: Assignment, status: AssignmentStatus): boolean {
  return status === 'open' || status === 'overdue' || status === 'declined'
}

/** Whether the assignee may mark this done outright. Nothing, now. */
export function selfCompletable(a: Assignment): boolean {
  return !a.step_id
}

export function statusPill(status: AssignmentStatus): string {
  switch (status) {
    case 'completed': return 'pill-active'
    case 'overdue': return 'pill-absent'
    case 'declined': return 'pill-absent'
    case 'awaiting': return 'pill-fc'
    case 'cancelled': return 'pill-new'
    default: return 'pill-excused'
  }
}

export function statusLabel(status: AssignmentStatus): string {
  switch (status) {
    case 'completed': return 'Signed off'
    case 'overdue': return 'Overdue'
    case 'declined': return 'Sent back'
    case 'awaiting': return 'Awaiting sign-off'
    case 'cancelled': return 'Withdrawn'
    default: return 'Open'
  }
}

/** "due in 3 days" / "due today" / "3 days late". Null when no due date. */
export function dueLabel(dueDate: string | null, today = new Date()): string | null {
  if (!dueDate) return null
  const due = new Date(dueDate + 'T12:00:00')
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  const days = Math.round((due.getTime() - now.getTime()) / 86_400_000)
  if (days === 0) return 'due today'
  if (days === 1) return 'due tomorrow'
  if (days > 1) return `due in ${days} days`
  if (days === -1) return '1 day late'
  return `${Math.abs(days)} days late`
}
