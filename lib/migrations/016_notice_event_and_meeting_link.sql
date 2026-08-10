-- ============================================================
-- 016: Attach an event and a meeting link to a notice
-- ============================================================
--
-- Two things a lodge notice usually needs and could not carry:
--
-- 1. THE MEETING IT IS ABOUT. "Reminder — stated communication
--    Tuesday" is far more useful with the date, time and location in
--    the email and a one-tap way to put it in the brother's calendar.
--
-- 2. A JOIN LINK. Zoom, Google Meet, Discord — for lodges running
--    hybrid meetings or online education, the link IS the notice.
--
-- Neither can be an email ATTACHMENT: Resend's batch endpoint types
-- CreateBatchEmailOptions as Omit<CreateEmailOptions, 'attachments'>,
-- so a batched notice cannot carry an .ics file at all. Sending
-- individually to attach one would mean a request per brother, which is
-- exactly the timeout and rate-limit problem batching solved.
--
-- So the notice carries a LINK to a calendar file instead, served by
-- /api/events/[eventId]/calendar.ics. That works in every mail client,
-- is not subject to attachment stripping by mail-security filters, and
-- keeps the batch send intact. It is also better on a phone, where
-- tapping a link opens the calendar app directly.
--
-- SAFE TO RE-RUN.

alter table public.communications
  add column if not exists event_id uuid references public.lodge_events(id) on delete set null;

comment on column public.communications.event_id is
  'Optional lodge event this notice is about. When set, the email includes the event details and an Add to Calendar link. ON DELETE SET NULL: deleting an event must not delete the record of a notice that was genuinely sent about it.';

alter table public.communications
  add column if not exists meeting_url text;

comment on column public.communications.meeting_url is
  'Optional Zoom/Meet/Discord/Teams join link, rendered as a button in the notice. Free-form URL — LodgeOS does not create meetings on those platforms, it only carries the link the officer pastes in.';
