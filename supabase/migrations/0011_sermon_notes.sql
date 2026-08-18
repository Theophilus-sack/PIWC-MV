-- Phase 5: Sermon/Word Prep
-- Literal spec detail (flagged since the original build plan): the
-- permission matrix gives this row as `Super Admin: —, Pastor: Exclusive`
-- — Super Admin gets NO access here, not even read, unlike every other
-- module where Super Admin is a superset of everyone else. No carve-out
-- is added for Super Admin anywhere in this file; that's deliberate, not
-- an oversight.

create table sermon_notes (
  id uuid primary key default gen_random_uuid(),
  pastor_id uuid not null references auth.users(id),
  title text not null,
  scripture_ref text,
  sermon_date date not null default current_date,
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

alter table sermon_notes enable row level security;

create policy sermon_notes_select on sermon_notes for select
  using (current_app_role() = 'pastor' and pastor_id = auth.uid());
create policy sermon_notes_write on sermon_notes for all
  using (current_app_role() = 'pastor' and pastor_id = auth.uid())
  with check (current_app_role() = 'pastor' and pastor_id = auth.uid());
