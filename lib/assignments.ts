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
  assigned_by_name: string | null
  created_at: string
}

export type AssignmentStatus = 'open' | 'completed' | 'cancelled' | 'overdue'

export function assignmentStatus(
  a: Assignment,
  signedOffStepIds: Set<string>,
  today = new Date()
): AssignmentStatus {
  if (a.cancelled_at) return 'cancelled'

  const done = a.step_id ? signedOffStepIds.has(a.step_id) : !!a.completed_at
  if (done) return 'completed'

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

/** Whether the assignee may mark this done himself. */
export function selfCompletable(a: Assignment): boolean {
  return !a.step_id
}

export function statusPill(status: AssignmentStatus): string {
  switch (status) {
    case 'completed': return 'pill-active'
    case 'overdue': return 'pill-absent'
    case 'cancelled': return 'pill-new'
    default: return 'pill-excused'
  }
}

export function statusLabel(status: AssignmentStatus): string {
  switch (status) {
    case 'completed': return 'Done'
    case 'overdue': return 'Overdue'
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
