-- Add the assembly and residence details required by the Ordinance forms.
-- The fields remain nullable to protect existing records.

alter table water_baptisms
  add column assembly text check (assembly in ('English', 'Twi'));

alter table holy_spirit_baptisms
  add column assembly text check (assembly in ('English', 'Twi'));

alter table souls_won
  add column assembly text check (assembly in ('English', 'Twi')),
  add column residence text;
