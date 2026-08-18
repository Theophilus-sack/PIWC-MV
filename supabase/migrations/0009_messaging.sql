-- Phase 4: Messaging
-- SMS is modeled as a batch (one compose/send action, optionally scoped to
-- a ministry, optionally scheduled) fanning out to one row per recipient —
-- this is what lets the Logs view show "Youth Ministry — 42 recipients —
-- Sent" as a single line while still tracking each recipient's individual
-- delivery status. The actual send happens in the send-sms Edge Function
-- (supabase/functions/send-sms) via a mock/live provider switch; this
-- migration only owns the data + RLS, not the sending.
--
-- RLS follows the spec's Messages matrix row: Super Admin/Comms Media =
-- full, Ministry Leader = own ministry only, Secretary = "send" (can
-- compose/send general — i.e. ministry_id null — messages, matching how
-- Secretary's Attendance access is scoped to general/non-ministry
-- services in Phase 2), Pastor = view only, Finance = no access.

create table sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table sms_batches (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  template_id uuid references sms_templates(id) on delete set null,
  -- null = general/church-wide send (Secretary's allowed scope); set =
  -- scoped to one ministry (what a Ministry Leader is confined to).
  ministry_id uuid references ministries(id) on delete set null,
  recipient_count int not null,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'partially_failed', 'failed')),
  -- null = send immediately; set = held until that time by the caller
  -- (the Edge Function only sends batches that are due).
  scheduled_at timestamptz,
  sent_by uuid references auth.users(id),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_count > 0)
);

create table sms_messages (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references sms_batches(id) on delete cascade,
  recipient_member_id uuid references members(id) on delete set null,
  recipient_phone text not null,
  recipient_name text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'delivered')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index sms_messages_batch_id_idx on sms_messages(batch_id);

alter table sms_templates enable row level security;
alter table sms_batches enable row level security;
alter table sms_messages enable row level security;

-- Templates: anyone with any Messages access can read (needed to compose);
-- only the "full" roles manage the shared library. Pastor is view-only
-- overall so is deliberately excluded from write here too.
create policy sms_templates_select on sms_templates for select
  using (current_app_role() in ('super_admin', 'pastor', 'ministry_leader', 'comms_media', 'secretary'));
create policy sms_templates_write on sms_templates for all
  using (current_app_role() in ('super_admin', 'comms_media'))
  with check (current_app_role() in ('super_admin', 'comms_media'));

-- Batches: Super Admin/Comms Media see and send everything; Pastor reads
-- everything (view-only); Ministry Leader is confined to their own
-- ministry's batches; Secretary is confined to general (ministry_id is
-- null) batches — mirrors attendance_records' insert scoping in Phase 2.
create policy sms_batches_select on sms_batches for select
  using (
    current_app_role() in ('super_admin', 'pastor', 'comms_media')
    or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
    or (current_app_role() = 'secretary' and ministry_id is null)
  );
create policy sms_batches_insert on sms_batches for insert
  with check (
    current_app_role() in ('super_admin', 'comms_media')
    or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
    or (current_app_role() = 'secretary' and ministry_id is null)
  );
-- Update is needed for the Edge Function to record status/sent_at after
-- sending, and for the client to cancel a still-queued scheduled batch —
-- same scoping as insert, not opened any wider.
create policy sms_batches_update on sms_batches for update
  using (
    current_app_role() in ('super_admin', 'comms_media')
    or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
    or (current_app_role() = 'secretary' and ministry_id is null)
  );
create policy sms_batches_delete on sms_batches for delete
  using (
    current_app_role() in ('super_admin', 'comms_media')
    or (current_app_role() = 'ministry_leader' and ministry_id = current_ministry_id())
  );

-- Messages: visibility/write follows the parent batch's own rule rather
-- than duplicating ministry_id onto every recipient row.
create policy sms_messages_select on sms_messages for select
  using (exists (
    select 1 from sms_batches b where b.id = sms_messages.batch_id
    and (
      current_app_role() in ('super_admin', 'pastor', 'comms_media')
      or (current_app_role() = 'ministry_leader' and b.ministry_id = current_ministry_id())
      or (current_app_role() = 'secretary' and b.ministry_id is null)
    )
  ));
create policy sms_messages_insert on sms_messages for insert
  with check (exists (
    select 1 from sms_batches b where b.id = sms_messages.batch_id
    and (
      current_app_role() in ('super_admin', 'comms_media')
      or (current_app_role() = 'ministry_leader' and b.ministry_id = current_ministry_id())
      or (current_app_role() = 'secretary' and b.ministry_id is null)
    )
  ));
-- Update is Edge-Function-only in practice (recording per-recipient send
-- status) but scoped identically rather than granted unconditionally.
create policy sms_messages_update on sms_messages for update
  using (exists (
    select 1 from sms_batches b where b.id = sms_messages.batch_id
    and (
      current_app_role() in ('super_admin', 'comms_media')
      or (current_app_role() = 'ministry_leader' and b.ministry_id = current_ministry_id())
      or (current_app_role() = 'secretary' and b.ministry_id is null)
    )
  ));
