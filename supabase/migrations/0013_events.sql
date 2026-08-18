-- Phase 6: Events
-- events, activities, other_activities carry a nullable ministry_id and
-- reuse the exact secretary/ministry_leader insert-scoping pattern
-- already established for attendance_records (0002) and sms_batches
-- (0009): secretary only when ministry_id is null, ministry_leader only
-- their own. minutes/convention_attendance have no ministry concept
-- (general church meeting minutes / churchwide convention data) —
-- ministry_leader is deliberately excluded from those two, not given a
-- no-op scope. Matches the events matrix row: Super Admin/Pastor/Comms
-- Media full, Ministry Leader own, Secretary log.

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  ministry_id uuid references ministries(id) on delete set null,
  venue text,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('National', 'District', 'Local', 'Area')),
  activity_date date not null,
  theme text,
  speaker_guest text,
  venue text,
  attendance int,
  ministry_id uuid references ministries(id) on delete set null,
  created_at timestamptz not null default now()
);

create table minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null,
  content text not null default '',
  created_at timestamptz not null default now()
);

create table convention_attendance (
  id uuid primary key default gen_random_uuid(),
  convention text not null check (convention in ('Easter', 'Christmas')),
  year int not null,
  session text,
  attendance int,
  created_at timestamptz not null default now()
);

create table other_activities (
  id uuid primary key default gen_random_uuid(),
  activity_date date not null,
  activity text not null,
  attendance int,
  venue text,
  comments text,
  ministry_id uuid references ministries(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table events enable row level security;
alter table activities enable row level security;
alter table minutes enable row level security;
alter table convention_attendance enable row level security;
alter table other_activities enable row level security;

-- events / activities / other_activities: identical ministry-scoping shape.
create policy events_select on events for select using (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy events_insert on events for insert with check (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy events_update on events for update using (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy events_delete on events for delete using (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);

create policy activities_select on activities for select using (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy activities_insert on activities for insert with check (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy activities_update on activities for update using (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy activities_delete on activities for delete using (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);

create policy other_activities_select on other_activities for select using (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy other_activities_insert on other_activities for insert with check (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy other_activities_update on other_activities for update using (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'secretary' and ministry_id is null)
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);
create policy other_activities_delete on other_activities for delete using (
  current_app_role() in ('super_admin', 'pastor', 'comms_media')
  or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
);

-- minutes / convention_attendance: no ministry concept — Ministry Leader
-- excluded entirely (deliberately, not a no-op scope); Secretary's
-- "log" access applies since these are inherently general/church-wide.
create policy minutes_select on minutes for select
  using (current_app_role() in ('super_admin', 'pastor', 'comms_media', 'secretary'));
create policy minutes_write on minutes for all
  using (current_app_role() in ('super_admin', 'pastor', 'comms_media', 'secretary'))
  with check (current_app_role() in ('super_admin', 'pastor', 'comms_media', 'secretary'));

create policy convention_attendance_select on convention_attendance for select
  using (current_app_role() in ('super_admin', 'pastor', 'comms_media', 'secretary'));
create policy convention_attendance_write on convention_attendance for all
  using (current_app_role() in ('super_admin', 'pastor', 'comms_media', 'secretary'))
  with check (current_app_role() in ('super_admin', 'pastor', 'comms_media', 'secretary'));
