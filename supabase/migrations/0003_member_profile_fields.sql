-- Phase 2 follow-up: fields requested after the first real Add Member pass
-- (date of birth, and where a first-timer is visiting from). Additive only
-- — no existing column changes, so this is safe to run after 0002 with
-- live seeded data already in place.

alter table members add column date_of_birth date;
alter table members add column visiting_from text; -- first-timers only, optional: where they're visiting from
