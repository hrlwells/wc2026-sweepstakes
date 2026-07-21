-- ============================================================
-- WEDDING FITNESS TRACKER — Supabase schema
-- Run this ONCE in the Supabase SQL editor for your project.
-- Wide-open for testing (no auth). Tighten before real use.
--
-- Each day's log and the profile are stored as JSONB so the
-- shape matches the app 1:1 (no field-by-field mapping):
--   day  = { done, protein, creatine, macros, pushups,
--            runMin, weight, steps, notes }
--   prof = { name, currentWeight, goalWeight, proteinPerKg,
--            creatine, calBaseline, fivekBase, pushupBase }
-- ============================================================

create table if not exists fitness_log (
  log_date   date primary key,     -- e.g. '2026-07-27'
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists fitness_profile (
  id         int primary key default 1,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Seed the profile row with the placeholder baselines.
insert into fitness_profile (id, data) values (
  1,
  '{"name":"Harry","currentWeight":95,"goalWeight":89,"proteinPerKg":1.8,"creatine":10,"calBaseline":2500,"fivekBase":27.5,"pushupBase":30}'::jsonb
) on conflict (id) do nothing;

-- ---- Row Level Security: WIDE OPEN for the testing phase ----
alter table fitness_log     enable row level security;
alter table fitness_profile enable row level security;
create policy "open_log_all"     on fitness_log     for all using (true) with check (true);
create policy "open_profile_all" on fitness_profile for all using (true) with check (true);

-- ============================================================
-- BEFORE REAL USE: drop the two open_* policies, add Supabase
-- magic-link auth + a user_id column, and restrict rows to the
-- signed-in user. We'll do that together when you're ready.
-- ============================================================
