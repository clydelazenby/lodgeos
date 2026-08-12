/**
 * What a lodge may put in its document library, in one place.
 *
 * THERE ARE THREE GATES AND THEY MUST AGREE. A document upload passes
 * through:
 *
 *   1. the file picker's `accept` attribute        (a suggestion)
 *   2. Supabase Storage's bucket allow-list        (the hard wall)
 *   3. /api/documents/record's own check           (the record)
 *
 * The browser now uploads STRAIGHT to Storage, so gate 2 fires before
 * a single line of our code runs. That is why adding PowerPoint to the
 * route alone would have changed nothing: the bucket rejected it first,
 * and the officer saw a storage error with no explanation of what was
 * wrong with his file. All three read this table.
 *
 * NO SERVER IMPORTS. Read by the upload component in the browser and
 * by the route on the server.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THE EXTENSION DECIDES, NOT THE BROWSER
 *
 * `file.type` is a guess the operating system makes, and for Office
 * files it is frequently wrong or empty — a .pptx on a Windows machine
 * with no Office installed commonly arrives as 'application/octet-stream'
 * or as ''. supabase-js then falls back to a default content type, the
 * bucket refuses it, and a perfectly ordinary presentation "cannot be
 * uploaded" on one brother's laptop while working on another's.
 *
 * So the extension is authoritative and the browser's guess is only
 * accepted when it is already something we allow. This is safe because
 * nothing here is executed: the bucket is private, downloads are
 * served as signed URLs, and the app never opens or parses these files.
 */

export type UploadKind =
  | 'document' | 'presentation' | 'spreadsheet' | 'image'
  | 'video' | 'audio' | 'archive'

export type UploadFormat = {
  ext: string
  mime: string
  /** What to call it in a list. Short enough for a badge. */
  label: string
  kind: UploadKind
  /** Other mime types the same extension is reported as, in the wild. */
  also?: string[]
}

/**
 * Deliberately excluded, and why — so the next person adding a format
 * knows which omissions were decisions:
 *
 *   .svg   — a scriptable document dressed as a picture. Everything
 *            else here is inert when opened.
 *   .html  — same reason, less disguised.
 *   .exe, .msi, .app, .dmg, .jar, .sh, .bat, .ps1 — programs. A lodge
 *            document library is not a software distribution channel,
 *            and a brother trusts what he downloads from it.
 */
