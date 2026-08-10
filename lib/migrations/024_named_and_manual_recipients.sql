-- ============================================================
-- 024: Named and manual notice recipients
-- ============================================================
--
-- A notice could only be addressed to one of four fixed groups: the
-- whole lodge, Master Masons, candidates, or those with dues
-- outstanding. There was no way to write to three named brethren, and
-- no way to include an address that is not on the roster at all —
-- a visiting brother, a Grand Lodge officer, a widow.
--
-- Two new values on the same column:
--
--   selected  a hand-picked list of brethren, sent with the notice as
--             member ids and resolved server-side against THIS lodge.
--   manual    addresses typed by hand. Restricted to platform super
--             admins in app/api/communications/send, because this is
--             the one path that can send from the lodge's verified
--             domain to an address nobody has vetted — the difference
--             between a lodge mailing list and an open relay is
--             exactly who may put a stranger's address into it.
--
-- The ids and addresses themselves are NOT stored on the row. This
-- column records how a notice was addressed, for the history list; the
-- per-recipient record already lives in communication_recipients
-- (migration 011), which is where "who actually got this" belongs.
--
-- SAFE TO RE-RUN.

alter table public.communications
  drop constraint if exists communications_recipient_group_check;

alter table public.communications
  add constraint communications_recipient_group_check
  check (recipient_group in ('all', 'mm_only', 'candidates', 'dues_outstanding', 'selected', 'manual'));

comment on column public.communications.recipient_group is
  'How this notice was addressed: all / mm_only / candidates / dues_outstanding / selected (hand-picked brethren) / manual (addresses typed by hand, super admin only). Who actually received it is recorded per-recipient in communication_recipients.';
