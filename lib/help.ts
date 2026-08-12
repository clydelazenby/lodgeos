/**
 * The manual, moved to where the question gets asked.
 *
 * WHY THIS EXISTS. There is a 47-page user manual. A new Junior
 * Steward standing in the lodge room with his phone out does not have
 * it, will not find it, and would not know which of its thirty-six
 * sections answers him. Everything he needs is one paragraph long and
 * belongs on the screen he is already stuck on.
 *
 * So the same words live here, keyed by route, and a single ? in the
 * header opens whichever one matches the page he is on. He does not
 * choose a topic; the app already knows which page he is looking at.
 *
 * NO SERVER IMPORTS, EVER. This module is read by a client component
 * in both layouts. lib/notifications.ts broke the build once by
 * reaching, three hops down, into something that imports next/headers.
 * Everything here is plain data and pure functions — keep it that way.
 *
 * WHY BUNDLED RATHER THAN FETCHED. It is static prose, identical for
 * every lodge, and fetching it would buy a loading state, a failure
 * path and a 405 waiting to happen (see OfficeDutyLink) in exchange for
 * a few kilobytes on a chunk the browser caches once. Help that
 * sometimes fails to load is worse than no help, because a man who
 * tried it once and got a spinner does not try it again.
 */

export type HelpBlock =
  | { kind: 'p'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'table'; head?: [string, string]; rows: [string, string][] }
  | { kind: 'note'; title: string; text: string }
  | { kind: 'warn'; title: string; text: string }

export type HelpGroup =
  | 'For every brother'
  | 'Running a meeting'
  | 'The brethren'
  | 'Money'
  | "The lodge's word"
  | 'Setting the lodge up'
  | 'Looking back'
  | 'When something is wrong'

export type HelpTopic = {
  key: string
  title: string
  /** The path through the menu, as a person would say it aloud. */
  where: string
  /** One line. Shown under the title, and in the index. */
  lead: string
  group: HelpGroup
  blocks: HelpBlock[]
  /** Who may actually do this. Absent where everyone may. */
  who?: string
  /** Other topics worth reading next, by key. */
  see?: string[]
  /**
   * Normalised route keys this topic answers for — 'lodge:members',
   * 'portal:dues'. A '*' segment stands for an id.
   */
  routes?: string[]
}

/* ══════════════════════════════════════════════════════════════════
   PART ONE — for every brother
   ══════════════════════════════════════════════════════════════════ */

