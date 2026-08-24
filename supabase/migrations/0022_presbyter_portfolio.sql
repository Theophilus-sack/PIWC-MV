-- Presbyters gain a Portfolio (Elder/Deacon/Deaconess) so the Leadership
-- directory can filter by it, same way it already filters by service
-- (assembly). No RLS change: presbyters_select/presbyters_write (0002)
-- are table-level policies, so they already cover this new column.

alter table presbyters add column portfolio text
  check (portfolio in ('Elder','Deacon','Deaconess'));
