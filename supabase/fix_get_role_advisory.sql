-- Run this ONCE in Supabase SQL Editor.
-- Removes the public.get_role() function (flagged by Supabase's security
-- advisor as callable directly via the API) and replaces every policy that
-- used it with an equivalent inline subquery — same logic, but nothing
-- externally callable is left behind.

alter policy "profiles_select_own_or_master" on profiles
  using (id = auth.uid() or (select role from profiles where id = auth.uid()) in ('master','admin'));

alter policy "profiles_master_insert" on profiles
  with check ((select role from profiles where id = auth.uid()) = 'master' or auth.uid() = id);

alter policy "profiles_master_update" on profiles
  using ((select role from profiles where id = auth.uid()) = 'master');

alter policy "profiles_master_delete" on profiles
  using ((select role from profiles where id = auth.uid()) = 'master');

alter policy "fests_admin_write" on fests
  with check ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "fests_admin_update" on fests
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "fests_master_delete" on fests
  using ((select role from profiles where id = auth.uid()) = 'master');

alter policy "events_admin_write" on events
  with check ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "events_admin_update" on events
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "events_admin_delete" on events
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "vendors_admin_write" on vendors
  with check ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "vendors_admin_update" on vendors
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "vendors_admin_delete" on vendors
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "categories_admin_write" on categories
  with check ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "categories_admin_delete" on categories
  using ((select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "expenses_update_own_or_admin" on expenses
  using (created_by = auth.uid() or (select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "expenses_delete_own_or_admin" on expenses
  using (created_by = auth.uid() or (select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "allocations_update_admin_or_owner" on expense_allocations
  using (
    (select role from profiles where id = auth.uid()) in ('admin','master')
    or exists (select 1 from expenses e where e.id = expense_id and e.created_by = auth.uid())
  );

alter policy "allocations_delete_admin_or_owner" on expense_allocations
  using (
    (select role from profiles where id = auth.uid()) in ('admin','master')
    or exists (select 1 from expenses e where e.id = expense_id and e.created_by = auth.uid())
  );

alter policy "income_update_own_or_admin" on income_entries
  using (created_by = auth.uid() or (select role from profiles where id = auth.uid()) in ('admin','master'));

alter policy "income_delete_own_or_admin" on income_entries
  using (created_by = auth.uid() or (select role from profiles where id = auth.uid()) in ('admin','master'));

-- Now safe to drop — no policy references it anymore.
drop function public.get_role();
