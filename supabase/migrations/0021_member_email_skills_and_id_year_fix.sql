-- Two more member profile fields, plus a correction to member_id's year
-- source. 0020 already ran live (its sequence is what the members
-- mock-data cleanup script reset), so this is a new additive migration
-- rather than an edit to 0020 — that file stays an accurate record of
-- what was actually applied.
--
-- The id's year was reading date_joined, but date_joined ("Year of
-- Joining") is an independent historical fact that can be any past year
-- — it should have no bearing on when the *record itself* was created in
-- this system. Switches to created_at, which is exactly that and is
-- already populated (via its own column default) by the time this
-- BEFORE INSERT trigger reads it. The members table is currently empty
-- (mock data was just cleared), so there are no existing member_id
-- values computed under the old rule to reconcile — nothing to backfill.

alter table members add column email text;
alter table members add column skills_talents text;

create or replace function set_member_id() returns trigger
language plpgsql as $$
begin
  if new.member_id is null then
    new.member_id := 'PIWC-' || extract(year from new.created_at)::text
      || '-' || lpad(nextval('member_id_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;