const BROTHER: HelpTopic[] = [
  {
    key: 'portal-dashboard',
    title: 'Your portal',
    where: 'Portal → Dashboard',
    lead: 'Your dues, your chair, the next meeting, and what has been asked of you.',
    group: 'For every brother',
    routes: ['portal:'],
    blocks: [
      {
        kind: 'table',
        head: ['Menu entry', 'What is there'],
        rows: [
          ['Check In', "Mark yourself present at tonight's meeting"],
          ['My Work', 'What the lodge has asked of you'],
          ['Events', 'The calendar, and replying to invitations'],
          ['Notices', 'Everything the Secretary has sent the lodge'],
          ['Roster', 'The brethren, and how to reach them'],
          ['Officer Duties', 'What every chair is responsible for'],
          ['Minutes', 'Approved minutes of past communications'],
          ['Documents', 'Bylaws, forms and degree material at your degree'],
          ['Dues', 'What you owe and what you have paid'],
          ['My Profile', 'Your photograph, your record, your emails'],
        ],
      },
      {
        kind: 'note',
        title: 'Your office is a link',
        text:
          'Wherever the app names your chair — in the greeting, on your profile — it is gold, dotted-underlined and followed by a small ⓘ. Press it to read what that chair is responsible for.',
      },
    ],
    see: ['duties', 'portal-profile'],
  },
  {
    key: 'getting-in',
    title: 'Getting in',
    where: 'The email from the lodge',
    lead: 'Every brother has an account. Nobody creates one for himself.',
    group: 'For every brother',
    blocks: [
      {
        kind: 'p',
        text:
          'When the Secretary adds you, the lodge emails you a welcome with a link. That link is what creates your way in — a new brother has no password yet, so going to the sign-in page instead is a dead end.',
      },
      {
        kind: 'steps',
        items: [
          'Open the email from the lodge and press the button in it.',
          'You land in your portal, already signed in.',
          'Set a password when prompted, so you can return without the email.',
        ],
      },
      {
        kind: 'warn',
        title: 'If no email arrived',
        text:
          'Check the address the lodge holds for you before anything else. An invitation sent to an old address will never arrive, and resending changes nothing until the address is corrected. Ask the Secretary.',
      },
      {
        kind: 'note',
        title: 'Emailed links finish the journey',
        text:
          'Follow a link from a lodge email while signed out and you are asked to sign in, then taken to the thing you were sent — not dropped at the home page to go hunting for it.',
      },
    ],
  },
  {
    key: 'portal-check-in',
    title: 'Checking in at a meeting',
    where: 'Portal → Check In',
    lead: 'Two ways. Either produces the same record.',
    group: 'For every brother',
    routes: ['portal:check-in'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Tonight’s meeting is already selected — press Check In.',
          'Or, if the lodge has a QR code at the door, point your phone’s camera at it. It opens this same page with the meeting already chosen.',
        ],
      },
      {
        kind: 'p',
        text:
          'Your own QR code — the one an officer scans at the door — is on your profile.',
      },
      {
        kind: 'note',
        title: 'If you forget',
        text:
          'Tell whoever is keeping the book. An officer can add you afterwards from Meetings → Attendance.',
      },
    ],
    see: ['attendance'],
  },
  {
    key: 'portal-assignments',
    title: 'Work the lodge has asked of you',
    where: 'Portal → My Work',
    lead: 'Two kinds of thing appear here, and they behave differently on purpose.',
    group: 'For every brother',
    routes: ['portal:assignments'],
    blocks: [
      {
        kind: 'table',
        head: ['A task', 'Degree work'],
        rows: [
          ['“Look into the roof quotes”', 'A proficiency'],
          ['You tick the checkbox yourself', 'You press “I’ve done this” and an officer signs it off'],
          [
            'Nobody else can know when you have read the bylaws',
            'A proficiency nobody heard is not a proficiency',
          ],
        ],
      },
      {
        kind: 'p',
        text:
          'If a proficiency is sent back, the reason appears in red beneath it. That reason is the useful part — it says what is still wanting. Put it right and press “I’ve put that right”.',
      },
      {
        kind: 'p',
        text: 'Finished work stays on the page under Completed. It is not archived away.',
      },
    ],
    see: ['assignments'],
  },
  {
    key: 'portal-dues',
    title: 'Your dues',
    where: 'Portal → Dues',
    lead: 'What you owe this year, and every payment the lodge has recorded against your name.',
    group: 'For every brother',
    routes: ['portal:dues'],
    blocks: [
      {
        kind: 'p',
        text:
          'The page shows what you owe this year, what you have already paid, and how to pay where the lodge accepts payment by transfer.',
      },
      {
        kind: 'note',
        title: 'If a payment is missing',
        text:
          'Tell the Secretary or Treasurer. Payments are entered by an officer, so one that has not been entered has not reached this page — it does not mean the lodge has no record of your money.',
      },
    ],
    see: ['dues'],
  },
  {
    key: 'portal-notices',
    title: 'Notices',
    where: 'Portal → Notices',
    lead: 'Everything the Secretary has sent the lodge.',
    group: 'For every brother',
    routes: ['portal:notices'],
    blocks: [
      {
        kind: 'p',
        text:
          'The envelope in the header carries a count of what you have not read. Opening this page clears it.',
      },
    ],
    see: ['communications'],
  },
  {
    key: 'portal-events',
    title: 'Events',
    where: 'Portal → Events',
    lead: 'The lodge calendar, and replying to invitations.',
    group: 'For every brother',
    routes: ['portal:events'],
    blocks: [
      {
        kind: 'p',
        text:
          'Where the lodge has asked, you can reply Going or Can’t make it, which tells the officers how many to cater for.',
      },
      {
        kind: 'note',
        title: 'It can go in your own calendar',
        text:
          'There is a calendar-feed address on the lodge’s Events page. A brother who adds it to his phone gets every lodge meeting in his own calendar, and it stays up to date without anyone re-sending anything.',
      },
    ],
    see: ['events'],
  },
  {
    key: 'portal-roster',
    title: 'The roster',
    where: 'Portal → Roster',
    lead: 'The brethren of the lodge, and how to reach them.',
    group: 'For every brother',
    routes: ['portal:roster'],
    blocks: [
      {
        kind: 'p',
        text:
          'To correct your own entry — a new telephone number, a change of address — ask the Secretary. Your email address is your sign-in and cannot be changed at all; if it is wrong you need a fresh invitation.',
      },
    ],
  },
  {
    key: 'portal-documents',
    title: 'Documents',
    where: 'Portal → Documents',
    lead: 'Bylaws, forms and degree material — what is open at your degree.',
    group: 'For every brother',
    routes: ['portal:documents'],
    blocks: [
      {
        kind: 'p',
        text:
          'Every document has a degree floor, not a ceiling — “Master Mason” means Master Mason and above. If some are being held for higher degrees, the page says how many rather than pretending they do not exist.',
      },
    ],
    see: ['documents'],
  },
  {
    key: 'portal-minutes',
    title: 'Minutes',
    where: 'Portal → Minutes',
    lead: 'Approved minutes of past communications.',
    group: 'For every brother',
    routes: ['portal:minutes'],
    blocks: [
      {
        kind: 'p',
        text:
          'Approved minutes only. A brother who was absent has every right to know what was done in his lodge — that is why they are read aloud at all. Drafts are not here, because a draft is not yet the lodge’s word.',
      },
    ],
    see: ['minutes'],
  },
  {
    key: 'portal-profile',
    title: 'Your profile, and the emails you get',
    where: 'Portal → My Profile',
    lead: 'Your photograph, your QR code, your record — and what the app is allowed to email you.',
    group: 'For every brother',
    routes: ['portal:profile'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Press your photograph to change it.',
          'Your QR code for checking in is on the same page.',
          'The “Emails from the lodge” card is at the bottom. Untick anything you would rather not have — it saves immediately.',
        ],
      },
      {
        kind: 'note',
        title: 'This does not silence the Secretary',
        text:
          'Notices sent to the lodge by an officer are not affected — those are the lodge speaking to you. What you can switch off here is the automatic mail: chiefly new photographs on the website.',
      },
      {
        kind: 'p',
        text:
          'To change your name, address or telephone number, ask the Secretary. Your email address is your sign-in and cannot be changed here at all.',
      },
    ],
    see: ['notifications'],
  },
]

/* ══════════════════════════════════════════════════════════════════
   PART TWO — running a meeting
   ══════════════════════════════════════════════════════════════════ */

