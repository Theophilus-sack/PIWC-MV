-- Fix: ministries.name was globally unique, which blocks the exact case
-- the church actually has — the same ministry name existing once per
-- service (e.g. "Women's Ministry" for both the English and Twi
-- congregations). Unique per (name, assembly) instead.
--
-- Note: two ministries with the same name and assembly = null (not yet
-- categorised) won't collide either, since Postgres treats each null as
-- distinct in a unique constraint — acceptable for now since new
-- ministries created through the app always set an assembly.

alter table ministries drop constraint ministries_name_key;
alter table ministries add constraint ministries_name_assembly_key unique (name, assembly);
