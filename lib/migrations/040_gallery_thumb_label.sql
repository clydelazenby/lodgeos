-- ============================================================
-- 040: What is printed over a thumbnail
-- ============================================================
--
-- The grid printed the description over every picture, always. That is
-- right for a photograph OF something — "Installation night, 2025" —
-- and wrong for a wall of portraits, where the same band of text over
-- twenty faces is noise obscuring the very thing a visitor came to
-- look at.
--
-- So it becomes the lodge's choice. Four answers, because these are
-- the four a lodge actually wants:
--
--   caption        the description (what it has always done)
--   caption_date   the description and the month it was taken
--   date           the month alone — for a set of portraits or a
--                  historical run where the date is the useful fact
--   none           nothing over the picture at all
--
-- IT NEVER AFFECTS THE ENLARGED VIEW. Opening a photograph always
-- shows everything it has, and alt text is untouched either way — this
-- is about what covers the image in the grid, not about withholding
-- information from anyone.
--
-- SAFE TO RE-RUN.

alter table public.tenants
  add column if not exists gallery_thumb_label text not null default 'caption';

alter table public.tenants
  drop constraint if exists tenants_gallery_thumb_label_check;

alter table public.tenants
  add constraint tenants_gallery_thumb_label_check
  check (gallery_thumb_label in ('caption', 'caption_date', 'date', 'none'));

comment on column public.tenants.gallery_thumb_label is
  'What is printed over each thumbnail in the public gallery grid: the description, the description and month, the month alone, or nothing. Never affects the enlarged view, which always shows everything the photograph has.';