const MEETING: HelpTopic[] = [
  {
    key: 'lodge-dashboard',
    title: 'The lodge dashboard',
    where: 'Dashboard',
    lead: 'The lodge today: what is next, what is outstanding, and what needs a decision.',
    group: 'Running a meeting',
    routes: ['lodge:dashboard'],
    blocks: [
      {
        kind: 'p',
        text:
          'Everything here is a shortcut to a page that does the work. Nothing is only on the dashboard.',
      },
      {
        kind: 'note',
        title: 'The greeting names your chair',
        text:
          'It is gold, dotted-underlined and followed by a small ⓘ. Press it to read what your office is responsible for, and from there, what every other chair is for.',
      },
    ],
    see: ['duties'],
  },
  {
    key: 'events',
    title: 'Calling a meeting',
    where: 'Meetings → Events',
    lead: 'Call it, set the room and the dress, then announce it.',
    group: 'Running a meeting',
    routes: ['lodge:events', 'lodge:events/*'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Press New Meeting.',
          'Choose the kind: Stated Communication, Degree Work, Social or Grand Lodge.',
          'Set the date, time, place and dress.',
          'Decide whether it is public — public events appear on the lodge’s website; the rest are for the brethren only.',
          'Save. Then open the event and Send Invitations if you want it announced.',
        ],
      },
      {
        kind: 'note',
        title: 'The calendar can be subscribed to',
        text:
          'There is a calendar-feed address on this page. A brother who adds it to his phone gets every lodge meeting in his own calendar, and it stays up to date without anyone re-sending anything.',
      },
    ],
    who: 'Every officer tier, or any chair given the Events capability.',
    see: ['meeting', 'permissions'],
  },
  {
    key: 'lodge-room',
    title: 'The Lodge Room',
    where: 'Meetings → Lodge Room',
    lead: 'A floor plan of the lodge with the twelve stations laid out as they actually sit.',
    group: 'Running a meeting',
    routes: ['lodge:lodge-room'],
    blocks: [
      {
        kind: 'p',
        text:
          'The Master in the East at the top, the Tyler outside at the bottom. Each chair shows the brother who holds it.',
      },
      {
        kind: 'warn',
        title: 'Stations are set on a brother’s profile, not here',
        text:
          'This page shows the seating. To change it, open the brother and set his Office on his Register entry. A chair reads vacant until somebody’s office matches it exactly.',
      },
    ],
    see: ['member-record', 'bench'],
  },
  {
    key: 'meeting',
    title: 'Meeting Mode',
    where: 'Meetings → Meeting Mode',
    lead: 'The screen you keep open while the lodge is at labour.',
    group: 'Running a meeting',
    routes: ['lodge:meeting'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Choose tonight’s meeting, or press New Meeting if it was never called.',
          'Press Open the Lodge when the Master does.',
          'Work down the agenda, ticking items as they are disposed of.',
          'Show Self Check-In so brethren can scan themselves in, or record attendance yourself.',
          'Press Close the Lodge at the end.',
        ],
      },
      {
        kind: 'note',
        title: 'It is safe to leave and come back',
        text:
          'Nothing here depends on the page staying open. If your phone locks or you lose signal, sign back in and the meeting is where you left it.',
      },
    ],
    who: 'Every officer tier, or any chair given the “Running a meeting” capability.',
    see: ['attendance', 'minutes'],
  },
  {
    key: 'attendance',
    title: 'Attendance',
    where: 'Meetings → Attendance',
    lead: 'Who came, who did not, and who sent word.',
    group: 'Running a meeting',
    routes: ['lodge:attendance'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Choose the meeting from Select Event.',
          'Press Mark All Present, then correct the few who were not — usually faster than the other way round.',
        ],
      },
      {
        kind: 'table',
        head: ['Mark', 'Means'],
        rows: [
          ['Present', 'He was there'],
          ['Absent', 'He was not, and did not say why'],
          ['Excused', 'He sent word. It counts differently in the figures'],
        ],
      },
      {
        kind: 'p',
        text:
          'Visiting brethren are recorded separately, with their name and mother lodge. They are the lodge’s guests, not its members, and they do not affect its own attendance figures.',
      },
      {
        kind: 'warn',
        title: 'Attendance is what the analytics are made of',
        text:
          'A month recorded honestly is worth more than a month recorded generously. Everything in Records → Analytics is built from these marks.',
      },
    ],
    who: 'Every officer tier, or any chair given the “Running a meeting” capability.',
    see: ['analytics'],
  },
  {
    key: 'minutes',
    title: 'Minutes',
    where: 'Meetings → Minutes',
    lead: 'The lodge’s principal record. It has three states, and they matter.',
    group: 'Running a meeting',
    routes: ['lodge:minutes', 'lodge:minutes/*'],
    blocks: [
      {
        kind: 'table',
        head: ['State', 'Who can see it'],
        rows: [
          ['Draft', 'Officers only. Still being written'],
          ['Submitted', 'Officers only. Waiting to be approved by the lodge'],
          ['Approved', 'Every brother, in his portal'],
        ],
      },
      {
        kind: 'steps',
        items: [
          'Open the meeting and write the minutes — or draft them with the AI Secretary and send them here.',
          'Save as often as you like. A draft is private to the officers.',
          'Press Submit when they are ready to be read.',
          'After the lodge approves them, press Approve. Only then do they reach the brethren.',
        ],
      },
      {
        kind: 'warn',
        title: 'The brethren cannot see them yet?',
        text:
          'They are approved-only. A draft or a submitted set is visible to officers alone. Press Approve after the lodge has approved them.',
      },
    ],
    who: 'Officers may write. Approval is narrower: admin, Secretary, Grand Master and the Worshipful Master.',
    see: ['secretary', 'portal-minutes'],
  },
]

/* ══════════════════════════════════════════════════════════════════
   PART THREE — the brethren
   ══════════════════════════════════════════════════════════════════ */

