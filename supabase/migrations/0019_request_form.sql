-- "District Account" is being renamed to "Request Form" in the UI, with
-- a fuller set of fields. tithe_and_mo was always an explicit placeholder
-- (see 0007_finance.sql's own comment — "no field list was given yet")
-- with no confirmed real usage yet, so it's extended in place rather than
-- replaced. Purely additive: existing rows, and the existing
-- entry_date/amount_ghs/notes/district columns, are untouched.
--
-- entry_date, amount_ghs, and notes are reused as-is for "Request Date",
-- "Amount", and "Notes" — they already have the right shape, no need for
-- redundant new columns. district is left in place, unused by the new UI.

alter table tithe_and_mo add column receiver_name text;
alter table tithe_and_mo add column items_required text;
alter table tithe_and_mo add column approved_by text;
