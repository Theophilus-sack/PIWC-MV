-- Phase 4b: Messaging extension — Manual Contacts, Automation definitions,
-- template categories, and personalization support. Extends 0009's
-- sms_templates/sms_batches/sms_messages rather than duplicating them;
-- "messages"/"message_recipients" from the reference spec are exactly
-- those two tables, just already named sms_batches/sms_messages.

-- ============== MANUAL CONTACTS ==============
-- Deliberately separate from `members` — these are external/custom
-- recipients (visitors' relatives, community contacts, vendors) who
-- aren't part of the church membership directory.

create table manual_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null, -- stored normalized (233XXXXXXXXX) — enforced client-side via normalizeGhanaPhone before insert
  email text,
  group_label text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Catches exact duplicate phone numbers at entry time. Cross-source
-- (member vs. manual-contact) dedup happens at send time in the
-- recipient-merge step client-side, not here — a member and a manual
-- contact are different rows/tables by design, and a member's number
-- changing shouldn't retroactively conflict with an unrelated contact.
create unique index manual_contacts_phone_idx on manual_contacts(phone);

alter table manual_contacts enable row level security;

create policy manual_contacts_select on manual_contacts for select
  using (current_app_role() in ('super_admin', 'pastor', 'ministry_leader', 'comms_media', 'secretary'));
create policy manual_contacts_write on manual_contacts for all
  using (current_app_role() in ('super_admin', 'comms_media'))
  with check (current_app_role() in ('super_admin', 'comms_media'));

create function audit_manual_contact_change() returns trigger
language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    perform log_audit_event('manual_contact_create', 'manual_contacts', new.id::text, null, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    perform log_audit_event('manual_contact_update', 'manual_contacts', new.id::text, to_jsonb(old), to_jsonb(new));
  elsif tg_op = 'DELETE' then
    perform log_audit_event('manual_contact_delete', 'manual_contacts', old.id::text, to_jsonb(old), null);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_manual_contact_change
  after insert or update or delete on manual_contacts
  for each row execute function audit_manual_contact_change();

-- ============== MESSAGE AUTOMATIONS ==============
-- Persisted, manageable definitions only — nothing dispatches these yet.
-- Actually firing on a schedule/trigger needs a pg_cron job (or similar)
-- evaluating trigger_config and inserting sms_batches rows; that
-- dispatcher is a separate, later piece. The UI built on this table is
-- fully real (create/edit/pause/resume/delete persist normally); it's
-- the automatic firing that isn't wired up.

create table message_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null check (trigger_type in
    ('birthday', 'welcome', 'event_reminder', 'follow_up')),
  trigger_config jsonb not null default '{}', -- e.g. {"days_before": 2} for event_reminder
  template_id uuid references sms_templates(id) on delete set null,
  ministry_id uuid references ministries(id) on delete set null, -- null = general
  status text not null default 'paused' check (status in ('active', 'paused')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table message_automations enable row level security;

-- Select is open to every Messages-access role (Pastor's view-only access
-- can still see what's configured); write matches manual_contacts.
create policy message_automations_select on message_automations for select
  using (current_app_role() in ('super_admin', 'pastor', 'ministry_leader', 'comms_media', 'secretary'));
create policy message_automations_write on message_automations for all
  using (current_app_role() in ('super_admin', 'comms_media'))
  with check (current_app_role() in ('super_admin', 'comms_media'));

create function audit_automation_change() returns trigger
language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    perform log_audit_event('automation_create', 'message_automations', new.id::text, null, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    perform log_audit_event('automation_update', 'message_automations', new.id::text, to_jsonb(old), to_jsonb(new));
  elsif tg_op = 'DELETE' then
    perform log_audit_event('automation_delete', 'message_automations', old.id::text, to_jsonb(old), null);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_automation_change
  after insert or update or delete on message_automations
  for each row execute function audit_automation_change();

-- 0009's sms_batches_delete never included Secretary, which was fine when
-- nothing in the UI exercised delete — now the Scheduled tab's Cancel
-- action needs a Secretary to be able to cancel a still-queued general
-- batch they created, matching the scoping already granted for
-- select/insert (ministry_id is null) rather than leaving delete as a
-- silent RLS no-op for the one role most likely to use it.
drop policy sms_batches_delete on sms_batches;
create policy sms_batches_delete on sms_batches for delete
  using (
    current_app_role() in ('super_admin', 'comms_media')
    or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
    or (current_app_role() = 'secretary' and ministry_id is null)
  );

-- ============== EXTEND EXISTING MESSAGING TABLES ==============

alter table sms_templates add column category text check (category in (
  'sunday_service', 'prayer_meeting', 'youth', 'general_announcement',
  'birthday', 'wedding', 'funeral', 'emergency', 'giving', 'follow_up'
));
alter table sms_templates add column description text;

-- Personalization: when set, the Edge Function sends this per-recipient
-- text instead of the batch's shared body. Nullable so the existing
-- shared-body bulk-send path (the common, non-personalized case) is
-- completely unaffected.
alter table sms_messages add column resolved_body text;

-- Informational only (Logs UI) — doesn't affect RLS scoping, which stays
-- keyed off ministry_id exactly as in 0009.
alter table sms_batches add column recipient_source text
  check (recipient_source in ('members', 'manual', 'mixed'));

-- Sensitive/notable action per the spec's audit requirements — logs every
-- send/schedule and every cancellation (delete of a still-queued batch).
create function audit_sms_batch_change() returns trigger
language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    perform log_audit_event(
      case when new.scheduled_at is not null then 'sms_schedule' else 'sms_send' end,
      'sms_batches', new.id::text, null,
      jsonb_build_object('ministry_id', new.ministry_id, 'recipient_count', new.recipient_count, 'scheduled_at', new.scheduled_at)
    );
  elsif tg_op = 'DELETE' then
    perform log_audit_event('sms_batch_cancel', 'sms_batches', old.id::text, to_jsonb(old), null);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_sms_batch_change
  after insert or delete on sms_batches
  for each row execute function audit_sms_batch_change();

create function audit_sms_template_change() returns trigger
language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    perform log_audit_event('template_create', 'sms_templates', new.id::text, null, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    perform log_audit_event('template_update', 'sms_templates', new.id::text, to_jsonb(old), to_jsonb(new));
  elsif tg_op = 'DELETE' then
    perform log_audit_event('template_delete', 'sms_templates', old.id::text, to_jsonb(old), null);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger on_sms_template_change
  after insert or update or delete on sms_templates
  for each row execute function audit_sms_template_change();
