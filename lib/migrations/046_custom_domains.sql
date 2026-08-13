-- 046 · A lodge's own domain, so the front door is not one lodge's
--
-- app/page.tsx was `redirect('/psalms-of-job-1827')`. That is not a
-- placeholder — it is load-bearing. psalmslodge1827.com points at this
-- application, and that redirect is the entire mechanism by which the
-- lodge's own domain reaches the lodge's own website.
--
-- Which means the obvious multi-tenant fix — point the root at the
-- marketing page — would take a real lodge's website down and replace
-- it with an advertisement for the software it runs on.
--
-- So the root has to answer by HOST instead. A request arriving on a
-- lodge's own domain gets that lodge; anything else gets the marketing
-- page. This column is what makes that lookup possible.
--
-- STORED BARE: no scheme, no www, no trailing slash, lower case —
-- 'psalmslodge1827.com'. The lookup normalises the incoming Host the
-- same way, so www and non-www both resolve. A constraint enforces it
-- rather than trusting every future caller to remember.
--
-- UNIQUE, obviously: two lodges cannot claim one domain, and the
-- failure if they could is one lodge's website serving another's.

alter table public.tenants
  add column if not exists custom_domain text;

update public.tenants
set custom_domain = lower(regexp_replace(custom_domain, '^(https?://)?(www\.)?|/+$', '', 'g'))
where custom_domain is not null;

alter table public.tenants
  drop constraint if exists tenants_custom_domain_shape;
alter table public.tenants
  add constraint tenants_custom_domain_shape check (
    custom_domain is null
    or custom_domain = lower(custom_domain)
    and custom_domain !~ '^(https?://|www\.)'
    and custom_domain !~ '/'
    and custom_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'
  );

create unique index if not exists tenants_custom_domain_key
  on public.tenants (custom_domain)
  where custom_domain is not null;

comment on column public.tenants.custom_domain is
  'The lodge''s own domain, stored bare and lower case (no scheme, no www, no trailing slash). A request arriving on this Host is served that lodge''s public site from the root. Null means the lodge is reached at /<slug> only.';

-- The lodge this was built for keeps exactly the behaviour it has
-- today: its domain still lands on its own website, now by lookup
-- rather than by a hardcoded redirect.
update public.tenants
set custom_domain = 'psalmslodge1827.com'
where slug = 'psalms-of-job-1827' and custom_domain is null;
