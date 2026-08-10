-- ============================================================
-- 027: A calendar a brother subscribes to once
-- ============================================================
--
-- The app already produced a per-event .ics file, which solves the
-- wrong half of the problem: a brother adds one meeting to his phone,
-- and next month he has to be sent another link and remember to tap it.
-- Every stated communication, degree night and festive board is a fresh
-- act of clerical work performed by fifty people independently.
--
-- A subscription feed is added once and then never thought about again.
-- The calendar app re-fetches it, so a meeting moved on Tuesday moves in
-- fifty pockets on Tuesday.
--
-- WHY A TOKEN AND NOT THE SLUG. Calendar clients send no cookies and
-- offer no way to authenticate — a subscription URL is opened by iOS,
-- Google Calendar or Outlook with nothing but the URL itself. So the URL
-- has to be the credential. /psalms-of-job-1827/calendar.ics would be
-- guessable by anyone who has seen the lodge's public page, and the feed
-- carries the whole year's schedule including events not marked public.
--
-- A random uuid is 122 bits of entropy, which is not guessable, and it
-- is per-lodge rather than per-brother. That is a deliberate trade: a
-- per-brother token would let a lodge revoke one man's access, but it
-- would also mean a feed URL that identifies him, in a file his phone
-- fetches over the network several times a day. The lodge calendar is
-- not a secret from the brethren; it is merely not for the open web.
--
-- Rotatable: changing the token invalidates every existing subscription
-- at once, which is the correct blunt instrument if a URL ever leaks.
--
-- SAFE TO RE-RUN.

alter table public.tenants
  add column if not exists calendar_token uuid default gen_random_uuid();

-- Existing lodges predate the default and would otherwise hold null.
update public.tenants
  set calendar_token = gen_random_uuid()
  where calendar_token is null;

alter table public.tenants
  alter column calendar_token set not null;

comment on column public.tenants.calendar_token is
  'Unguessable key in the calendar subscription URL (/api/calendar/[token]/lodge.ics). Calendar clients cannot authenticate, so the URL is the credential. Per-lodge rather than per-brother: a per-brother token would identify the reader in a file his phone fetches all day. Rotating it revokes every existing subscription at once.';

-- The feed route looks a lodge up BY this token and by nothing else, so
-- it wants its own unique index rather than relying on the primary key.
create unique index if not exists idx_tenants_calendar_token
  on public.tenants (calendar_token);
