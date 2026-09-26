-- members.marital_status: allow Child and Toddler alongside the original
-- six adult-relationship values, so an under-13 dependent (or a toddler)
-- can be recorded with an accurate status instead of forcing "Single"
-- onto someone the term doesn't meaningfully apply to.
--
-- The original constraint (0020_member_profile_extended.sql) was created
-- inline via `add column marital_status text check (...)`, so Postgres
-- assigned its name automatically rather than it being explicitly named.
-- Found here via pg_constraint instead of assumed, so this can't
-- silently target the wrong constraint (or no-op) if the generated name
-- isn't what's expected. No existing row is affected — every value the
-- old constraint already allowed is still allowed by the new one; this
-- only widens the allowed set, no data is read, deleted, or rewritten.

do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'members'
    and con.contype = 'c'
    and att.attname = 'marital_status';

  if existing_constraint is not null then
    execute format('alter table members drop constraint %I', existing_constraint);
  end if;
end $$;

alter table members add constraint members_marital_status_check
  check (marital_status in ('Single', 'Married', 'Divorced', 'Widowed', 'Engaged', 'Separated', 'Child', 'Toddler'));
