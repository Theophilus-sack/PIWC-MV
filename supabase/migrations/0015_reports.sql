-- Phase 6: Reports
-- Reports is mostly a dashboard over data that already exists (members,
-- attendance, finance — each already gated by its own table's RLS, so a
-- Finance/Ministry Leader/Comms Media user querying those is already
-- correctly scoped without Reports needing its own per-role filtering).
-- comparative_stats is the one genuinely new table — a placeholder
-- (current-vs-prior-period figures) until the real workbook columns are
-- shared, same precedent as tithe_and_mo/inventory.
--
-- Every role in the reports matrix row has *some* non-null access
-- (Super Admin/Pastor: full, Finance/Ministry Leader/Comms Media: own,
-- Secretary: log) — so select is simply "any authenticated user" rather
-- than an enumerated role list, matching ministries_select's precedent
-- for low-sensitivity summary data. Write stays restricted to Super
-- Admin/Pastor, mirroring Finance's write-restriction pattern.

create table comparative_stats (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  period text not null,
  prior_value numeric(14, 2),
  current_value numeric(14, 2),
  created_at timestamptz not null default now()
);

alter table comparative_stats enable row level security;

create policy comparative_stats_select on comparative_stats for select
  using (auth.uid() is not null);
create policy comparative_stats_write on comparative_stats for all
  using (current_app_role() in ('super_admin', 'pastor'))
  with check (current_app_role() in ('super_admin', 'pastor'));