const BRETHREN: HelpTopic[] = [
  {
    key: 'members',
    title: 'The roster',
    where: 'Brothers → Members',
    lead: 'Adding a brother, taking one off, and bringing him back.',
    group: 'The brethren',
    routes: ['lodge:members'],
    blocks: [
      { kind: 'p', text: 'To add a brother, press + Invite Brother.' },
      {
        kind: 'steps',
        items: [
          'Enter his first and last name and his email address. Check it twice — it is his sign-in, and a typo means an invitation that never arrives.',
          'Set his degree.',
          'Set his access level. Most brethren are member.',
          'Optionally set his office.',
          'Press Send Invitation.',
        ],
      },
      {
        kind: 'p',
        text:
          'Three things happen: he is emailed a welcome with a sign-in link, the officers are emailed that an invitation went out, and the act is written into the audit trail.',
      },
      {
        kind: 'warn',
        title: 'Then wait for the second email',
        text:
          'You will be emailed again when he signs in for the first time. That is the only proof the whole chain worked. If it does not come within a few days, check the address on his profile and invite him again.',
      },
      {
        kind: 'p',
        text:
          'To take a brother off, press Remove beside his name. Record which thing happened — demitted, suspended, expelled, deceased, or removed for a duplicate row — set the date it took effect, and choose whether he is told by email.',
      },
      {
        kind: 'note',
        title: 'Nothing is destroyed',
        text:
          'His attendance, dues and degree history stay attached to him. He moves to former brethren below the roster rather than disappearing, and Reinstate brings the whole record back.',
      },
      {
        kind: 'warn',
        title: 'Two things the app refuses',
        text:
          'You cannot remove yourself, and you cannot remove the lodge’s last Secretary-tier officer. Either would leave the lodge unable to administer itself.',
      },
      {
        kind: 'p',
        text:
          'Import takes a spreadsheet, for moving an existing roster in at once rather than inviting fifty men by hand.',
      },
    ],
    who: 'Admin, Secretary, Grand Master and the Worshipful Master. A Worshipful Master cannot hand out admin-tier access — only an existing admin-tier officer can.',
    see: ['member-record', 'permissions'],
  },
  {
    key: 'member-record',
    title: 'A brother’s record',
    where: 'Brothers → Members → his name',
    lead: 'His summary, his Register entry, his dates — and what he is allowed to reach.',
    group: 'The brethren',
    routes: ['lodge:members/*'],
    blocks: [
      {
        kind: 'table',
        head: ['Tab', 'What is on it'],
        rows: [
          ['Overview', 'His summary, the Register entry, and his Masonic dates'],
          ['Tasks', 'What he has been asked to do, and what he has finished'],
          ['Attendance', 'Every meeting he was recorded at'],
          ['Dues', 'What he has paid and what he owes; add a charge here'],
          ['History', 'His degrees and when they were conferred'],
          ['Permissions', 'His tier and any exceptions'],
          ['Notes', 'The Secretary’s notes. Never visible to the brother'],
        ],
      },
      {
        kind: 'p',
        text:
          'On the Register entry, change what you need and save once — the button says how many fields are waiting. Only what changed is written, so the audit trail names the postcode rather than claiming you rewrote the man.',
      },
      {
        kind: 'warn',
        title: 'Email cannot be edited',
        text:
          'It is his sign-in; changing it would lock him out silently. Invite him again at the right address instead.',
      },
      {
        kind: 'note',
        title: 'Setting his Office does three things',
        text:
          'It seats him in the Lodge Room, gives him whatever that chair carries in Permissions, and decides which duties open first for him. Give a brother an office someone else holds and the app warns you and names the other man — but does not stop you. During a handover two men briefly hold the same chair, and that is normal.',
      },
      {
        kind: 'p',
        text:
          'Masonic dates — initiated, passed and raised — are copied off the old register, which is why they are typed rather than derived. The raising date is what service jewels and anniversaries count from, so it is worth entering even for brethren raised decades before the app existed. A man cannot be raised before he was initiated, and none of the three can be in the future.',
      },
    ],
    who: 'The roster capability. Changing his tier or his permissions is narrower — admin, Secretary and Grand Master only.',
    see: ['members', 'permissions', 'lodge-room'],
  },
  {
    key: 'degrees',
    title: 'Degrees',
    where: 'Brothers → Degrees',
    lead: 'Every candidate and how far he has come.',
    group: 'The brethren',
    routes: ['lodge:degrees'],
    blocks: [
      {
        kind: 'p',
        text:
          'Record a degree as conferred, with its date, and the brother’s record and the dashboard both follow.',
      },
      {
        kind: 'p',
        text:
          'Where the lodge has written a curriculum — the steps of proficiency for a degree — a candidate can be put on the whole plan at once from Assignments.',
      },
    ],
    who: 'Every officer tier, or any chair given the “Running a meeting” capability.',
    see: ['assignments', 'documents'],
  },
  {
    key: 'petitions',
    title: 'Petitions',
    where: 'Brothers → Petitions',
    lead: 'Men seeking admission, and the stage each has reached.',
    group: 'The brethren',
    routes: ['lodge:petitions'],
    blocks: [
      {
        kind: 'p',
        text:
          'A petition arrives from the lodge’s public site or is entered by an officer, and moves through the lodge’s own stages — received, investigated, balloted, and so on.',
      },
      {
        kind: 'warn',
        title: 'Nothing here is a ballot',
        text:
          'The app records what the lodge decided. It does not conduct the ballot, and it was deliberately not built to.',
      },
    ],
    who: 'The roster capability — admin, Secretary, Grand Master and the Worshipful Master.',
  },
  {
    key: 'care',
    title: 'Sickness, distress and widows',
    where: 'Brothers → Care',
    lead: 'Brethren who need checking on, and the widows the lodge is caring for.',
    group: 'The brethren',
    routes: ['lodge:care'],
    blocks: [
      {
        kind: 'p',
        text: 'Keep entries brief and factual — other officers read them.',
      },
    ],
    who: 'The Reports & analytics capability.',
  },
  {
    key: 'bench',
    title: 'Officer coverage',
    where: 'Brothers → Coverage',
    lead: 'Which chairs are filled and which are empty.',
    group: 'The brethren',
    routes: ['lodge:bench'],
    blocks: [
      {
        kind: 'p',
        text:
          'Drawn from each brother’s Office. If it says nobody has a lodge role set, the offices have not been entered yet — set them on each brother’s Register entry.',
      },
    ],
    who: 'The Reports & analytics capability.',
    see: ['member-record', 'lodge-room'],
  },
]

/* ══════════════════════════════════════════════════════════════════
   PART FOUR — money
   ══════════════════════════════════════════════════════════════════ */

const MONEY: HelpTopic[] = [
  {
    key: 'dues',
    title: 'Dues, charges and payments',
    where: 'Dues',
    lead: 'The annual rate, what each brother owes, and everything owed beyond the subscription.',
    group: 'Money',
    routes: ['lodge:dues'],
    blocks: [
      {
        kind: 'table',
        head: ['Status', 'Means'],
        rows: [
          ['Paid', 'Settled for the year'],
          ['Due', 'Owing'],
          ['Exempt', 'The lodge has excused him — a fifty-year brother, a life member'],
        ],
      },
      {
        kind: 'p',
        text:
          'The annual rate is set on this page. Changing it does not retrospectively alter what a brother has already been charged.',
      },
      {
        kind: 'steps',
        items: [
          'To record a payment, open the brother, or use Record Payment on the dashboard.',
          'Enter the amount and the year it settles.',
          'Save. It appears immediately on his own portal dues page.',
        ],
      },
      {
        kind: 'p',
        text:
          'A charge is anything owed that is not the annual subscription — a degree fee, a late fee, reinstatement, an assessment the lodge has voted, or anything else described in the note. Add it on a brother’s Dues tab. A charge can later be marked paid or waived; a waived charge is settled as far as the brother is concerned and stops counting against him.',
      },
      {
        kind: 'note',
        title: 'Reminders tell you what actually happened',
        text:
          'Send Dues Reminders emails the brethren who owe, in the lodge’s own crest and wording. It then reports how many were emailed and how many could not be — usually because no address is on file. A brother with no email address is not a brother who was reminded.',
      },
    ],
    who: 'Admin, Secretary, Grand Master, Treasurer and the Worshipful Master. A Deacon or Warden cannot, unless the lodge has given his chair the “Dues & money” capability.',
    see: ['member-record', 'permissions'],
  },
]

/* ══════════════════════════════════════════════════════════════════
   PART FIVE — the lodge's word
   ══════════════════════════════════════════════════════════════════ */

