-- =========================================================================
-- IEEE Student Branch — Finance Tracker
-- Full database schema with Row Level Security (RLS)
--
-- HOW TO RUN THIS:
-- Supabase Dashboard -> your project -> SQL Editor -> New Query
-- Paste this whole file -> Run
-- =========================================================================

-- ---------- PROFILES (extends Supabase's built-in auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('master','admin','user')),
  created_at timestamptz not null default now()
);

-- IMPORTANT: on some Supabase projects, newly created tables do not
-- automatically receive default privileges for the `authenticated` role,
-- even with RLS policies defined below. Without this GRANT, every query
-- fails with "permission denied for table" (Postgres error 42501) before
-- RLS policies are even evaluated — RLS decides WHICH rows a role can see,
-- but the role still needs baseline permission to touch the table at all.
-- This block guarantees that baseline access exists; the RLS policies
-- further down are what actually restrict what each role can do.
grant usage on schema public to authenticated, anon;

alter table profiles enable row level security;

-- Every policy below checks the caller's role with an inline subquery
-- `(select role from profiles where id = auth.uid())` instead of a shared
-- helper function. An earlier version used a SECURITY DEFINER function for
-- this, but Supabase's security advisor correctly flags that pattern —
-- such a function is directly callable by anyone via the auto-generated
-- API (/rest/v1/rpc/...), not just usable inside policies. Inlining the
-- subquery gives identical logic with nothing externally callable.

create policy "profiles_select_own_or_master"
  on profiles for select
  using (id = auth.uid() or (select role from profiles where id = auth.uid()) in ('master','admin'));

create policy "profiles_master_insert"
  on profiles for insert
  with check ((select role from profiles where id = auth.uid()) = 'master' or auth.uid() = id);
  -- auth.uid() = id allows the signup trigger (below) to create the row

create policy "profiles_master_update"
  on profiles for update
  using ((select role from profiles where id = auth.uid()) = 'master');

create policy "profiles_master_delete"
  on profiles for delete
  using ((select role from profiles where id = auth.uid()) = 'master');


-- ---------- FESTS ----------
create table fests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active','closed')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table fests enable row level security;

create policy "fests_select_all_authenticated"
  on fests for select
  using (auth.uid() is not null);

create policy "fests_admin_write"
  on fests for insert
  with check ((select role from profiles where id = auth.uid()) in ('admin','master'));

create policy "fests_admin_update"
  on fests for update
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));

create policy "fests_master_delete"
  on fests for delete
  using ((select role from profiles where id = auth.uid()) = 'master');


-- ---------- EVENTS (workshops / competitions under a fest) ----------
create table events (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid not null references fests(id) on delete cascade,
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table events enable row level security;

create policy "events_select_all_authenticated"
  on events for select
  using (auth.uid() is not null);

create policy "events_admin_write"
  on events for insert
  with check ((select role from profiles where id = auth.uid()) in ('admin','master'));

create policy "events_admin_update"
  on events for update
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));

create policy "events_admin_delete"
  on events for delete
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));


-- ---------- VENDORS (global, reused across fests) ----------
create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact text,
  created_at timestamptz not null default now()
);

alter table vendors enable row level security;

create policy "vendors_select_all_authenticated"
  on vendors for select
  using (auth.uid() is not null);

create policy "vendors_admin_write"
  on vendors for insert
  with check ((select role from profiles where id = auth.uid()) in ('admin','master'));

create policy "vendors_admin_update"
  on vendors for update
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));

create policy "vendors_admin_delete"
  on vendors for delete
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));


-- ---------- CATEGORIES (expense: Stationery, Printing, Mementos... / income: Registration, Sponsorship...) ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('expense','income')),
  unique(name, kind)
);

alter table categories enable row level security;

create policy "categories_select_all_authenticated"
  on categories for select
  using (auth.uid() is not null);

create policy "categories_admin_write"
  on categories for insert
  with check ((select role from profiles where id = auth.uid()) in ('admin','master'));

create policy "categories_admin_delete"
  on categories for delete
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));


