-- ============================================================
-- MIGRATION: QR attendance
-- Run against an already-provisioned database.
--
-- Two real scan flows, both requested explicitly:
--   1. Officer scans each member's personal QR at the door (roster-style)
--   2. One QR is displayed for the meeting; members scan it with their
--      own phones to check themselves in
--
-- SECURITY DESIGN — this matters more than a typical QR feature,
-- because a QR that directly encoded "member X, present" would be
-- screenshot-and-replay-able forever, marking someone present at
-- meetings they never attended. The fix, matching the pattern already
-- used correctly for event_rsvps.rsvp_token: the QR encodes a stable
-- per-member IDENTITY token, not an attendance record. Scanning it
-- only tells the system WHO is presenting the code — the actual
-- check-in write (see /api/attendance/qr-checkin) always validates
-- against whichever meeting is CURRENTLY OPEN server-side (lodge_events
-- .opened_at set, .closed_at null, from migration 008's Meeting Mode).
-- This means a screenshotted or shared code can identify someone, but
-- cannot retroactively fake attendance at a past meeting or one that
-- was never opened — there's no "meeting_id" baked into the code to replay.
-- ============================================================

alter table public.profiles
  add column if not exists qr_token uuid default gen_random_uuid();

comment on column public.profiles.qr_token is
  'Stable per-member identity token, distinct from the member''s real id/email — used to encode a personal QR code for attendance check-in. Scanning it identifies WHO is present, not which meeting; the check-in route always writes against whichever meeting is currently open (lodge_events.opened_at set, closed_at null), so a screenshotted code from a prior night cannot mark someone present at a meeting they did not attend. Regeneratable via /api/profile/qr-regenerate if a code is ever suspected compromised.';

-- Ensure every existing profile has a token — the column default only
-- applies to NEW rows, so a backfill is needed for members who existed
-- before this migration ran.
update public.profiles set qr_token = gen_random_uuid() where qr_token is null;

alter table public.profiles alter column qr_token set not null;

create unique index if not exists profiles_qr_token_idx on public.profiles(qr_token);

-- Meeting-side token for flow 2 (members scan one QR displayed for the
-- meeting). Deliberately NOT the event's own id — a fresh random token
-- generated each time the meeting is opened (see the updated
-- /api/meeting/open route), so a captured/screenshotted meeting QR
-- from a past session stops working the moment that session closes,
-- rather than remaining a permanently-valid code tied to a reused event.
alter table public.lodge_events
  add column if not exists meeting_qr_token uuid;

comment on column public.lodge_events.meeting_qr_token is
  'Regenerated (not reused) each time this meeting is opened via /api/meeting/open. Null when the meeting has never been opened, or once closed — a self-checkin scan against a stale/closed token is rejected. This is what member self-checkin verifies against, kept separate from profiles.qr_token (which identifies the SCANNING member in flow 1, the officer-scans-member direction).';
