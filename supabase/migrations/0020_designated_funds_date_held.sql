-- Designated Funds' "District" field is being properly turned into a real
-- "Date Held" date field (it was previously just relabeled to "Date" in
-- the UI while still bound to the free-text `district` column). Additive
-- only: `district` and any historical values it holds stay exactly as
-- they are — nothing is renamed or dropped. Existing rows simply have
-- date_held = NULL until edited; nothing is fabricated for them.

alter table designated_funds add column date_held date;
