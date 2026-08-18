-- Phase 6: Inventory
-- Placeholder shape (item/quantity/location/condition/notes) — no field
-- list was given for the workbook's actual Inventory tab, same
-- "reasonable placeholder now" precedent as tithe_and_mo (0007). Matches
-- the inventory matrix row exactly: Super Admin/Secretary full, Pastor
-- view-only, everyone else (Finance/Ministry Leader/Comms Media) nothing.

create table inventory (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  quantity int not null default 0,
  location text,
  condition text check (condition in ('New', 'Good', 'Fair', 'Poor', 'Needs Repair')),
  notes text,
  created_at timestamptz not null default now()
);

alter table inventory enable row level security;

create policy inventory_select on inventory for select
  using (current_app_role() in ('super_admin', 'secretary', 'pastor'));
create policy inventory_write on inventory for all
  using (current_app_role() in ('super_admin', 'secretary'))
  with check (current_app_role() in ('super_admin', 'secretary'));
