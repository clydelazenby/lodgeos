-- ============================================================
-- 032: Which copy of the bylaws is the one that governs
-- ============================================================
--
-- Bylaws get amended. Minutes get corrected. A form from Grand Lodge is
-- reissued. Every document library in the world converges on the same
-- failure: Bylaws.pdf, Bylaws_v2.pdf and Bylaws_v3_FINAL_final.pdf
-- sitting side by side with nothing to say which one is in force, and a
-- brother reading whichever he happens to click.
--
-- Deleting the old one is not the answer. A lodge is sometimes asked
-- what its bylaws said in 2019, and an amendment history is itself a
-- record. So the old copy stays and simply stops being the current one.
--
-- ONE POINTER, NOT A VERSION NUMBER. The new document names the one it
-- replaces. A version number would have to be maintained by hand and
-- would be wrong the first time two people uploaded on the same evening;
-- "this supersedes that" is a fact the uploader knows for certain at the
-- moment he uploads.
--
-- The list shows only current documents — a row nobody supersedes —
-- with earlier versions collapsed beneath. See app/lodge/[slug]/documents.
--
-- SAFE TO RE-RUN.

alter table public.documents
  add column if not exists supersedes_id uuid references public.documents(id) on delete set null;

comment on column public.documents.supersedes_id is
  'The document this one replaces, if any. Chains: v3 supersedes v2 supersedes v1. A document is CURRENT when no other document supersedes it. ON DELETE SET NULL so removing an old version cannot cascade away the current one — the chain simply becomes shorter.';

-- The list asks "is anything superseding this?" for every row it shows,
-- which is a lookup by supersedes_id rather than by id.
create index if not exists idx_documents_supersedes
  on public.documents (tenant_id, supersedes_id)
  where supersedes_id is not null;

-- A document cannot replace itself. Postgres cannot express the full
-- no-cycles rule in a CHECK, but the one-step case is the one a
-- mis-click actually produces, and it is the one that would render a
-- document permanently invisible (superseded by itself, therefore never
-- current).
alter table public.documents
  drop constraint if exists documents_no_self_supersede;

alter table public.documents
  add constraint documents_no_self_supersede
  check (supersedes_id is null or supersedes_id <> id);
