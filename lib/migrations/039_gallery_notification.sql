-- ============================================================
-- 039: A notice the whole lodge hears
-- ============================================================
--
-- The three events in 038 are roster changes, and they go to the
-- officers who keep the roster. A new photograph on the public site is
-- different in kind: it is news, and it is for the brethren.
--
-- SAME TABLE, DIFFERENT AUDIENCE. "What do I get emailed about, and how
-- do I stop it" is one question, and a brother must not have to find
-- two screens to answer it. So the preference lives here with the
-- others; what changes is the DEFAULT audience, which is per-event and
-- lives in lib/notifications.ts:
--
--   roster events        the administrative tier, plus the Worshipful
--                        Master and Senior Warden by office
--   gallery.photo_added  every active brother of the lodge
--
-- A row still overrules the default in either direction, so any brother
-- may switch this one off without touching the rest — and a brother on
-- the 'member' tier can reach it from his own portal, since he cannot
-- open the lodge-side page at all.
--
-- SAFE TO RE-RUN.

alter table public.notification_preferences
  drop constraint if exists notification_preferences_event_type_check;

alter table public.notification_preferences
  add constraint notification_preferences_event_type_check
  check (event_type in (
    'member.invited', 'member.first_signin', 'member.removed',
    'gallery.photo_added'
  ));

comment on table public.notification_preferences is
  'What each brother is emailed about. NO ROW means the default for that event: roster events go to the administrative tier plus the Worshipful Master and Senior Warden by office; gallery notices go to the whole lodge. A row overrules the default either way — anyone may switch his own off.';
