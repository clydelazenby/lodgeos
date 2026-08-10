-- ============================================================
-- 014: Penalties, fines and one-off charges
-- ============================================================
--
-- Dues were the only money the app understood: one rate per lodge, one
-- paid/due/exempt flag per brother. Real lodges also levy reinstatement
-- fees, degree fees, late penalties and assessments — amounts that vary
-- per brother and per reason, and that exist alongside annual dues
-- rather than replacing them.
--
-- A second dues column could not express this. A brother can owe a
-- reinstatement fee and a late penalty at once, each with its own
-- reason, date and settlement. That is a ledger, so this is a table.
--
-- WHY NOT REUSE `payments`
-- `payments` records money RECEIVED. A charge is money OWED, which is a
-- different thing with a different lifecycle — it can be waived, which
-- a payment cannot. When a charge is settled, a normal `payments` row
-- is still written; the two are linked by paid_payment_id below.
--
-- SAFE TO RE-RUN.

create table if not exists public.member_charges (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),

  tenant_id uuid references public.tenants(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,

  -- Stored in dollars to match tenants.dues_amount and payments.amount,
  -- which are both numeric(10,2). Deliberately consistent with the rest
  -- of the schema rather than switching to integer cents here — mixing
  -- both conventions in one codebase is how rounding bugs start.
  amount numeric(10,2) not null check (amount > 0),

  charge_type text not null default 'penalty'
    check (charge_type in ('penalty','late_fee','degree_fee','reinstatement','assessment','other')),

  -- Free text shown to the brother. A charge with no stated reason is
  -- indefensible when questioned in open lodge, so it is required.
  reason text not null,

  status text not null default 'outstanding'
    check (status in ('outstanding','paid','waived')),

  due_date date,
  paid_at timestamptz,

  -- Set when settled through Stripe, so a charge can be traced to the
  -- actual receipt rather than just being flipped to 'paid'.
  paid_payment_id uuid references public.payments(id) on delete set null,

  -- Who levied it, and who waived it. Both matter: this is the lodge's
  -- money and both actions should be attributable.
  created_by uuid references public.profiles(id) on delete set null,
  waived_by uuid references public.profiles(id) on delete set null,
  waived_reason text
);

comment on table public.member_charges is
  'Per-brother penalties, fines and one-off fees, separate from annual dues. Money OWED — see payments for money RECEIVED. A settled charge points at the payment that settled it.';

-- The dues page lists every outstanding charge for a lodge; the member
-- portal lists one brother's own.
create index if not exists idx_member_charges_tenant_status
  on public.member_charges (tenant_id, status);

create index if not exists idx_member_charges_member
  on public.member_charges (member_id, status);

alter table public.member_charges enable row level security;

-- A brother must be able to see what he is being charged — being billed
-- by an organisation that won't show you the bill is not acceptable.
drop policy if exists "Own charges visible" on public.member_charges;
create policy "Own charges visible" on public.member_charges for select
  using (member_id = (select auth.uid()));

-- Levying and waiving is a treasurer/secretary action. is_tenant_admin()
-- covers admin and secretary; the API layer additionally allows the
-- treasurer, who is not in that function's definition.
drop policy if exists "Charges manageable by lodge admins" on public.member_charges;
create policy "Charges manageable by lodge admins" on public.member_charges for all
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

analyze public.member_charges;