const WORD: HelpTopic[] = [
  {
    key: 'assignments',
    title: 'Giving out work',
    where: 'Assignments',
    lead: 'A task one brother finishes himself, or a whole degree plan at once.',
    group: "The lodge's word",
    routes: ['lodge:assignments'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Choose the brother.',
          'Write what is being asked, and a due date if there is one.',
          'Attach a document if it helps.',
          'Send. He is emailed at once.',
        ],
      },
      {
        kind: 'p',
        text:
          'To put a candidate on a degree plan, choose the brother, choose the degree, and give him the whole curriculum in one act. He receives one email listing it, not one per step.',
      },
      {
        kind: 'table',
        head: ['A task', 'A curriculum step'],
        rows: [
          ['The brother finishes it himself', 'An officer signs it off'],
          ['He presses the checkbox', 'He presses “I’ve done this”'],
          ['You do nothing — it is done', 'You Sign off or Send back'],
        ],
      },
      {
        kind: 'warn',
        title: 'Always give a reason when sending something back',
        text:
          'A proficiency returned without one teaches a candidate that he failed and nothing else, which is the opposite of what a mentor is for. The reason appears in his own portal, in red, under the item.',
      },
      {
        kind: 'p',
        text:
          'The curriculum itself is written under Records → Documents: the steps of proficiency for each degree, in order, attaching material where it helps. There is a standard outline to start from for the first three degrees.',
      },
    ],
    who: 'Give out work: admin, Secretary, Grand Master, Worshipful Master, Wardens. Sign off a proficiency: any seated officer. Write the curriculum: admin, Secretary, Grand Master, Worshipful Master. And nobody signs off his own.',
    see: ['degrees', 'documents'],
  },
  {
    key: 'communications',
    title: 'Notices',
    where: 'Records → Communications',
    lead: 'What the lodge says to its brethren, in the lodge’s name.',
    group: "The lodge's word",
    routes: ['lodge:communications'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Write a Subject and the Message.',
          'Choose Send To — the whole lodge, or a narrower group.',
          'Check Preview — as a brother will see it. It carries the lodge’s crest.',
          'Send Immediately, or At a set time.',
        ],
      },
      {
        kind: 'p',
        text:
          'A notice can be saved as a draft and picked up later with Resume. Everything already sent is listed under Sent Communications, with how many it reached.',
      },
      {
        kind: 'note',
        title: 'A brother cannot switch these off',
        text:
          'Notices are the lodge speaking to its members. What a brother can silence on his profile is the automatic mail — chiefly new photographs on the website.',
      },
    ],
    who: 'Admin, Secretary, Grand Master and the Worshipful Master. Narrower than most things on purpose — a notice goes out in the lodge’s name. The lodge can give the capability to another chair.',
    see: ['notifications', 'permissions'],
  },
  {
    key: 'documents',
    title: 'Documents',
    where: 'Records → Documents',
    lead: 'The library, its degree floors, and the degree curricula.',
    group: "The lodge's word",
    routes: ['lodge:documents'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Press Upload and choose the file.',
          'Give it a name a brother would recognise — not scan_0042.pdf.',
          'Put it in a category.',
          'Set the degree floor.',
        ],
      },
      {
        kind: 'table',
        head: ['What you can upload', 'Examples'],
        rows: [
          ['Documents', 'PDF, Word, Pages, OpenDocument, RTF, plain text'],
          ['Presentations', 'PowerPoint (.ppt, .pptx, .ppsx), Keynote, Impress'],
          ['Spreadsheets', 'Excel (.xls, .xlsx), Numbers, Calc, CSV'],
          ['Pictures and scans', 'JPEG, PNG, HEIC from an iPhone, TIFF, GIF, WebP'],
          ['Recordings', 'MP4, MOV, WebM, AVI, MP3, M4A, WAV'],
          ['A bundle', 'A .zip — degree material often arrives as one'],
        ],
      },
      {
        kind: 'p',
        text:
          'Two rows of filters sit above the list. The first is what a document is about — its category. The second is what it is: Presentations, Video, Audio, Documents, Spreadsheets, Pictures, Bundles. They work together, so “the degree slide decks” is two taps. Typing “powerpoint” or “video” into the search box does the same thing without touching them.',
      },
      {
        kind: 'note',
        title: 'Up to 500MB, and recordings play in the page',
        text:
          'MP4, MOV, WebM and the common audio formats get a player in the library. Everything else downloads and opens in whatever the brother has installed — a slide deck opens in PowerPoint, not in LodgeOS.',
      },
      {
        kind: 'note',
        title: 'The degree setting is a floor, not a ceiling',
        text:
          '“Master Mason” means Master Mason and above. A brother below it does not see the document at all — he is told only how many are being held for higher degrees, which is honest without disclosing what they are.',
      },
      {
        kind: 'p',
        text:
          'Upload a new version as a replacement rather than a fresh document. The old one is kept in its history, so “which bylaws were in force in 2023” stays answerable.',
      },
      {
        kind: 'table',
        head: ['On each row', 'What it does'],
        rows: [
          ['Play', 'Only on recordings. Plays it here rather than saving it'],
          ['Download', 'Saves the file, named what the lodge calls it'],
          ['Edit', 'The name, description, category and who may open it — not the file'],
          ['Delete', 'Destroys the file. Cannot be undone'],
        ],
      },
      {
        kind: 'note',
        title: 'Edit corrects the record, not the document',
        text:
          'A file uploaded as “scan_0042” with the wrong degree floor can be put right without deleting it — which would throw away its version history and its place in a curriculum. To replace the file itself, upload the new version and name the old one as what it supersedes: that keeps both.',
      },
      {
        kind: 'steps',
        items: [
          'To delete: press Delete beside the document.',
          'Type its name into the box.',
          'Press Delete Permanently.',
        ],
      },
      {
        kind: 'note',
        title: 'The typing is forgiving',
        text:
          'Capitals and extra spaces do not matter, and the line under the box tells you whether it matches yet. If the button is still grey, it has not matched.',
      },
    ],
    who: 'Read: every officer. Upload, replace and delete: the Documents capability.',
    see: ['assignments', 'portal-documents'],
  },
  {
    key: 'gallery',
    title: 'The gallery, and the public site',
    where: 'Lodge → Gallery',
    lead: 'Photographs on the lodge’s website. Nothing is public until you press Post.',
    group: "The lodge's word",
    routes: ['lodge:gallery'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Choose Files and pick as many as you like.',
          'Write a description for each, and ideally alt text.',
          'Decide whether to tick “Email the brethren” — on by default.',
          'Press Post N photographs. Only now do they reach the website.',
        ],
      },
      {
        kind: 'note',
        title: 'They are shrunk before they leave your phone',
        text:
          'A 5.2 MB photograph becomes about 835 KB, and the small version in the grid about 72 KB. Twenty photographs is a 1.4 MB gallery instead of a 105 MB one. Your originals are untouched.',
      },
      {
        kind: 'table',
        head: ['Description', 'Alt text'],
        rows: [
          ['Printed with the picture. What the lodge calls it', 'Read aloud to a blind visitor; read by search engines'],
          ['“Bro. Powell raising the flag, 2019”', '“A man in an apron raising a flag outside a brick hall”'],
        ],
      },
      {
        kind: 'p',
        text:
          'Below, one row per photograph. Tap the small picture to enlarge it; press Edit for its fields; ↑ and ↓ move it earlier or later.',
      },
      {
        kind: 'warn',
        title: 'Hide, do not delete',
        text:
          'Hiding takes a photograph off the website and can be undone. Deleting destroys the file. If a brother objects to his picture being public, hide it — “delete it and hope we can find the original” is not a plan.',
      },
      {
        kind: 'p',
        text:
          'The settings card controls whether the section appears at all, the words above the photographs, and what is written on each thumbnail — the description, the description and month, the month only, or nothing. For a wall of officer portraits, nothing is usually right: a band of text across twenty faces hides what a visitor came to see.',
      },
      {
        kind: 'note',
        title: 'Posted, and the site still shows the old page?',
        text:
          'Give it a minute, then reload. The site is rebuilt when you post, but a page already open in a browser is still the old copy.',
      },
    ],
    who: 'The Lodge settings capability.',
    see: ['settings', 'notifications'],
  },
]

