-- Phase 1: Foundation
-- Roles, profiles, RLS helper functions, ministries (minimal — full
-- ministry_leadership/ministry_members land in Phase 2), and an
-- append-only audit log with a working example trigger (role changes).
--
-- Run via `supabase db push` (or paste into the SQL editor) against a
-- fresh Supabase project. Idempotency isn't attempted — this is meant to
-- run once against an empty database.

create extension if not exists pgcrypto; -- gen_random_uuid()

create type app_role as enum
  ('super_admin', 'pastor', 'finance', 'ministry_leader', 'comms_media', 'secretary');

-- ============== MINISTRIES (minimal, expanded in Phase 2) ==============

create table ministries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ============== PROFILES ==============
-- One row per auth.users row. role is nullable — a freshly created account
-- has NO access anywhere until a Super Admin or Pastor assigns a role
-- (spec: "Only Super Admin and Pastor can create/assign roles").

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role app_role,
  ministry_id uuid references ministries(id), -- set when role = ministry_leader
  phone text,
  created_at timestamptz not null default now()
);

-- Auto-create a profiles row on signup so the app never has to handle a
-- missing profile for an authenticated user; role stays null until assigned.
create function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============== RLS HELPERS ==============
-- security definer + owned by the migration role (table owner) so these
-- reads bypass RLS internally — without this, current_app_role() querying
-- profiles would itself be subject to the profiles RLS policies below,
-- which reference current_app_role(), which would recurse.
--
-- Named current_app_role (not current_role) because CURRENT_ROLE is a
-- reserved SQL keyword (like CURRENT_USER) — `create function current_role()`
-- is a syntax error, the parser reads it as the keyword, not an identifier.

create function current_app_role() returns app_role
language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

create function current_ministry_id() returns uuid
language sql stable security definer as $$
  select ministry_id from profiles where id = auth.uid()
$$;

-- Generic audit-log writer, reused by trigger functions across phases.
-- security definer so it can insert into audit_logs even though no role
-- is ever granted an insert policy on that table (see below).
create function log_audit_event(
  p_action text, p_target_table text, p_target_id text,
  p_before jsonb, p_after jsonb
) returns void
language plpgsql security definer as $$
begin
  insert into audit_logs (actor_id, action, target_table, target_id, before, after)
  values (auth.uid(), p_action, p_target_table, p_target_id, p_before, p_after);
end;
$$;

-- ============== AUDIT LOGS ==============
-- Append-only by construction: no insert/update/delete policy exists for
-- ANY role, including super_admin. Writes only happen through
-- log_audit_event()'s security-definer insert, which bypasses RLS.

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_table text not null,
  target_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- Phase 1 example: audit every role change on profiles.
create function audit_profile_role_change() returns trigger
language plpgsql security definer as $$
begin
  if new.role is distinct from old.role then
    perform log_audit_event(
      'role_change', 'profiles', new.id::text,
      jsonb_build_object('role', old.role), jsonb_build_object('role', new.role)
    );
  end if;
  return new;
end;
$$;

create trigger on_profile_role_change
  after update on profiles
  for each row execute function audit_profile_role_change();

-- ============== ROW LEVEL SECURITY ==============

alter table ministries enable row level security;
alter table profiles enable row level security;
alter table audit_logs enable row level security;

-- Ministries: any authenticated user can read (needed for nav/filters);
-- only Super Admin/Pastor manage the list itself.
create policy ministries_select on ministries for select
  using (auth.uid() is not null);
create policy ministries_write on ministries for all
  using (current_app_role() in ('super_admin', 'pastor'))
  with check (current_app_role() in ('super_admin', 'pastor'));

-- Profiles: everyone can read their own row (the app needs this to know
-- its own role); Super Admin/Pastor can read and manage everyone's.
create policy profiles_select_self on profiles for select
  using (id = auth.uid());
create policy profiles_select_admins on profiles for select
  using (current_app_role() in ('super_admin', 'pastor'));
create policy profiles_update_admins on profiles for update
  using (current_app_role() in ('super_admin', 'pastor'));
create policy profiles_insert_admins on profiles for insert
  with check (current_app_role() in ('super_admin', 'pastor'));

-- Audit logs: read-only, Pastor/Super Admin only. No write policies at
-- all — see log_audit_event() above.
create policy audit_logs_select on audit_logs for select
  using (current_app_role() in ('super_admin', 'pastor'));

-- ============== SEED (fake/dev only — see supabase/seed.sql) ==============
-- Real member/ministry data is never seeded here. supabase/seed.sql (added
-- once Phase 2 tables exist) will hold clearly-fake demo rows only.
