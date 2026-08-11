-- ============================================================
-- 037: A gallery with photographs in it
-- ============================================================
--
-- The public site has had a "Gallery" link in its navigation since it
-- was built, and clicking it scrolled you to FOUR EMPTY GOLD BOXES. Not
-- an empty state — a placeholder nobody ever replaced, advertised in
-- the nav of every lodge's front page.
--
-- A lodge's photographs are the one thing on that site a visitor
-- actually wants: the hall, the officers, the degree night, the pancake
-- breakfast. They are also the thing nobody will ever add if adding
-- them means a developer.
--
-- WHAT A PHOTO CARRIES, and why each field is here rather than being
-- "just an image URL":
--
--   caption      optional, and shown under the photo. Asked for.
--   alt_text     what a blind visitor or a search engine is told. NOT
--                the caption: "Bro. Powell raising the flag, 2019" is a
--                caption; "a man in an apron raising a flag outside a
--                brick hall" is alt text. Falls back to the caption when
--                blank, because an imperfect description beats none.
--   taken_on     optional. Lets the gallery group by year, and lets a
--                lodge scan forty years of prints without them landing
--                in upload order.
--   sort_order   the lodge's own arrangement. A gallery ordered by
--                upload time is ordered by the accident of which photo
--                was found first.
--   is_published a photo can be taken down without being destroyed.
--                Somebody objects to their picture being on the public
--                internet; the answer to that must not be "delete it
--                and hope we can find the original again".
--   width/height recorded at upload so the public page can reserve the
--                space before the image loads. Without them the page
--                jumps as each photo arrives, which is the single most
--                visible way a gallery looks cheap.
--   storage_path kept ALONGSIDE the url because a public URL is not a
--                handle you can delete by. Deleting a row without this
--                would orphan the file in the bucket forever.
--
-- SAFE TO RE-RUN.

create table if not exists public.gallery_photos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  tenant_id uuid references public.tenants(id) on delete cascade not null,

  -- Where the bytes are, and how to reach them. Both, for the reason
  -- in the header.
  storage_path text not null,
  url text not null,
  -- A smaller rendition for the grid. Null means "use the full one",
  -- so a photo uploaded before thumbnails existed still displays.
  thumb_url text,
  thumb_path text,

  caption text,
  alt_text text,
  taken_on date,

  sort_order integer not null default 0,
  is_published boolean not null default true,

  width integer,
  height integer,
  bytes integer,

  uploaded_by uuid,
  uploaded_by_name text
);

comment on table public.gallery_photos is
  'Photographs shown on the lodge public site. is_published=false takes one down without destroying it. storage_path is kept beside url because a public URL cannot be used to delete the object.';

comment on column public.gallery_photos.alt_text is
  'What a blind visitor or a search engine is told the photo shows — NOT the caption. Falls back to the caption when blank.';

-- The public page reads exactly this: published photos of one tenant,
-- in the lodge's own order.
create index if not exists idx_gallery_published
  on public.gallery_photos (tenant_id, sort_order, created_at desc)
  where is_published = true;

create index if not exists idx_gallery_tenant
  on public.gallery_photos (tenant_id, sort_order);

alter table public.gallery_photos enable row level security;

-- ANYONE, SIGNED IN OR NOT. This is the point of the table: the public
-- site is rendered for visitors who have no account and never will.
-- Only published rows — an unpublished photo is one the lodge has
-- deliberately taken down, and RLS is the right place to make that
-- true rather than trusting every query to remember the filter.
drop policy if exists "Published photos are public" on public.gallery_photos;
create policy "Published photos are public" on public.gallery_photos for select
  using (is_published = true);

-- Officers see the unpublished ones too, which is how they get
-- published again.
drop policy if exists "All photos visible to officers" on public.gallery_photos;
create policy "All photos visible to officers" on public.gallery_photos for select
  using (public.is_tenant_admin(tenant_id));

-- Writes go through the API on the service role; this policy is the
-- backstop for anything reaching PostgREST directly.
drop policy if exists "Gallery managed by officers" on public.gallery_photos;
create policy "Gallery managed by officers" on public.gallery_photos for all
  using (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------
-- The section's own settings
-- ------------------------------------------------------------
--
-- gallery_enabled exists so the section and its NAV LINK disappear
-- together. A lodge with no photographs should not advertise a Gallery
-- in its navigation — which is precisely the bug this migration is
-- fixing, and it would come straight back the first time a lodge
-- deleted its last photo.
alter table public.tenants
  add column if not exists gallery_enabled boolean not null default true;

alter table public.tenants
  add column if not exists gallery_heading text;

alter table public.tenants
  add column if not exists gallery_intro text;

comment on column public.tenants.gallery_enabled is
  'Whether the public site shows a Gallery section AND its nav link. Both, together — a nav entry that scrolls to nothing is worse than no nav entry.';

-- ------------------------------------------------------------
-- Storage
-- ------------------------------------------------------------
--
-- Public bucket: these images are served to anonymous visitors on the
-- lodge's front page, which is the whole purpose. 10MB because a
-- photograph off a modern phone is several megabytes before the
-- browser downscales it, and the upload path downscales before sending
-- rather than relying on this limit to catch it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery', 'gallery', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Gallery images are publicly viewable" on storage.objects;
create policy "Gallery images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'gallery');

-- Files live under gallery/{tenant_id}/..., so an officer of one lodge
-- cannot write into another's folder.
drop policy if exists "Officers upload gallery images" on storage.objects;
create policy "Officers upload gallery images"
  on storage.objects for insert
  with check (
    bucket_id = 'gallery'
    and public.is_tenant_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Officers replace gallery images" on storage.objects;
create policy "Officers replace gallery images"
  on storage.objects for update
  using (
    bucket_id = 'gallery'
    and public.is_tenant_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Officers delete gallery images" on storage.objects;
create policy "Officers delete gallery images"
  on storage.objects for delete
  using (
    bucket_id = 'gallery'
    and public.is_tenant_admin((storage.foldername(name))[1]::uuid)
  );