/* ══════════════════════════════════════════════════════════════════
   PART SIX — setting the lodge up
   ══════════════════════════════════════════════════════════════════ */

const SETUP: HelpTopic[] = [
  {
    key: 'settings',
    title: 'Lodge settings',
    where: 'Lodge → Settings',
    lead: 'The lodge itself: its details, its crest, and the words on its website.',
    group: 'Setting the lodge up',
    routes: ['lodge:settings'],
    blocks: [
      {
        kind: 'p',
        text:
          'The lodge’s name, number, rite and jurisdiction; where and when it meets; its address, telephone and email; its crest; the text on its public website; and whether it accepts donations, and by what means.',
      },
      {
        kind: 'note',
        title: 'Upload the crest',
        text:
          'Without one, every email the lodge sends falls back to a plain text header. It is the single change that most improves how the lodge’s mail looks.',
      },
    ],
    who: 'The Lodge settings capability.',
    see: ['gallery'],
  },
  {
    key: 'permissions',
    title: 'Permissions',
    where: 'Lodge → Permissions',
    lead: 'Three layers. Most brethren only ever need the first.',
    group: 'Setting the lodge up',
    routes: ['lodge:permissions'],
    blocks: [
      {
        kind: 'table',
        head: ['Layer', 'Set at'],
        rows: [
          ['1 · His tier — the rule. Eight tiers, each a bundle of tools', 'His profile → Permissions'],
          ['2 · His chair — what an office carries, whoever holds it', 'Lodge → Permissions'],
          ['3 · Him personally — an exception to both, for one man', 'His profile → Permissions'],
        ],
      },
      {
        kind: 'p',
        text:
          'The most specific wins. A personal exception beats his chair, which beats his tier.',
      },
      {
        kind: 'p',
        text:
          'On the By office tab, tap a cell to cycle it: · follows the tier, ✓ allowed, ✗ denied.',
      },
      {
        kind: 'warn',
        title: 'Prefer the chair to the man',
        text:
          'Offices move every December. A permission on a chair passes to next year’s officer by itself. On a man, somebody must remember to take it off him — every office, every year, from memory.',
      },
      {
        kind: 'p',
        text:
          'The By brother tab answers the question you actually have when something is wrong: what can this man reach, and where did it come from? Each capability is labelled with its source — his tier, his chair, or a decision about him — which tells you which of the three to undo.',
      },
      {
        kind: 'note',
        title: 'The nine capabilities',
        text:
          'Dues & money · Notices · The roster · Documents · Events · Running a meeting · Lodge settings · Reports & analytics · Giving out work.',
      },
    ],
    who: 'Read: every officer. Change: admin, Secretary and Grand Master only, and this is not delegable — granting someone “Lodge settings” does not let him edit permissions. Nobody can edit his own.',
    see: ['member-record', 'duties', 'transition'],
  },
  {
    key: 'duties',
    title: 'Officer duties',
    where: 'Lodge → Officer Duties, or Portal → Officer Duties',
    lead: 'What every chair in the lodge is responsible for. Your own opens first.',
    group: 'Setting the lodge up',
    routes: ['lodge:duties', 'portal:duties'],
    blocks: [
      {
        kind: 'p',
        text:
          'Every brother can read these, from the portal. You can also reach your own from the greeting on your dashboard — the office is gold, dotted-underlined, and followed by a small ⓘ.',
      },
      {
        kind: 'warn',
        title: 'The shipped text is a starting point, not your bylaws',
        text:
          'Seventeen descriptions come with the app so nobody faces an empty page. Duties differ by jurisdiction and by a lodge’s own bylaws, and nothing written by a piece of software is an authority on what your Grand Lodge expects. Text the lodge has not written says so, in italics, beneath it.',
      },
      {
        kind: 'steps',
        items: [
          'Open Lodge → Officer Duties and tap the office.',
          'Press Edit these duties. The box holds what is showing.',
          'Write it as your lodge means it and press Save duties.',
          'To undo, press “Back to the standard text” — this deletes your version.',
        ],
      },
    ],
    who: 'Read: everyone. Edit: admin, Secretary and Grand Master by tier, plus the Worshipful Master and Senior Warden by chair.',
    see: ['permissions', 'transition'],
  },
  {
    key: 'notifications',
    title: 'Notifications',
    where: 'Lodge → Notifications',
    lead: 'Who is emailed what, and how to switch any of it off.',
    group: 'Setting the lodge up',
    routes: ['lodge:notifications'],
    blocks: [
      {
        kind: 'table',
        head: ['Email', 'Goes to'],
        rows: [
          ['A brother is invited', 'The officers'],
          ['He signs in for the first time', 'The officers'],
          ['A brother is removed', 'The officers'],
          ['New photographs on the website', 'Every brother'],
        ],
      },
      {
        kind: 'note',
        title: 'The second is the one that matters',
        text:
          'An invitation that quietly fails is invisible: you believe he was added, he never saw anything, and nobody finds out until he turns up unable to sign in. “He signed in” is the only proof the whole chain worked.',
      },
      {
        kind: 'p',
        text:
          'By default the officers’ emails go to the administrative tier, plus the Worshipful Master and Senior Warden by chair. Photographs go to everyone. A brother can change his own at Portal → My Profile; an officer can change anyone’s here.',
      },
    ],
    who: 'Read: every officer. Your own: anyone. Someone else’s: admin, Secretary and Grand Master.',
    see: ['portal-profile', 'members'],
  },
  {
    key: 'transition',
    title: 'The December handover',
    where: 'Lodge → Transition',
    lead: 'Change each man’s office. Most things follow on their own.',
    group: 'Setting the lodge up',
    routes: ['lodge:transition'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Open each brother and change his Office on the Register entry.',
          'Change his tier on his Permissions tab where the new chair needs it — the incoming Master to worshipful_master, for instance.',
          'Check Meetings → Lodge Room seats everyone correctly.',
          'Take off any personal exceptions that belonged to the old year.',
        ],
      },
      {
        kind: 'table',
        head: ['Follows the chair by itself', 'Does not'],
        rows: [
          ['Permissions set on the office', 'Personal exceptions on a man'],
          ['Officer duties', 'His permission tier'],
          ['Roster notifications', ''],
          ['His seat in the Lodge Room', ''],
        ],
      },
      {
        kind: 'p',
        text:
          'This page also gives the outgoing officers a digest of the year — what happened, what is outstanding — to hand to the incoming line.',
      },
    ],
    who: 'The Lodge settings capability.',
    see: ['permissions', 'member-record'],
  },
]

