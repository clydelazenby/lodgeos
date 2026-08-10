-- ============================================================
-- 023: Lodge taglines for email
-- ============================================================
--
-- The email templates are being rebuilt to look like the lodge's own
-- stationery rather than a LodgeOS notification: the crest at the top,
-- the lodge's name and tagline beneath it, and a footer carrying the
-- lodge's own contact details and motto.
--
-- Everything that needs is already on tenants — logo_url, email, phone,
-- website, name, number, colours — except the two lines of set text
-- that appear on every piece a lodge sends:
--
--   tagline  the line under the lodge name  ("Faith · Brotherhood · Service")
--   motto    the line closing the footer    ("Making good men better since 1827")
--
-- Both are nullable with no default. A lodge that has not set them gets
-- a sensible fallback in the template rather than an empty band, and
-- nothing here overwrites what a lodge already has.
--
-- SAFE TO RE-RUN.

alter table public.tenants
  add column if not exists tagline text;

comment on column public.tenants.tagline is
  'Short line shown beneath the lodge name on emails and the public site, e.g. "Faith · Brotherhood · Service". Falls back to the rite when unset.';

alter table public.tenants
  add column if not exists motto text;

comment on column public.tenants.motto is
  'Closing line in the email footer, e.g. "Making good men better since 1827". Falls back to a generic fraternal line when unset.';
