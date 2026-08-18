-- Phase 6: Ministry activity log
-- Extends Groups/Ministries (not a new nav module) — a per-ministry
-- activity log, inherently ministry-scoped like ministry_members (0002),
-- whose exact RLS shape this mirrors: matches the groups matrix row
-- (Super Admin: full, Pastor/Secretary: view, Ministry Leader: own,
-- Comms Media: none — Comms Media has no Groups access at all per the
-- matrix, not "view", so it's excluded entirely below, same as Finance).

create table ministry_activities (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id) on delete cascade,
  activity_date date not null,
  activity text not null,
  speaker_facilitator text,
  attendance int,
  offering_ghs numeric(12, 2),
  pastor_visited boolean not null default false,
  comment text,
  souls_won int not null default 0,
  holy_spirit_baptisms int not null default 0,
  created_at timestamptz not null default now()
);

alter table ministry_activities enable row level security;

create policy ministry_activities_select on ministry_activities for select using (
  current_app_role() in ('super_admin', 'pastor', 'secretary')
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy ministry_activities_write on ministry_activities for all using (
  current_app_role() = 'super_admin'
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
) with check (
  current_app_role() = 'super_admin'
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