/* ══════════════════════════════════════════════════════════════════
   PART SEVEN — looking back
   ══════════════════════════════════════════════════════════════════ */

const BACK: HelpTopic[] = [
  {
    key: 'analytics',
    title: 'Analytics',
    where: 'Records → Analytics',
    lead: 'Attendance over time, dues collected, degree progression, who has not been seen in a while.',
    group: 'Looking back',
    routes: ['lodge:analytics'],
    blocks: [
      {
        kind: 'p',
        text:
          'All of it is built from the marks recorded in Meetings → Attendance — so a month recorded honestly is worth more than a month recorded generously.',
      },
    ],
    who: 'The Reports & analytics capability.',
    see: ['attendance'],
  },
  {
    key: 'reports',
    title: 'Reports',
    where: 'Records → Reports',
    lead: 'The monthly trestleboard and the Grand Lodge annual return.',
    group: 'Looking back',
    routes: ['lodge:reports'],
    blocks: [
      {
        kind: 'table',
        head: ['Report', 'What it is'],
        rows: [
          ['Monthly Trestleboard', 'What is coming, to send or print for the brethren'],
          ['Grand Lodge Annual Return', 'The year’s figures, assembled from the lodge’s own records'],
        ],
      },
      {
        kind: 'warn',
        title: 'Generated, not tallied',
        text:
          'Both are built from what is already in the app. If a figure looks wrong, the cause is in the underlying record — an unrecorded meeting, a removal entered as “removed” rather than “demitted” — not in the report.',
      },
    ],
    who: 'The Reports & analytics capability.',
    see: ['attendance', 'members'],
  },
  {
    key: 'audit',
    title: 'The audit trail',
    where: 'Records → Audit Trail',
    lead: 'Every consequential act, in plain language: who did it, to whom, and when.',
    group: 'Looking back',
    routes: ['lodge:audit'],
    blocks: [
      {
        kind: 'p',
        text:
          '“Took Bro. Harris off the roster as demitted, effective 3 March” — not a database statement. This is usually the fastest way to find out what actually happened.',
      },
    ],
    who: 'Admin, Secretary, Grand Master, the Treasurer and the Worshipful Master.',
  },
  {
    key: 'secretary',
    title: 'The AI Secretary',
    where: 'AI Secretary, or the ☉ in the header on any page',
    lead: 'It can answer questions about the lodge’s own records, and draft things for you.',
    group: 'Looking back',
    routes: ['lodge:secretary'],
    blocks: [
      {
        kind: 'p',
        text:
          '“Who has not attended since January?” · “Draft the minutes of tonight’s stated communication.” · “Write a notice about the pancake breakfast.”',
      },
      {
        kind: 'p',
        text:
          'A draft can be sent straight to Communications to be checked and sent, or to Minutes to be edited and submitted.',
      },
      {
        kind: 'warn',
        title: 'Read what it wrote before it goes out',
        text:
          'It drafts; it does not decide. Nothing it writes reaches a brother until an officer sends it, and the minute book is the lodge’s word — not the app’s.',
      },
    ],
    see: ['minutes', 'communications'],
  },
]

/* ══════════════════════════════════════════════════════════════════
   PART EIGHT — when something is wrong
   ══════════════════════════════════════════════════════════════════ */

