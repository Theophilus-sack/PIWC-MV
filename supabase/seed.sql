-- Dev/demo seed data — Phase 2 + Phase 3.
-- Everything here is fabricated for development and performance testing
-- (the real workbook has ~2000-row tabs; we seed close to that so
-- pagination/perf can be verified against a realistic volume). No real
-- member names, phone numbers, or figures — never paste real congregation
-- data into this file.
--
-- Safe to run this whole file more than once: every bulk section is
-- guarded to only insert when its table is still empty, so re-running it
-- (e.g. after adding a later phase's fake data below) won't duplicate
-- anything already seeded. Requires 0001_foundation.sql through
-- 0007_finance.sql already applied.

insert into ministries (name) values
  ('Choir'), ('Ushering'), ('Media'), ('Children'), ('Youth'),
  ('Evangelism'), ('Hospitality'), ('Prayer')
on conflict (name, assembly) do nothing;

insert into presbyters (name, contact)
select * from (values
  ('Presbyter Kwabena Owusu', '+233 24 111 2222'),
  ('Presbyter Yaa Asantewaa', '+233 24 222 3333'),
  ('Presbyter Kojo Mensah', '+233 24 333 4444'),
  ('Presbyter Efua Sarpong', '+233 24 444 5555')
) as v(name, contact)
where not exists (select 1 from presbyters limit 1);

insert into ministry_leadership (ministry_id, leader_name, portfolio, contact)
select mi.id, v.leader_name, v.portfolio, v.contact
from (values
  ('Choir', 'Nana Yeboah', 'President', '+233 24 601 7001'),
  ('Ushering', 'Abena Osei', 'President', '+233 24 602 7002'),
  ('Media', 'Kwesi Amankwah', 'President', '+233 24 603 7003'),
  ('Children', 'Adjoa Boateng', 'President', '+233 24 604 7004'),
  ('Youth', 'Kwame Antwi', 'President', '+233 24 605 7005'),
  ('Evangelism', 'Efua Darko', 'President', '+233 24 606 7006'),
  ('Hospitality', 'Yaw Asare', 'President', '+233 24 607 7007'),
  ('Prayer', 'Akosua Frimpong', 'President', '+233 24 608 7008')
) as v(ministry_name, leader_name, portfolio, contact)
join ministries mi on mi.name = v.ministry_name
where not exists (select 1 from ministry_leadership limit 1);

-- ~2000 fake members, matching the real workbook's rough tab size so we
-- can actually exercise pagination/perf rather than testing against a
-- handful of rows.
with first_names as (
  select array['Akwasi','Nana','Yaw','Kwame','Akua','Adwoa','Abena','Esi','Ama','Kofi',
    'Mavis','Joyce','Selasi','Eric','Doris','Felix','Patience','Sandra','Edmund','Naomi',
    'Daniel','Linda','Bright','Emmanuel','Hannah','Sarah','Joseph','Comfort','Prince',
    'Gifty','Isaac','Priscilla']::text[] as arr
),
last_names as (
  select array['Owusu','Mensah','Asante','Boateng','Frimpong','Adjei','Agyeman','Sarpong',
    'Tetteh','Quaye','Annan','Kpodo','Aboagye','Darko','Nyarko','Antwi','Asare','Ofori',
    'Gyasi','Donkor']::text[] as arr
)
insert into members (date_joined, name, gender, residence, contact, preferred_assembly, status)
select
  current_date - (floor(random() * 1460))::int,
  fn.arr[1 + floor(random() * array_length(fn.arr, 1))::int]
    || ' ' || ln.arr[1 + floor(random() * array_length(ln.arr, 1))::int],
  case when random() > 0.5 then 'Male' else 'Female' end,
  (array['Mountain View','Ashongman','Haatso','Dome','Taifa','Achimota','Ablekuma','Adenta'])
    [1 + floor(random() * 8)::int] || ' Estates',
  '+233 ' || (20 + floor(random() * 7))::int || ' ' || (100 + floor(random() * 899))::int
    || ' ' || (1000 + floor(random() * 8999))::int,
  case when random() > 0.15 then 'English' else 'Twi' end,
  (array['stay','stay','stay','stay','first-timer','visit'])[1 + floor(random() * 6)::int]
from generate_series(1, 2000), first_names fn, last_names ln
where not exists (select 1 from members limit 1);

-- ~60% of members belong to one ministry each.
insert into ministry_members (member_id, ministry_id)
select m.id, mi.id
from members m
cross join lateral (select id from ministries order by random() limit 1) mi
where random() < 0.6
  and not exists (select 1 from ministry_members limit 1);

-- 10 weeks of general Sunday services + two ministry-specific gatherings.
insert into service_dates (service_date, name, ministry_id)
select current_date - (n * 7), 'Sunday 1st Service', null
from generate_series(0, 9) as n
where not exists (select 1 from service_dates limit 1);

insert into service_dates (service_date, name, ministry_id)
select current_date - 3, 'Choir Rehearsal', id from ministries where name = 'Choir'
  and not exists (select 1 from service_dates where name = 'Choir Rehearsal' limit 1)
union all
select current_date - 10, 'Youth Meeting', id from ministries where name = 'Youth'
  and not exists (select 1 from service_dates where name = 'Youth Meeting' limit 1);

-- Attendance: ~75% present for general services, ~80% for ministry ones.
insert into attendance_records (service_date_id, member_id, present)
select sd.id, m.id, random() < 0.75
from service_dates sd
cross join members m
where sd.ministry_id is null
  and not exists (select 1 from attendance_records limit 1);

insert into attendance_records (service_date_id, member_id, present)
select sd.id, mm.member_id, random() < 0.8
from service_dates sd
join ministry_members mm on mm.ministry_id = sd.ministry_id
where sd.ministry_id is not null
  and not exists (
    select 1 from attendance_records ar
    join service_dates sd2 on sd2.id = ar.service_date_id
    where sd2.ministry_id is not null limit 1
  );

-- Fake monthly tithe/missions-offering figures for the current year —
-- fabricated round-ish numbers for exercising the budget-vs-actual views,
-- not real church finances.
insert into net_tithes_performance (year, month, budget_ghs, actual_ghs)
select extract(year from current_date)::int, m,
  6000 + (m * 150),
  round((6000 + (m * 150)) * (0.85 + random() * 0.3), 2)
from generate_series(1, 12) as m
on conflict (year, month) do nothing;

insert into missions_offering_performance (year, month, budget_ghs, actual_ghs)
select extract(year from current_date)::int, m,
  1500 + (m * 40),
  round((1500 + (m * 40)) * (0.8 + random() * 0.4), 2)
from generate_series(1, 12) as m
on conflict (year, month) do nothing;

insert into designated_funds (district, fund_name, actual_prior_year_ghs, budget_current_year_ghs, actual_current_year_ghs)
select * from (values
  ('Madina District', 'Building Fund', 42000, 60000, 51000),
  ('Madina District', 'Welfare Fund', 8000, 10000, 9200),
  ('Madina District', 'Youth Camp Fund', 5000, 7000, 4300)
) as v(district, fund_name, actual_prior_year_ghs, budget_current_year_ghs, actual_current_year_ghs)
where not exists (select 1 from designated_funds limit 1);