export const UPLOAD_FORMATS: UploadFormat[] = [
  /* ── Written documents ───────────────────────────────────────── */
  { ext: '.pdf',  mime: 'application/pdf', label: 'PDF', kind: 'document' },
  { ext: '.doc',  mime: 'application/msword', label: 'Word', kind: 'document' },
  { ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word', kind: 'document' },
  { ext: '.docm', mime: 'application/vnd.ms-word.document.macroEnabled.12', label: 'Word', kind: 'document' },
  { ext: '.odt',  mime: 'application/vnd.oasis.opendocument.text', label: 'Writer', kind: 'document' },
  { ext: '.rtf',  mime: 'application/rtf', label: 'RTF', kind: 'document', also: ['text/rtf'] },
  { ext: '.txt',  mime: 'text/plain', label: 'Text', kind: 'document' },
  { ext: '.md',   mime: 'text/markdown', label: 'Text', kind: 'document', also: ['text/plain'] },
  { ext: '.pages', mime: 'application/vnd.apple.pages', label: 'Pages', kind: 'document' },

  /* ── Presentations. The reason this table exists. ────────────── */
  { ext: '.ppt',  mime: 'application/vnd.ms-powerpoint', label: 'PowerPoint', kind: 'presentation' },
  { ext: '.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', label: 'PowerPoint', kind: 'presentation' },
  { ext: '.pptm', mime: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12', label: 'PowerPoint', kind: 'presentation' },
  // A .ppsx opens straight into the slideshow. Officers who prepare a
  // degree lecture often save it this way on purpose.
  { ext: '.ppsx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow', label: 'Slideshow', kind: 'presentation' },
  { ext: '.pps',  mime: 'application/vnd.ms-powerpoint', label: 'Slideshow', kind: 'presentation' },
  { ext: '.odp',  mime: 'application/vnd.oasis.opendocument.presentation', label: 'Impress', kind: 'presentation' },
  { ext: '.key',  mime: 'application/vnd.apple.keynote', label: 'Keynote', kind: 'presentation' },

  /* ── Spreadsheets ────────────────────────────────────────────── */
  { ext: '.xls',  mime: 'application/vnd.ms-excel', label: 'Excel', kind: 'spreadsheet' },
  { ext: '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel', kind: 'spreadsheet' },
  { ext: '.xlsm', mime: 'application/vnd.ms-excel.sheet.macroEnabled.12', label: 'Excel', kind: 'spreadsheet' },
  { ext: '.ods',  mime: 'application/vnd.oasis.opendocument.spreadsheet', label: 'Calc', kind: 'spreadsheet' },
  { ext: '.numbers', mime: 'application/vnd.apple.numbers', label: 'Numbers', kind: 'spreadsheet' },
  { ext: '.csv',  mime: 'text/csv', label: 'CSV', kind: 'spreadsheet', also: ['application/csv', 'text/plain'] },

  /* ── Pictures ────────────────────────────────────────────────── */
  { ext: '.jpg',  mime: 'image/jpeg', label: 'Image', kind: 'image' },
  { ext: '.jpeg', mime: 'image/jpeg', label: 'Image', kind: 'image' },
  { ext: '.png',  mime: 'image/png', label: 'Image', kind: 'image' },
  { ext: '.webp', mime: 'image/webp', label: 'Image', kind: 'image' },
  { ext: '.gif',  mime: 'image/gif', label: 'Image', kind: 'image' },
  // What an iPhone takes by default. Leaving it out meant a brother
  // photographing a document with the phone in his hand could not
  // upload it.
  { ext: '.heic', mime: 'image/heic', label: 'Image', kind: 'image' },
  { ext: '.heif', mime: 'image/heif', label: 'Image', kind: 'image' },
  { ext: '.tif',  mime: 'image/tiff', label: 'Scan', kind: 'image' },
  { ext: '.tiff', mime: 'image/tiff', label: 'Scan', kind: 'image' },
  { ext: '.bmp',  mime: 'image/bmp', label: 'Image', kind: 'image' },

  /* ── Recordings ──────────────────────────────────────────────── */
  { ext: '.mp4',  mime: 'video/mp4', label: 'Video', kind: 'video' },
  { ext: '.m4v',  mime: 'video/x-m4v', label: 'Video', kind: 'video', also: ['video/mp4'] },
  { ext: '.webm', mime: 'video/webm', label: 'Video', kind: 'video' },
  { ext: '.mov',  mime: 'video/quicktime', label: 'Video', kind: 'video' },
  { ext: '.avi',  mime: 'video/x-msvideo', label: 'Video', kind: 'video' },
  { ext: '.mpg',  mime: 'video/mpeg', label: 'Video', kind: 'video' },
  { ext: '.mpeg', mime: 'video/mpeg', label: 'Video', kind: 'video' },
  { ext: '.mp3',  mime: 'audio/mpeg', label: 'Audio', kind: 'audio' },
  { ext: '.m4a',  mime: 'audio/mp4', label: 'Audio', kind: 'audio', also: ['audio/x-m4a'] },
  { ext: '.aac',  mime: 'audio/aac', label: 'Audio', kind: 'audio' },
  { ext: '.wav',  mime: 'audio/wav', label: 'Audio', kind: 'audio', also: ['audio/x-wav', 'audio/wave'] },
  { ext: '.ogg',  mime: 'audio/ogg', label: 'Audio', kind: 'audio' },

  /* ── A bundle of the above ───────────────────────────────────── */
  // Degree material often arrives from the Grand Lodge as one zip of
  // twenty files. Refusing it means asking an officer to unpack and
  // re-upload twenty times, which is how a library ends up empty.
  { ext: '.zip',  mime: 'application/zip', label: 'Zip', kind: 'archive', also: ['application/x-zip-compressed', 'multipart/x-zip'] },
]

/** The file picker's filter. Extensions only — see the note above. */
export const UPLOAD_ACCEPT = Array.from(new Set(UPLOAD_FORMATS.map(f => f.ext))).join(',')

/** Every mime type the bucket and the route accept. */
export const ALLOWED_MIME_TYPES: string[] = Array.from(
  new Set(UPLOAD_FORMATS.flatMap(f => [f.mime, ...(f.also ?? [])]))
).sort()

const BY_EXT = new Map<string, UploadFormat>()
for (const f of UPLOAD_FORMATS) if (!BY_EXT.has(f.ext)) BY_EXT.set(f.ext, f)

/** '.pptx' from 'Degree Lecture.FINAL.pptx'. Lower-cased. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot).toLowerCase()
}

export function formatFor(filename: string): UploadFormat | null {
  return BY_EXT.get(extensionOf(filename)) ?? null
}

/**
 * The content type to actually upload with.
 *
 * THE EXTENSION DECIDES, AND NOTHING ELSE DOES. An earlier draft of
 * this fell back to the browser's claim when the extension was
 * unknown, on the reasoning that an allowed mime type is an allowed
 * mime type. That is a hole, and the test found it: `payload.exe`
 * claiming to be `application/pdf` was accepted and stored under a PDF
 * content type. The extension is what a brother double-clicks — a
 * program filed in the lodge library as a document is precisely the
 * thing this list exists to prevent.
 *
 * Returns null for a file we do not accept, which is the caller's cue
 * to refuse before anything is uploaded. `browserType` is taken only
 * as corroboration and never as permission.
 */
export function contentTypeFor(filename: string, _browserType?: string | null): string | null {
  return formatFor(filename)?.mime ?? null
}

export function isAllowedUpload(filename: string, browserType?: string | null): boolean {
  return contentTypeFor(filename, browserType) !== null
}

/** The badge in the library: 'PowerPoint', 'Excel', 'PDF'. */
export function formatLabel(filename?: string | null, mime?: string | null): string | null {
  const byExt = filename ? formatFor(filename) : null
  if (byExt) return byExt.label
  if (!mime) return null
  const m = mime.split(';')[0].trim().toLowerCase()
  const byMime = UPLOAD_FORMATS.find(f => f.mime === m || (f.also ?? []).includes(m))
  return byMime?.label ?? null
}

/**
 * The sentence under the file picker, and the one in the error.
 *
 * Written as families rather than a list of forty extensions: "PDF,
 * Word, PowerPoint, Excel…" is something an officer can check himself
 * against, where a wall of dotted extensions is something he skims.
 */
export const UPLOAD_FAMILIES =
  'PDF, Word, PowerPoint, Excel, OpenDocument, Pages/Keynote/Numbers, text, CSV, images, video, audio and zip'

/** What to tell someone whose file was refused. */
export function refusalMessage(filename: string): string {
  const ext = extensionOf(filename)
  return ext
    ? `LodgeOS does not accept ${ext} files. It takes ${UPLOAD_FAMILIES}.`
    : `That file has no extension, so there is no way to tell what it is. LodgeOS takes ${UPLOAD_FAMILIES}.`
}
