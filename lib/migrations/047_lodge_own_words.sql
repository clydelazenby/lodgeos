-- 047 · A lodge's own welcome, instead of another lodge's
--
-- Two paragraphs on every public lodge site were Psalms of Job's words,
-- hardcoded — not as that lodge's content, but as the DEFAULT for
-- whichever lodge the page happened to be rendering:
--
--   "On behalf of Psalms of Job Lodge No. 1827, we extend a heartfelt
--    welcome to all who visit our website…"
--   "Psalms of Job Lodge No. 1827 is a collective group of men from the
--    North, East, South and West…"
--
-- At one lodge that is correct by accident. At two it is a second lodge
-- publishing the first one's name on its own website as though it were
-- its own — which is worse than a placeholder, because it reads as
-- finished and nobody thinks to change it.
--
-- about_text already existed and is editable in settings; there was
-- nowhere to put a welcome. Both are nullable, and the site falls back
-- to wording that names the lodge being rendered rather than any
-- particular one.
--
-- BACKFILLED FOR PSALMS OF JOB ONLY, with the exact words that are on
-- its site today. The lodge this was written for loses nothing; every
-- lodge after it starts blank and is prompted to write its own.

alter table public.tenants
  add column if not exists welcome_message text;

comment on column public.tenants.welcome_message is
  'The lodge''s own greeting to visitors, shown on its public site. Null falls back to neutral wording that names this lodge — never another one.';

update public.tenants
set welcome_message = 'On behalf of Psalms of Job Lodge No. 1827, we extend a heartfelt welcome to all who visit our website. May Brotherly Love, Relief, and Truth always be with you on your journey.'
where slug = 'psalms-of-job-1827' and welcome_message is null;

update public.tenants
set about_text = 'Psalms of Job Lodge No. 1827 is a collective group of men from the North, East, South, and West who have come together as Brethren. Our purpose is to teach, learn, build fellowship, and serve our communities while preserving the traditions and teachings of Freemasonry.'
where slug = 'psalms-of-job-1827' and coalesce(about_text, '') = '';