const TROUBLE: HelpTopic[] = [
  {
    key: 'trouble',
    title: 'When something is wrong',
    where: 'The questions people ask twice',
    lead: 'The nine things that go wrong most, and what to do about each.',
    group: 'When something is wrong',
    blocks: [
      {
        kind: 'table',
        head: ['If', 'Then'],
        rows: [
          [
            'A brother says he never got his invitation',
            'Check the email address on his profile first. If it is wrong, correct it and invite him again — resending to a wrong address changes nothing.',
          ],
          [
            'You posted a photograph and the website does not show it',
            'Give it a minute, then reload the page. The site is rebuilt when you post, but a page already open in your browser is still the old copy.',
          ],
          [
            'You pressed a button and nothing happened',
            'Look at the bottom of the screen — saves and deletions confirm themselves there. If a button is greyed out, something above it is unfinished: a confirmation not yet typed, or a form with nothing changed.',
          ],
          [
            'Somebody has access he should not',
            'Lodge → Permissions → By brother. It shows what each man can reach and where it came from, which tells you which of the three layers to undo.',
          ],
          [
            'Somebody cannot do something he should',
            'Same page. If his chair is right and the capability is not there, give it to the chair rather than to him — it will pass to his successor in December.',
          ],
          [
            'A brother wants no more email from the app',
            'He can switch each one off himself at Portal → My Profile. An officer can do it for him at Lodge → Notifications. Notices sent by the Secretary are not affected.',
          ],
          [
            'You recorded a removal wrongly',
            'Reinstate him and remove him again with the right status. Both acts are in the audit trail, which is the honest record of a correction.',
          ],
          [
            'The minutes are not showing for the brethren',
            'They are approved-only. A draft or a submitted set is visible to officers alone. Press Approve after the lodge has approved them.',
          ],
          [
            'A number looks wrong',
            'Attendance figures come from Meetings → Attendance; money from the payments and charges recorded against each brother. Reports tally what is there and nothing else.',
          ],
        ],
      },
      {
        kind: 'note',
        title: 'If this does not answer it',
        text:
          'Try Records → Audit Trail. Everything the app does is written down there as it happens, in plain language, and it is usually faster than guessing at what went wrong.',
      },
    ],
    see: ['permissions', 'audit'],
  },
  {
    key: 'words',
    title: 'Words this app uses',
    where: 'A glossary',
    lead: 'Tier, chair, capability, exception — and the four that get confused.',
    group: 'When something is wrong',
    blocks: [
      {
        kind: 'table',
        head: ['Word', 'Means'],
        rows: [
          ['Tier', 'A brother’s permission level — admin, secretary, treasurer, member and so on. Eight of them. Not the same as his office.'],
          ['Office / chair', 'The station he actually holds: Senior Warden, Junior Deacon, Tyler. What seats him in the Lodge Room.'],
          ['Capability', 'One of the nine things the app can let someone do.'],
          ['Exception', 'A capability given to, or taken from, one man or one chair, overriding what his tier would say.'],
          ['Degree floor', 'The lowest degree that may see a document. “Master Mason” means Master Mason and above.'],
          ['Proficiency', 'Degree work an officer must hear and sign off. A candidate cannot mark it done himself.'],
          ['Task', 'Ordinary work a brother finishes and ticks himself. No sign-off.'],
          ['Draft / submitted / approved', 'The three states of minutes. Only approved reaches the brethren.'],
          ['Hidden', 'Off the public site but not destroyed. Reversible — unlike deleted.'],
          ['Alt text', 'A plain description of a photograph, read aloud to a blind visitor. Not the caption.'],
        ],
      },
    ],
  },
]

export const HELP_TOPICS: HelpTopic[] = [
  ...BROTHER,
  ...MEETING,
  ...BRETHREN,
  ...MONEY,
  ...WORD,
  ...SETUP,
  ...BACK,
  ...TROUBLE,
]

export const HELP_GROUPS: HelpGroup[] = [
  'For every brother',
  'Running a meeting',
  'The brethren',
  'Money',
  "The lodge's word",
  'Setting the lodge up',
  'Looking back',
  'When something is wrong',
]

const BY_KEY = new Map(HELP_TOPICS.map(t => [t.key, t]))

const BY_ROUTE = new Map<string, HelpTopic>()
for (const topic of HELP_TOPICS) {
  for (const route of topic.routes ?? []) {
    // First declaration wins, so a duplicate is a mistake that shows up
    // as the wrong page's help rather than silently overwriting.
    if (!BY_ROUTE.has(route)) BY_ROUTE.set(route, topic)
  }
}

export function helpTopic(key: string): HelpTopic | null {
  return BY_KEY.get(key) ?? null
}

/**
 * A pathname reduced to something a topic can be keyed on.
 *
 *   /lodge/psalms-of-job-1827/members/8f3e-…  →  lodge:members/*
 *   /portal/dues                              →  portal:dues
 *   /portal                                   →  portal:
 *
 * The lodge slug is dropped because it names the lodge, not the screen,
 * and ids become '*' because help for "a brother's record" is the same
 * help whichever brother it is.
 */
export function routeKey(pathname: string): string | null {
  const parts = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean)

  if (parts[0] === 'portal') {
    return `portal:${parts.slice(1).map(idSegment).join('/')}`
  }

  if (parts[0] === 'lodge' && parts.length >= 2) {
    // parts[1] is the slug.
    return `lodge:${parts.slice(2).map(idSegment).join('/')}`
  }

  return null
}

/**
 * Anything that looks like an identifier rather than a screen name.
 * Our routes are all lower-case words and hyphens; a uuid, a numeric id
 * or a long opaque string is a record, not a page.
 */
function idSegment(segment: string): string {
  if (/^[0-9]+$/.test(segment)) return '*'
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) return '*'
  if (segment.length > 24) return '*'
  return segment
}

/** The help for the page at this pathname, or null if there is none. */
export function resolveHelpTopic(pathname: string): HelpTopic | null {
  const key = routeKey(pathname)
  if (key === null) return null
  return BY_ROUTE.get(key) ?? null
}

/**
 * Where the fuller help lives, from wherever you are standing.
 *
 * The lodge side and the portal are two different doors — a plain
 * member is redirected out of /lodge/[slug] by the layout before any
 * page in it renders, which is exactly how the duties page ended up
 * open and unreachable at the same time. So each side links to its own.
 */
export function helpBookHref(pathname: string, topicKey?: string | null): string {
  const parts = pathname.split('/').filter(Boolean)
  const base =
    parts[0] === 'lodge' && parts[1] ? `/lodge/${parts[1]}/help` : '/portal/help'
  return topicKey ? `${base}?topic=${encodeURIComponent(topicKey)}` : base
}

/** Free-text search over the index, for the help page's filter box. */
export function searchHelp(query: string): HelpTopic[] {
  const q = query.trim().toLowerCase()
  if (!q) return HELP_TOPICS
  const terms = q.split(/\s+/)
  return HELP_TOPICS.filter(topic => {
    const hay = [
      topic.title,
      topic.where,
      topic.lead,
      topic.who ?? '',
      ...topic.blocks.flatMap(blockText),
    ]
      .join(' ')
      .toLowerCase()
    return terms.every(term => hay.includes(term))
  })
}

function blockText(block: HelpBlock): string[] {
  switch (block.kind) {
    case 'p':
      return [block.text]
    case 'steps':
      return block.items
    case 'table':
      return [...(block.head ?? []), ...block.rows.flat()]
    case 'note':
    case 'warn':
      return [block.title, block.text]
  }
}
