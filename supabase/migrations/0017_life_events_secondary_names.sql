-- Life Event needs a second, separate name field: the existing `names`
-- column ("Names (Child/Couples/Deceased)") already has live data and is
-- left completely untouched — no rename, no drop, nothing destructive.
-- This just adds a new nullable column for "Names (Child's Parents/Name
-- of Bereaved Member)", which only applies to some event categories and
-- is blank for existing rows and any future row where it doesn't apply.

alter table life_events add column names_child_parents_bereaved text;
