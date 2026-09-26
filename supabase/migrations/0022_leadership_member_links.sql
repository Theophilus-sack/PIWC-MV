-- Leadership (Presbyters + Ministry/Department Leadership) must now
-- reference an existing members(id) row instead of accepting a free-text
-- name — a fabricated or nonexistent person can no longer be saved as a
-- presbyter or ministry leader, enforced here at the database level (a
-- foreign key), not only by the app's searchable member picker.
--
-- presbyters.name/contact and ministry_leadership.leader_name/contact are
-- NOT removed — going forward the app populates them FROM the selected
-- member at save time (so ordering/existing display code keeps working
-- unchanged), and they remain the only source of truth for legacy rows
-- this migration can't confidently link. member_id stays NULLABLE
-- permanently: a blanket NOT NULL would break every pre-existing row, and
-- "inspect existing data before enforcing NOT NULL" means exactly that —
-- don't. "Required for new records" is enforced by the app form instead
-- (see LeadershipPage.jsx's validation message), which is what actually
-- can distinguish "new" from "legacy" rows; a static column constraint
-- can't.

-- ============== 1. Add the columns (nullable) ==============

alter table presbyters add column member_id uuid references members(id) on delete restrict;
alter table presbyters add column portfolio text check (portfolio in ('Elder', 'Deacon', 'Deaconess'));

alter table ministry_leadership add column member_id uuid references members(id) on delete restrict;

-- ============== 2. Backfill from existing free-text names ==============
-- Exact match only, case/whitespace-insensitive, and ONLY where exactly
-- one member matches — two different real people who happen to share a
-- name must never be silently guessed at. Anything else (no match, or an
-- ambiguous multi-match) is left for an administrator to link by hand via
-- Edit, same as any other legacy row this can't confidently resolve.

with candidate_matches as (
  select p.id as presbyter_id, m.id as member_id,
         count(*) over (partition by p.id) as match_count
  from presbyters p
  join members m on lower(trim(m.name)) = lower(trim(p.name))
  where p.member_id is null
)
update presbyters p
set member_id = cm.member_id
from candidate_matches cm
where cm.presbyter_id = p.id and cm.match_count = 1;

with candidate_matches as (
  select l.id as leadership_id, m.id as member_id,
         count(*) over (partition by l.id) as match_count
  from ministry_leadership l
  join members m on lower(trim(m.name)) = lower(trim(l.leader_name))
  where l.member_id is null
)
update ministry_leadership l
set member_id = cm.member_id
from candidate_matches cm
where cm.leadership_id = l.id and cm.match_count = 1;

-- ============== 3. Guard the uniqueness constraints below ==============
-- If two legacy rows both happened to be named after the same single
-- member (e.g. a duplicate presbyter entry), the exact-match backfill
-- above would link both to that one member_id — which would then fail
-- the "no duplicate assignment" constraints added next. Rather than let a
-- messy legacy duplicate abort the whole migration, keep the
-- earliest-created link and null the rest back out for manual review
-- (they're covered by the same "unmatched" notice at the end).

with ranked as (
  select id, member_id, row_number() over (partition by member_id order by created_at, id) as rn
  from presbyters
  where member_id is not null
)
update presbyters p
set member_id = null
from ranked r
where p.id = r.id and r.rn > 1;

with ranked as (
  select id, row_number() over (partition by ministry_id, member_id, portfolio order by created_at, id) as rn
  from ministry_leadership
  where member_id is not null
)
update ministry_leadership l
set member_id = null
from ranked r
where l.id = r.id and r.rn > 1;

-- ============== 4. Duplicate-assignment prevention ==============
-- Nullable columns keep multiple untouched legacy NULLs perfectly legal —
-- Postgres never treats two NULLs as equal for a unique constraint — so
-- this only blocks a real duplicate: the same member linked twice as a
-- presbyter, or the same member holding the same portfolio in the same
-- ministry/department twice.

alter table presbyters add constraint presbyters_member_id_key unique (member_id);
alter table ministry_leadership add constraint ministry_leadership_ministry_member_portfolio_key
  unique (ministry_id, member_id, portfolio);

-- ============== 5. Document what still needs manual linking ==============

do $$
declare
  unmatched_presbyters int;
  unmatched_leadership int;
begin
  select count(*) into unmatched_presbyters from presbyters where member_id is null;
  select count(*) into unmatched_leadership from ministry_leadership where member_id is null;
  raise notice
    'Leadership member-link backfill complete: % presbyter row(s) and % ministry_leadership row(s) remain unlinked (no exact name match, an ambiguous multi-match, or a duplicate the backfill couldn''t safely assign) — an administrator must open each in Edit and select the correct member before it can be updated further.',
    unmatched_presbyters, unmatched_leadership;
end $$;
