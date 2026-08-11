import { ALL_OFFICES, STATION_NAMES } from '@/lib/stations'

/**
 * What each chair is responsible for.
 *
 * WHY THE DEFAULTS ARE IN CODE AND THE EDITS ARE IN THE DATABASE. A
 * lodge that has never touched this should still see something useful
 * the first time a new Junior Steward asks what he is meant to do —
 * an empty page teaches nobody anything. But the text below is a
 * STARTING POINT, not an authority: duties differ by jurisdiction and
 * by a lodge's own bylaws, and the Grand Lodge of North Carolina does
 * not owe agreement to a paragraph written here.
 *
 * So: no row means the default, a row means the lodge has written its
 * own, and resetting deletes the row rather than copying the default
 * into it. Same rule as the permission and notification tables, and
 * for the same reason — a stored copy of today's default silently
 * stops tracking it.
 *
 * THE TEXT IS DELIBERATELY PLAIN. It says what the man does, in the
 * order he does it, without ritual particulars: nothing here is
 * esoteric, and the page is readable by every brother of the lodge.
 */

export const DEFAULT_DUTIES: Record<string, string> = {
  'Worshipful Master':
    'Presides over the lodge and is answerable for everything done in it. Opens and closes each communication, sets the agenda with the Secretary, appoints committees, and rules on questions of order. Confers degrees or assigns them. Represents the lodge to the Grand Lodge and to the public. Signs, with the Secretary, the minutes once approved and the lodge\'s returns.',

  'Senior Warden':
    'Second in the lodge, and assists the Master in the government of it. Presides in the Master\'s absence and is expected to be ready to do so without notice. Oversees the craft at labour, sees that every brother has work suited to him, and reports the state of the lodge to the Master. Traditionally in line to be Master, so acts throughout the year as a man learning to fill the chair.',

  'Junior Warden':
    'Third in the lodge. Has charge of the craft during refreshment and is responsible for the lodge\'s conduct outside labour — the meal, the hospitality, the reception of visitors. Sees that no brother converts refreshment into intemperance or excess. Presides in the absence of both the Master and the Senior Warden, and commonly oversees the lodge\'s standing committees on conduct.',

  'Treasurer':
    'Receives all money from the Secretary, keeps it in the lodge\'s account, and pays it out only on the order of the Worshipful Master with the consent of the lodge. Keeps a true account of receipts and disbursements, reports the lodge\'s financial position at each communication, and renders a full account at the close of the year and for the annual return.',

  'Secretary':
    'The lodge\'s recording officer and its memory. Records the minutes of every communication and reads them for approval. Receives all money and hands it to the Treasurer, taking his receipt. Keeps the roster, collects dues, issues notices and summonses, conducts the lodge\'s correspondence, and files its returns with the Grand Lodge on time. Custodian of the lodge\'s books and seal.',

  'Chaplain':
    'Offers prayer at the opening and closing of the lodge and at its ceremonies and meals. Attends to the spiritual welfare of the brethren, visits the sick and distressed, and represents the lodge at funerals and at times of bereavement. Often the first to hear that a brother is in trouble, and the one who tells the Master.',

  'Marshal':
    'Master of ceremonies. Forms and conducts processions, presents candidates and distinguished visitors, announces receptions, and sees that the lodge\'s public occasions are conducted with order and dignity. Works closely with the Master on the arrangement of installations and special communications.',

  'Senior Deacon':
    'Carries messages and orders from the Master in the East to the Senior Warden in the West, and elsewhere about the lodge as directed. Receives and conducts candidates. Attends the Master, welcomes and accommodates visiting brethren, and sees to the proper arrangement of the lodge room before the meeting begins.',

  'Junior Deacon':
    'Carries messages from the Senior Warden in the West to the Junior Warden in the South. Attends at the door of the lodge, sees that it is properly guarded, and reports to the Master. Receives and reports the Tyler\'s alarms, and admits those entitled to enter. Assists the Senior Deacon with candidates.',

  'Senior Steward':
    'Assists the Deacons and the Junior Warden. Sees to the comfort and refreshment of the brethren, helps prepare candidates, and attends to the lodge\'s hospitality. Commonly the first office a brother is appointed to, and the beginning of the progressive line.',

  'Junior Steward':
    'Assists the Senior Steward in the care and refreshment of the brethren and in the preparation of candidates. Serves wherever the Wardens or Deacons require help. Like the Senior Steward, a learning office — the year is spent watching how the lodge is run.',

  'Tyler':
    'Guards the door of the lodge from the outside. Admits no one who is not entitled to enter, and reports every alarm to the Junior Deacon. Sees that every brother is properly clothed, prepares the lodge room and the aprons before the meeting, and secures the room after it. The only officer stationed outside the lodge, and the last to leave it.',

  'Past Master':
    'A brother who has served as Worshipful Master. Holds no station by right, but is a standing source of counsel to the Master and the line, and is called on to fill a chair, sit on committees, and instruct candidates. His experience is the lodge\'s continuity from one year to the next.',

  'Organist':
    'Provides music for the opening and closing of the lodge, for its degrees, and for its public occasions. Works with the Master and the Marshal so that music supports the ceremony rather than interrupting it.',

  'Historian':
    'Keeps the lodge\'s history: its records, photographs, jewels, minute books and artefacts. Records notable events as they happen rather than reconstructing them later, and answers enquiries about the lodge\'s past. Works with the Secretary, whose records are the raw material.',

  'Almoner':
    'Attends to brethren and their families in need — the sick, the bereaved, the widow. Visits, reports to the Master and the Chaplain, and administers relief as the lodge directs. Keeps confidences absolutely: the office depends on a brother being able to ask for help without the lodge at large hearing of it.',

  'Trustee':
    'Holds and cares for the lodge\'s property — its building, its investments, its permanent funds — on behalf of the members. Acts only as the lodge directs, reports on the condition of what is held, and makes recommendations for its upkeep and its long-term security.',
}

/** Every office the Duties page lists, in the order the lodge sits. */
export const DUTY_OFFICES: string[] = ALL_OFFICES

/** Whether this office is one of the twelve seated in the Lodge Room. */
export function isStation(office: string): boolean {
  return STATION_NAMES.includes(office)
}

export function defaultDuties(office: string): string {
  return DEFAULT_DUTIES[office.trim()] ?? ''
}

/**
 * WHO MAY REWRITE THE DUTIES.
 *
 * The administrative office by TIER, plus the Master's and the Senior
 * Warden's chairs by OFFICE — deliberately the same set that hears the
 * roster notices (lib/notifications.ts), because it is the same
 * question: who speaks for how this lodge is run.
 *
 * By office rather than by name so it passes at the annual handover.
 * If a lodge wants somebody else to keep this, the two constants below
 * are the only thing to change.
 */
export const DUTIES_EDITOR_TIERS = new Set(['admin', 'secretary', 'grand_master'])
export const DUTIES_EDITOR_OFFICES = new Set(['Worshipful Master', 'Senior Warden'])

export function canEditDuties(
  tenantRole: string | null | undefined,
  lodgeRole: string | null | undefined,
  isSuperAdmin = false
): boolean {
  if (isSuperAdmin) return true
  if (tenantRole && DUTIES_EDITOR_TIERS.has(tenantRole)) return true
  return DUTIES_EDITOR_OFFICES.has((lodgeRole ?? '').trim())
}

/** "senior-warden" — for linking straight to one office's entry. */
export function officeAnchor(office: string): string {
  return office.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
