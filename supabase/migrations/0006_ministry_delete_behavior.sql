-- Ministries can now be deleted from the app (Groups/Ministries, Super
-- Admin only). ministry_members and ministry_leadership already cascade
-- on ministry delete, but service_dates.ministry_id had no ON DELETE rule
-- at all — the default (NO ACTION) would just block the delete with a
-- foreign key error the moment a ministry had any service history, which
-- isn't the intended behavior: a past service's attendance record
-- shouldn't vanish (or block deletion) just because the ministry that
-- held it was later removed. Set null instead — the service just becomes
-- an unscoped one, same as a general Sunday service.

alter table service_dates drop constraint service_dates_ministry_id_fkey;
alter table service_dates add constraint service_dates_ministry_id_fkey
  foreign key (ministry_id) references ministries(id) on delete set null;
