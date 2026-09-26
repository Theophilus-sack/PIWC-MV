-- Groups/Ministries: Ministry/Department Leader is now strictly
-- read-only, scoped to their own assigned ministry_id.
--
-- 0002 (ministry_members_write) and 0016 (ministry_activities_write)
-- originally let a Ministry Leader manage their own roster and activity
-- log. That's being withdrawn — only Super Admin may insert/update/delete
-- ministry_members or ministry_activities now. The corresponding select
-- policies (ministry_members_select, ministry_activities_select,
-- members_select) already scope a Ministry Leader to rows where
-- ministry_id = current_ministry_id() and are untouched here: a leader
-- with no ministry_id assigned already sees zero rows, since
-- `ministry_id = current_ministry_id()` is never true when
-- current_ministry_id() is null (SQL's three-valued logic), so there's no
-- separate "missing assignment" case to guard against.

drop policy if exists ministry_members_write on ministry_members;
create policy ministry_members_write on ministry_members for all
  using (current_app_role() = 'super_admin')
  with check (current_app_role() = 'super_admin');

drop policy if exists ministry_activities_write on ministry_activities;
create policy ministry_activities_write on ministry_activities for all
  using (current_app_role() = 'super_admin')
  with check (current_app_role() = 'super_admin');
