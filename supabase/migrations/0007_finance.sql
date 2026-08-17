-- Phase 3: Finance
-- net_tithes_performance / missions_offering_performance modeled literally
-- off the workbook's monthly budget-vs-actual columns (one row per
-- year+month), designated_funds + a weekly breakdown child table, and a
-- placeholder tithe_and_mo ("district accounts sheet" — no field list was
-- given yet, kept minimal until the real workbook columns are shared).
--
-- RLS throughout: Super Admin + Finance = full, Pastor = view only,
-- everyone else = no access. Matches the spec's Finance matrix row
-- exactly — Secretary/Ministry Leader/Comms Media get nothing here.

create table net_tithes_performance (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),
  budget_ghs numeric(12, 2) not null default 0,
  actual_ghs numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (year, month)
);

create table missions_offering_performance (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),
  budget_ghs numeric(12, 2) not null default 0,
  actual_ghs numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (year, month)
);

create table designated_funds (
  id uuid primary key default gen_random_uuid(),
  district text,
  fund_name text not null,
  actual_prior_year_ghs numeric(12, 2) not null default 0,
  budget_current_year_ghs numeric(12, 2) not null default 0,
  actual_current_year_ghs numeric(12, 2) not null default 0,
  variance_amount_ghs numeric(12, 2)
    generated always as (actual_current_year_ghs - budget_current_year_ghs) stored,
  variance_percent numeric(6, 2)
    generated always as (
      case when budget_current_year_ghs = 0 then null
      else round(100.0 * (actual_current_year_ghs - budget_current_year_ghs) / budget_current_year_ghs, 2) end
    ) stored,
  created_at timestamptz not null default now()
);

create table designated_fund_weekly (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references designated_funds(id) on delete cascade,
  week_date date not null,
  amount_ghs numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- Placeholder — "district accounts sheet" had no field list in the spec.
-- Minimal shape now, will need real columns once the workbook tab itself
-- (or a sample export) is shared.
create table tithe_and_mo (
  id uuid primary key default gen_random_uuid(),
  district text,
  entry_date date not null default current_date,
  amount_ghs numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table net_tithes_performance enable row level security;
alter table missions_offering_performance enable row level security;
alter table designated_funds enable row level security;
alter table designated_fund_weekly enable row level security;
alter table tithe_and_mo enable row level security;

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

create policy designated_funds_select on designated_funds for select
  using (current_app_role() in ('super_admin', 'pastor', 'finance'));
create policy designated_funds_write on designated_funds for all
  using (current_app_role() in ('super_admin', 'finance'))
  with check (current_app_role() in ('super_admin', 'finance'));

create policy designated_fund_weekly_select on designated_fund_weekly for select
  using (current_app_role() in ('super_admin', 'pastor', 'finance'));
create policy designated_fund_weekly_write on designated_fund_weekly for all
  using (current_app_role() in ('super_admin', 'finance'))
  with check (current_app_role() in ('super_admin', 'finance'));

create policy tithe_and_mo_select on tithe_and_mo for select
  using (current_app_role() in ('super_admin', 'pastor', 'finance'));
create policy tithe_and_mo_write on tithe_and_mo for all
  using (current_app_role() in ('super_admin', 'finance'))
  with check (current_app_role() in ('super_admin', 'finance'));
