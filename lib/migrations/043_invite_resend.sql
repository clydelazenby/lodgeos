-- 043 · When the invitation was last sent
--
-- The Members page can already tell who has never signed in —
-- first_signin_at (migration 038) is null for exactly those men. What
-- it could not tell was when anyone last tried, which is the question
-- an officer actually has: "he has been pending three weeks, has
-- anybody resent it?"
--
-- created_at answers it for the first send and then goes stale the
-- moment somebody resends. Two officers each pressing Resend once,
-- neither knowing the other did, is the failure this prevents.
--
-- Nullable, and left null for every brother already on the roster.
-- Backfilling it from created_at would assert that an invitation was
-- sent at a moment nobody recorded — the pending list reads "invited"
-- from created_at and only shows a resend once one has actually
-- happened.

alter table tenant_members
  add column if not exists invite_last_sent_at timestamptz;

comment on column tenant_members.invite_last_sent_at is
  'When an invitation email was last sent to this brother. Null means none has been sent since this column existed — not that none was sent. Set by /api/members/invite and /api/members/resend.';

-- The pending list asks for "active members of this lodge who have
-- never signed in", which is a small slice of a small table — but it
-- is read on every visit to the Members page, and a partial index
-- costs almost nothing to keep.
create index if not exists idx_tenant_members_pending
  on tenant_members (tenant_id)
  where first_signin_at is null and is_active = true;
