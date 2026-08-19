-- Spec's Life Event form/table mockups both include a Notes field
-- (member_support already has one; life_events never did). Purely
-- additive, same as 0017 — existing rows just get NULL here.

alter table life_events add column notes text;
