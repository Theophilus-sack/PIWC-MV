-- Phase 2 follow-up: the church runs two services (English and Twi
-- assemblies). Ministries and presbyters get an assembly tag so
-- Groups/Ministries and Leadership can be categorised by which service
-- they belong to. 'Both' covers a ministry/presbyter that spans both
-- services (e.g. a joint media team) — nullable for anything not yet
-- categorised.

alter table ministries add column assembly text check (assembly in ('English', 'Twi', 'Both'));
alter table presbyters add column assembly text check (assembly in ('English', 'Twi', 'Both'));
