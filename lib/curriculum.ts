/**
 * The work of a degree, as a lodge defines it.
 *
 * A folder says where a file lives. A curriculum says what a candidate
 * does next, in what order, and how far along he is — which is the
 * thing a mentor actually needs and the thing a candidate actually
 * wants. Before this, degree_progress could say only that a man was
 * conferred on one date and passed his proficiency on another, with
 * nothing in between; "how is he getting on?" could be answered only as
 * "no progress recorded in 45 days", which is a symptom, not an answer.
 */

export const CURRICULUM_DEGREES = ['EA', 'FC', 'MM'] as const
export type CurriculumDegree = typeof CURRICULUM_DEGREES[number]

export const DEGREE_TITLE: Record<CurriculumDegree, string> = {
  EA: 'Entered Apprentice',
  FC: 'Fellowcraft',
  MM: 'Master Mason',
}

/**
 * A conventional outline, offered as a starting point and expected to
 * be edited.
 *
 * DELIBERATELY NOT SEEDED AUTOMATICALLY. Jurisdictions differ on what
 * is required, in what order, and what is merely customary — a
 * curriculum written into every lodge on the platform at signup would
 * be wrong for most of them and, worse, would carry the app's
 * authority. A lodge that clicks "start from this outline" has made a
 * choice and knows it is theirs to change.
 *
 * Kept generic for the same reason: these are the stages nearly every
 * jurisdiction has in some form, named plainly, with nothing that would
 * be out of place read aloud.
 */
export const STARTER_OUTLINE: Record<CurriculumDegree, { title: string; description: string; required: boolean }[]> = {
  EA: [
    { title: 'Degree conferred', description: 'The date the degree was conferred upon him.', required: true },
    { title: 'Mentor assigned', description: 'A brother appointed to guide him through this degree.', required: true },
    { title: 'Obligation and charge reviewed', description: 'Gone through with his mentor after the degree.', required: true },
    { title: 'Catechism — first section', description: 'Learned and heard by his mentor.', required: true },
    { title: 'Catechism — complete', description: 'The whole of the proficiency, ready to be delivered.', required: true },
    { title: 'Proficiency delivered in open lodge', description: 'Returned to the lodge and accepted.', required: true },
    { title: 'Attended a stated communication', description: 'Present at a meeting between his degrees.', required: false },
  ],
  FC: [
    { title: 'Degree conferred', description: 'The date the degree was conferred upon him.', required: true },
    { title: 'Obligation and charge reviewed', description: 'Gone through with his mentor after the degree.', required: true },
    { title: 'Middle Chamber lecture studied', description: 'The lecture of the degree, with his mentor.', required: true },
    { title: 'Catechism — complete', description: 'The whole of the proficiency, ready to be delivered.', required: true },
    { title: 'Proficiency delivered in open lodge', description: 'Returned to the lodge and accepted.', required: true },
    { title: 'Attended a stated communication', description: 'Present at a meeting between his degrees.', required: false },
  ],
  MM: [
    { title: 'Degree conferred', description: 'The date he was raised.', required: true },
    { title: 'Obligation and charge reviewed', description: 'Gone through with his mentor after the degree.', required: true },
    { title: 'Catechism — complete', description: 'The whole of the proficiency, ready to be delivered.', required: true },
    { title: 'Proficiency delivered in open lodge', description: 'Returned to the lodge and accepted.', required: true },
    { title: 'Lodge bylaws read', description: 'The rules of the lodge he has joined.', required: false },
    { title: 'Introduced to lodge committees', description: 'Where he might serve.', required: false },
  ],
}

export type Step = {
  id: string
  degree: string
  title: string
  description: string | null
  sort_order: number
  document_id: string | null
  required: boolean
}

export type Progress = { step_id: string; completed_on: string; signed_off_by_name: string | null; notes: string | null }

/**
 * How far along he is, counting only what the lodge marked required.
 *
 * Optional steps are genuinely optional — a candidate who has done
 * every required thing is ready, and a progress bar that refuses to
 * reach the end because he has not yet been introduced to the
 * committees would be lying about what is holding him up.
 */
export function completion(steps: Step[], done: Set<string>): { done: number; total: number; percent: number } {
  const required = steps.filter((s) => s.required)
  const completed = required.filter((s) => done.has(s.id)).length
  return {
    done: completed,
    total: required.length,
    percent: required.length === 0 ? 0 : Math.round((completed / required.length) * 100),
  }
}

/** The first required step he has not finished — literally what to do next. */
export function nextStep(steps: Step[], done: Set<string>): Step | null {
  return (
    [...steps]
      .sort((a, b) => a.sort_order - b.sort_order)
      .find((s) => s.required && !done.has(s.id)) ?? null
  )
}
