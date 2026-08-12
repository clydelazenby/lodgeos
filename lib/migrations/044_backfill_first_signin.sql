-- 044 · The brothers who signed in before anybody was counting
--
-- WHAT WENT WRONG. first_signin_at arrived in migration 038. Every
-- brother who had already signed in before that day kept a null, and
-- nothing filled it in — the column was written to record an event, and
-- their event had happened.
--
-- That was harmless while nothing read the column. The pending list
-- reads it, and read it as "never signed in": four men who had been
-- using the app for two days were listed as having never arrived, next
-- to eight who genuinely had not. A list of people to chase is worth
-- nothing if a third of it is wrong.
--
-- WHERE THE TRUTH LIVES. auth.users knows. confirmed_at is stamped when
-- an invited brother follows his link — which IS his first sign-in —
-- and last_sign_in_at is stamped every time thereafter. The earliest of
-- the two is the closest thing to the moment he first got in.
--
-- least() ignores nulls in Postgres, so a row with only one of the two
-- resolves to that one, and a row with neither is left alone by the
-- WHERE — which is exactly right: no evidence of a sign-in is not
-- evidence of one.
--
-- ONLY NULLS ARE TOUCHED. A row that already carries a date keeps it,
-- even where that date is really "when migration 038 landed" rather
-- than when the man first signed in. Those two rows are imprecise by a
-- day; rewriting records that are not causing harm is not what a
-- backfill is for.
--
-- Re-runnable: the WHERE excludes anything already filled in.

update tenant_members tm
set first_signin_at = least(u.confirmed_at, u.last_sign_in_at)
from auth.users u
where u.id = tm.user_id
  and tm.first_signin_at is null
  and (u.confirmed_at is not null or u.last_sign_in_at is not null);