-- ---------- EXPENSES ----------
-- Covers three real-world flavors your branch deals with:
--  vendor_purchase   -> bought from a vendor (stationery, printing, mementos, electronics...)
--  volunteer_expense -> paid personally by a volunteer, reimbursed later by Section
--  conveyance        -> travel cost paid personally by a volunteer, reimbursed later by Section
create table expenses (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid not null references fests(id) on delete cascade,
  category_id uuid references categories(id),
  expense_type text not null check (expense_type in ('vendor_purchase','volunteer_expense','conveyance')),
  vendor_id uuid references vendors(id),
  paid_by_volunteer text,
  reimbursed boolean not null default false,
  item_name text not null,
  quantity numeric,
  rate numeric,
  amount numeric not null check (amount >= 0),
  expense_date date not null default current_date,
  drive_link text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

create policy "expenses_select_all_authenticated"
  on expenses for select
  using (auth.uid() is not null);

create policy "expenses_insert_any_authenticated"
  on expenses for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "expenses_update_own_or_admin"
  on expenses for update
  using (created_by = auth.uid() or (select role from profiles where id = auth.uid()) in ('admin','master'));

create policy "expenses_delete_own_or_admin"
  on expenses for delete
  using (created_by = auth.uid() or (select role from profiles where id = auth.uid()) in ('admin','master'));


-- ---------- EXPENSE ALLOCATIONS ----------
-- Splits a single purchase (e.g. 200 pens from Vendor A) across the events
-- that actually used it, so per-event cost is real without re-entering data.
create table expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  quantity numeric,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

alter table expense_allocations enable row level security;

create policy "allocations_select_all_authenticated"
  on expense_allocations for select
  using (auth.uid() is not null);

create policy "allocations_insert_any_authenticated"
  on expense_allocations for insert
  with check (auth.uid() is not null);

create policy "allocations_update_admin_or_owner"
  on expense_allocations for update
  using (
    (select role from profiles where id = auth.uid()) in ('admin','master')
    or exists (select 1 from expenses e where e.id = expense_id and e.created_by = auth.uid())
  );

create policy "allocations_delete_admin_or_owner"
  on expense_allocations for delete
  using (
    (select role from profiles where id = auth.uid()) in ('admin','master')
    or exists (select 1 from expenses e where e.id = expense_id and e.created_by = auth.uid())
  );


-- ---------- INCOME ----------
create table income_entries (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid not null references fests(id) on delete cascade,
  event_id uuid references events(id),
  income_type text not null check (income_type in ('registration','sponsorship','other')),
  category_id uuid references categories(id),
  income_date date not null default current_date,
  registrations_count integer,
  amount numeric not null check (amount >= 0),
  source_name text,
  drive_link text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table income_entries enable row level security;

create policy "income_select_all_authenticated"
  on income_entries for select
  using (auth.uid() is not null);

create policy "income_insert_any_authenticated"
  on income_entries for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "income_update_own_or_admin"
  on income_entries for update
  using (created_by = auth.uid() or (select role from profiles where id = auth.uid()) in ('admin','master'));

create policy "income_delete_own_or_admin"
  on income_entries for delete
  using (created_by = auth.uid() or (select role from profiles where id = auth.uid()) in ('admin','master'));


-- ---------- Useful indexes ----------
create index on events (fest_id);
create index on expenses (fest_id);
create index on expenses (vendor_id);
create index on expense_allocations (expense_id);
create index on expense_allocations (event_id);
create index on income_entries (fest_id);
create index on income_entries (event_id);

-- ---------- Baseline table grants for every table above ----------
-- Same reasoning as the profiles grant near the top of this file: this
-- gives the `authenticated` role permission to touch each table at all.
-- The RLS policies already defined above still control exactly which
-- rows can be read/written and by whom — this does not bypass or weaken
-- any of them, it just unblocks the earlier permission gate.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.fests to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.expense_allocations to authenticated;
grant select, insert, update, delete on public.income_entries to authenticated;

-- =========================================================================
-- Seed the first Master account's PROFILE ROW manually after you create the
-- actual auth user (see SETUP.md step 4). This schema deliberately does not
-- auto-create a master — you control who that is.
-- =========================================================================
