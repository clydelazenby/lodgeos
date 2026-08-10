-- ============================================================
-- 020: Password reset throttle
-- ============================================================
--
-- The app had no password reset flow at all. A brother who set a
-- password and forgot it had no way back in, and there was no "forgot
-- password" link anywhere to ask for one.
--
-- Adding one creates an abuse vector that did not exist before: an
-- unauthenticated endpoint that sends email to any address handed to
-- it. Left open, anyone could sit on it and flood a brother's inbox —
-- and burn the lodge's Resend quota and sending reputation doing it.
--
-- Supabase's own rate limiting does NOT cover us here, because the
-- whole point of this change (and of the invitation fix before it) is
-- that we do not use Supabase's mailer. generateLink mints the token,
-- Resend delivers it, so the throttle has to be ours.
--
-- One column rather than a requests table: the only question worth
-- asking is "when did we last email this person a reset link", and
-- profiles already has exactly one row per person to hang that on.
--
-- SAFE TO RE-RUN.

alter table public.profiles
  add column if not exists last_password_reset_at timestamptz;

comment on column public.profiles.last_password_reset_at is
  'When a password reset link was last emailed to this brother. Written by /api/auth/forgot-password purely to throttle repeat sends — not a record of whether the reset was completed.';
