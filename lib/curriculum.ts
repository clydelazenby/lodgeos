import { DEGREE_VALUES, degreeLabel } from '@/lib/degrees'

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

/**
 * EVERY DEGREE, not the three the Blue Lodge confers.
 *
 * Migration 031 restricted this to EA/FC/MM on the reasoning that
 * appendant bodies are separate organisations with their own work. That
 * holds for who CONFERS a degree and turns out to be the wrong reason
 * to refuse the column: a lodge mentors its brethren past the third
 * degree whether or not it confers what comes next. Someone tells a new
 * Master Mason what the York Rite is; someone notices a brother has
 * been a Noble for a year and never been asked to do anything.
 *
 * One list, shared with the roster (lib/degrees.ts), so a brother
 * recorded at 32° can have a 32° curriculum rather than falling off the
 * end of the tracker.
 */
export const CURRICULUM_DEGREES = DEGREE_VALUES

/** Any of the seventeen degree codes. Widened from EA/FC/MM in 034. */
export type CurriculumDegree = string

export function degreeTitle(value: string): string {
  return degreeLabel(value)
}

/**
 * Kept for the call sites that read it as a map. Backed by the same
 * single list, so it cannot drift from the roster's vocabulary.
 */
export const DEGREE_TITLE: Record<string, string> = Object.fromEntries(
  DEGREE_VALUES.map((v) => [v, degreeLabel(v)])
)

/**
 * A conventional outline, offered as a starting point and expected to
 * be edited.
 *
 * DELIBERATELY NOT SEEDED AUTOMATICALLY, and deliberately BLUE LODGE
 * ONLY. Jurisdictions differ on what is required, in what order, and
 * what is merely customary — an outline written into every lodge on the
 * platform at signup would be wrong for most of them and would carry
 * the app's authority while being wrong. Beyond the third degree the
 * app has no business inventing what the Scottish Rite requires at all;
 * those steps are written by the lodge or not written.
 *
 * A degree with no outline simply offers no "start from" button. The
 * officer writes the steps himself, which is the honest option.
 */
export const STARTER_OUTLINE: Record<string, { title: string; description: string; required: boolean }[]> = {
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
