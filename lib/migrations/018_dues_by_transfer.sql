-- ============================================================
-- 018: Paying dues by Zelle, Cash App or Venmo
-- ============================================================
--
-- Card payments reconcile themselves: Stripe's webhook flips the
-- payment to succeeded, marks the brother paid, and emails a receipt
-- with nobody involved. A bank transfer has no such signal — Zelle in
-- particular offers no webhook or API for an ordinary business account,
-- so nothing can tell this app the money arrived.
--
-- The honest design is therefore a TWO-PARTY record: the brother states
-- that he has sent it, and the Treasurer confirms it landed. Neither
-- half alone marks him paid. A brother cannot mark his own dues settled
-- by pressing a button, and the Treasurer is never asked to guess who
-- an unexplained $60 came from.
--
-- Reuses the handles added in migration 017 for donations — the lodge
-- enters its Cash App, Venmo and Zelle details once and both the public
-- donation page and the dues page read them.
--
-- SAFE TO RE-RUN.

alter table public.payments
  add column if not exists payment_method text
    check (payment_method in ('card','zelle','cashapp','venmo','cash','check','other'));

comment on column public.payments.payment_method is
  'How the money moved. Null on rows written before this migration, which were all Stripe card payments. Transfers sit at status=pending until an officer confirms receipt.';

-- When the brother said he sent it. Distinct from created_at, which for
-- a card payment is when checkout began, and distinct from the moment
-- the Treasurer confirms.
alter table public.payments
  add column if not exists reported_at timestamptz;

-- Whatever the brother typed to help the Treasurer find it — a Zelle
-- confirmation number, "sent from my wife's account", a date. Free text
-- on purpose: the useful identifier differs by bank and by app.
alter table public.payments
  add column if not exists reference_note text;

-- Who confirmed the money arrived, and when. Without this a disputed
-- payment has no accountable officer behind it.
alter table public.payments
  add column if not exists confirmed_by uuid references public.profiles(id) on delete set null;

alter table public.payments
  add column if not exists confirmed_at timestamptz;

comment on column public.payments.confirmed_by is
  'Officer who confirmed a transfer was received. Null for card payments, which Stripe confirms automatically.';

-- The Treasurer's queue: transfers awaiting confirmation, for one lodge.
-- Partial, so it stays small against a table that grows every year.
create index if not exists idx_payments_pending_transfers
  on public.payments (tenant_id, reported_at desc)
  where status = 'pending' and payment_method is not null and payment_method <> 'card';

-- A brother must be able to record his own payment. The existing
-- "Payments insertable" policy allows inserts broadly; this makes the
-- read side explicit for his own rows, which "Own payments visible"
-- already covers. No new write privilege is granted here — the API
-- route is what validates amount, year and duplicates.

analyze public.payments;
