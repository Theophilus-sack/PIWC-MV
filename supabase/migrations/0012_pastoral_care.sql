-- Phase 6: Pastoral Care
-- life_events (Naming/Wedding/Engagement/Funeral), member_support
-- (benevolence/visitation support), and the three Evangelism sub-tabs
-- (souls_won/water_baptisms/holy_spirit_baptisms) — all pastorally-
-- sensitive people-care tracking, matching the pastoral_care matrix row
-- exactly: Super Admin/Pastor full, Secretary view-only, everyone else
-- (Finance/Ministry Leader/Comms Media) nothing.

create table life_events (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Naming', 'Wedding', 'Engagement', 'Funeral')),
  event_date date not null,
  names text not null,
  related_member_id uuid references members(id) on delete set null,
  venue text,
  attendance int,
  created_at timestamptz not null default now()
);

create table member_support (
  id uuid primary key default gen_random_uuid(),
  support_type text not null,
  member_id uuid references members(id) on delete set null,
  amount_ghs numeric(12, 2) not null default 0,
  support_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table souls_won (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  event_date date not null default current_date,
  brought_by text,
  notes text,
  created_at timestamptz not null default now()
);

create table water_baptisms (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete set null,
  name text not null,
  baptism_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table holy_spirit_baptisms (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete set null,
  name text not null,
  baptism_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table life_events enable row level security;
alter table member_support enable row level security;
alter table souls_won enable row level security;
alter table water_baptisms enable row level security;
alter table holy_spirit_baptisms enable row level security;

-- Same shape, five times: Super Admin/Pastor full, Secretary select-only,
-- everyone else nothing.
create policy life_events_select on life_events for select
  using (current_app_role() in ('super_admin', 'pastor', 'secretary'));
create policy life_events_write on life_events for all
  using (current_app_role() in ('super_admin', 'pastor'))
  with check (current_app_role() in ('super_admin', 'pastor'));

create policy member_support_select on member_support for select
  using (current_app_role() in ('super_admin', 'pastor', 'secretary'));
create policy member_support_write on member_support for all
  using (current_app_role() in ('super_admin', 'pastor'))
  with check (current_app_role() in ('super_admin', 'pastor'));

create policy souls_won_select on souls_won for select
  using (current_app_role() in ('super_admin', 'pastor', 'secretary'));
create policy souls_won_write on souls_won for all
  using (current_app_role() in ('super_admin', 'pastor'))
  with check (current_app_role() in ('super_admin', 'pastor'));

create policy water_baptisms_select on water_baptisms for select
  using (current_app_role() in ('super_admin', 'pastor', 'secretary'));
create policy water_baptisms_write on water_baptisms for all
  using (current_app_role() in ('super_admin', 'pastor'))
  with check (current_app_role() in ('super_admin', 'pastor'));

create policy holy_spirit_baptisms_select on holy_spirit_baptisms for select
  using (current_app_role() in ('super_admin', 'pastor', 'secretary'));
create policy holy_spirit_baptisms_write on holy_spirit_baptisms for all
  using (current_app_role() in ('super_admin', 'pastor'))
  with check (current_app_role() in ('super_admin', 'pastor'));
