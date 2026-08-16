-- Phase 2: Core data
-- members, presbyters, ministry_leadership, ministry_members, service_dates
-- + attendance_records, plus a tightened Phase 1 ministries policy.
--
-- Entity -> module mapping (matters for which RLS policy applies where):
--   members, attendance                -> Members / Attendance modules
--   presbyters, ministry_leadership    -> Leadership directory module
--   ministries, ministry_members       -> Groups/Ministries module
-- These two pairs look similar but have different permissions per the
-- spec's matrix (e.g. Ministry Leader: view-only on ministry_leadership,
-- but "manage own" on ministry_members) — don't merge them.

-- ============== FIX: Phase 1 ministries policy was too loose ==============
-- Phase 1 gave Pastor write access to ministries "for all", but the actual
-- Groups/Ministries matrix row is Pastor: View all, not Full. Correcting
-- here rather than silently leaving it — Super Admin only for now.
drop policy if exists ministries_write on ministries;
create policy ministries_write on ministries for all
  using (current_app_role() = 'super_admin')
  with check (current_app_role() = 'super_admin');

-- ============== MEMBERS ==============

create table members (
  id uuid primary key default gen_random_uuid(),
  date_joined date not null default current_date,
  name text not null,
  gender text check (gender in ('Male', 'Female')),
  residence text,
  contact text,
  preferred_assembly text check (preferred_assembly in ('English', 'Twi')),
  status text check (status in ('first-timer', 'stay', 'visit')) default 'stay',
  created_at timestamptz not null default now()
);

alter table members enable row level security;

create policy members_select on members for select using (
  current_app_role() in ('super_admin', 'pastor', 'secretary')
  or (
    current_app_role() = 'ministry_leader'
    and exists (
      select 1 from ministry_members mm
      where mm.member_id = members.id and mm.ministry_id = current_ministry_id()
    )
  )
);
-- Spec: "Secretary | Full (add/edit)" — deliberately excludes delete.
create policy members_insert on members for insert with check (
  current_app_role() in ('super_admin', 'secretary')
);
create policy members_update on members for update using (
  current_app_role() in ('super_admin', 'secretary')
);
create policy members_delete on members for delete using (
  current_app_role() = 'super_admin'
);

-- Spec calls out member deletions specifically as a sensitive action to
-- audit — same log_audit_event() helper from Phase 1's audit_logs.
create function audit_member_delete() returns trigger
language plpgsql security definer as $$
begin
  perform log_audit_event('member_delete', 'members', old.id::text, to_jsonb(old), null);
  return old;
end;
$$;

create trigger on_member_delete
  before delete on members
  for each row execute function audit_member_delete();

-- ============== LEADERSHIP DIRECTORY ==============
-- presbyters + ministry_leadership. Super Admin/Pastor/Secretary: full.
-- Ministry Leader/Comms: view only.

create table presbyters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  created_at timestamptz not null default now()
);

create table ministry_leadership (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id) on delete cascade,
  leader_name text not null,
  portfolio text,
  contact text,
  created_at timestamptz not null default now()
);

alter table presbyters enable row level security;
alter table ministry_leadership enable row level security;

create policy presbyters_select on presbyters for select using (auth.uid() is not null);
create policy presbyters_write on presbyters for all
  using (current_app_role() in ('super_admin', 'pastor', 'secretary'))
  with check (current_app_role() in ('super_admin', 'pastor', 'secretary'));

create policy ministry_leadership_select on ministry_leadership for select using (auth.uid() is not null);
create policy ministry_leadership_write on ministry_leadership for all
  using (current_app_role() in ('super_admin', 'pastor', 'secretary'))
  with check (current_app_role() in ('super_admin', 'pastor', 'secretary'));

-- ============== GROUPS/MINISTRIES ==============
-- Who belongs to which ministry. Super Admin: full. Ministry Leader:
-- manage own roster only. Pastor/Secretary: view. Finance/Comms: none.

create table ministry_members (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  ministry_id uuid not null references ministries(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (member_id, ministry_id)
);

alter table ministry_members enable row level security;

create policy ministry_members_select on ministry_members for select using (
  current_app_role() in ('super_admin', 'pastor', 'secretary')
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy ministry_members_write on ministry_members for all using (
  current_app_role() = 'super_admin'
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
) with check (
  current_app_role() = 'super_admin'
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);

-- ============== ATTENDANCE ==============
-- service_dates.ministry_id is null for a general/Sunday service, set for
-- a ministry-specific gathering. That's what lets one table serve both
-- "Secretary logs Sunday service" and "Ministry Leader logs own ministry"
-- from the spec's matrix.

create table service_dates (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  name text not null,
  ministry_id uuid references ministries(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  service_date_id uuid not null references service_dates(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  present boolean not null default true,
  created_at timestamptz not null default now(),
  unique (service_date_id, member_id)
);

alter table service_dates enable row level security;
alter table attendance_records enable row level security;

create policy service_dates_select on service_dates for select using (
  current_app_role() in ('super_admin', 'pastor')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy service_dates_insert on service_dates for insert with check (
  current_app_role() = 'super_admin'
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy service_dates_update on service_dates for update using (
  current_app_role() = 'super_admin'
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy service_dates_delete on service_dates for delete using (
  current_app_role() = 'super_admin'
);

create policy attendance_records_select on attendance_records for select using (
  current_app_role() in ('super_admin', 'pastor')
  or exists (
    select 1 from service_dates sd where sd.id = attendance_records.service_date_id
    and (
      (current_app_role() = 'secretary' and sd.ministry_id is null)
      or (current_app_role() = 'ministry_leader' and sd.ministry_id = current_ministry_id())
    )
  )
);
create policy attendance_records_insert on attendance_records for insert with check (
  current_app_role() = 'super_admin'
  or exists (
    select 1 from service_dates sd where sd.id = attendance_records.service_date_id
    and (
      (current_app_role() = 'secretary' and sd.ministry_id is null)
      or (current_app_role() = 'ministry_leader' and sd.ministry_id = current_ministry_id())
    )
  )
);
create policy attendance_records_update on attendance_records for update using (
  current_app_role() = 'super_admin'
  or exists (
    select 1 from service_dates sd where sd.id = attendance_records.service_date_id
    and (
      (current_app_role() = 'secretary' and sd.ministry_id is null)
      or (current_app_role() = 'ministry_leader' and sd.ministry_id = current_ministry_id())
    )
  )
);
create policy attendance_records_delete on attendance_records for delete using (
  current_app_role() = 'super_admin'
);

-- Workbook-shaped rollup: attendance by category (member status) per
-- service, derived from the per-member records above rather than
-- duplicating a separate aggregate table. Views run with the querying
-- user's own permissions against the underlying tables, so this respects
-- attendance_records/service_dates RLS automatically — no separate policy
-- needed here.
create view attendance_category_summary as
select
  sd.id as service_date_id, sd.service_date, sd.name, sd.ministry_id,
  m.status,
  count(*) filter (where ar.present) as present_count,
  count(*) as marked_count
from attendance_records ar
join service_dates sd on sd.id = ar.service_date_id
join members m on m.id = ar.member_id
group by sd.id, sd.service_date, sd.name, sd.ministry_id, m.status;
