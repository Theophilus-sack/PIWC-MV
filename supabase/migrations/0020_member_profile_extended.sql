-- Members module extension: real profile fields (nationality, marital
-- status, WhatsApp, education/work background) plus a server-generated,
-- globally-sequential member_id. Purely additive — every existing column
-- and row stays exactly as it is; no RLS changes (RLS is table-level,
-- not column-level, so members_select/insert/update/delete already
-- cover these new columns untouched).

alter table members add column member_id text unique;
alter table members add column nationality text default 'Ghana';
alter table members add column marital_status text
  check (marital_status in ('Single','Married','Divorced','Widowed','Engaged','Separated'));
alter table members add column whatsapp_number text;
alter table members add column educational_professional_background text;
alter table members add column educational_institution text;
alter table members add column workplace_name text;

-- Global sequence — member_id's numeric suffix is the member's overall
-- position across the table's entire history, NOT reset per join-year
-- (confirmed against real production IDs: 0021, 0059, 0199, 0208... all
-- for members who joined in 2026 — non-contiguous, i.e. interleaved with
-- members from other years). lpad grows past 4 digits once the sequence
-- exceeds 9999 rather than truncating or erroring.
create sequence member_id_seq;

create function set_member_id() returns trigger
language plpgsql as $$
begin
  if new.member_id is null then
    new.member_id := 'PIWC-' || extract(year from coalesce(new.date_joined, current_date))::text
      || '-' || lpad(nextval('member_id_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

-- Fires once per row even inside a multi-row insert (a single Add Member
-- and a bulk CSV import batch are the same statement shape from
-- Postgres's point of view), so nextval()'s own atomicity is what
-- guarantees no two members ever collide, including under concurrent
-- imports.
create trigger on_member_insert_set_id
  before insert on members
  for each row execute function set_member_id();

-- Immutable once set: silently keeps the old value rather than erroring,
-- so any UPDATE that doesn't mention member_id (every existing call site)
-- just passes through unaffected. Only lets a value be set from NULL
-- once, which is what the backfill below needs.
create function protect_member_id() returns trigger
language plpgsql as $$
begin
  if old.member_id is not null and new.member_id is distinct from old.member_id then
    new.member_id := old.member_id;
  end if;
  return new;
end;
$$;

create trigger on_member_update_protect_id
  before update on members
  for each row execute function protect_member_id();

-- Backfill existing rows (member_id starts NULL for them — the insert
-- trigger only fires on new rows) using the same sequence, ordered by
-- date_joined so earlier-joined members get lower numbers, consistent
-- with what the sequence represents going forward.
do $$
declare r record;
begin
  for r in select id, date_joined from members where member_id is null order by date_joined, created_at
  loop
    update members set member_id =
      'PIWC-' || extract(year from coalesce(r.date_joined, current_date))::text
      || '-' || lpad(nextval('member_id_seq')::text, 4, '0')
    where id = r.id;
  end loop;
end $$;
