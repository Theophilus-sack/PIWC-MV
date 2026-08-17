-- Phase 3 follow-up: tithes and missions offering are tracked per service
-- (English/Twi), not as one combined church-wide figure — the church
-- reports these separately per assembly ("Local"), same as ministries and
-- presbyters already are.
--
-- Dropping and recreating rather than migrating in place: the existing
-- rows are fake seed data with no assembly dimension to backfill from
-- (there's no correct way to split a combined fake number into two real
-- halves). Re-run supabase/seed.sql afterward to repopulate — it seeds
-- both assemblies now.

drop table net_tithes_performance;
drop table missions_offering_performance;

create table net_tithes_performance (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),
  assembly text not null check (assembly in ('English', 'Twi')),
  budget_ghs numeric(12, 2) not null default 0,
  actual_ghs numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (year, month, assembly)
);

create table missions_offering_performance (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),
  assembly text not null check (assembly in ('English', 'Twi')),
  budget_ghs numeric(12, 2) not null default 0,
  actual_ghs numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (year, month, assembly)
);

alter table net_tithes_performance enable row level security;
alter table missions_offering_performance enable row level security;

create policy net_tithes_performance_select on net_tithes_performance for select
  using (current_app_role() in ('super_admin', 'pastor', 'finance'));
create policy net_tithes_performance_write on net_tithes_performance for all
  using (current_app_role() in ('super_admin', 'finance'))
  with check (current_app_role() in ('super_admin', 'finance'));

create policy missions_offering_performance_select on missions_offering_performance for select
  using (current_app_role() in ('super_admin', 'pastor', 'finance'));
create policy missions_offering_performance_write on missions_offering_performance for all
  using (current_app_role() in ('super_admin', 'finance'))
  with check (current_app_role() in ('super_admin', 'finance'));
