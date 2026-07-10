-- DataBridge AI — Supabase Schema
-- Run this in the Supabase SQL Editor to set up the required tables.

-- 1. Import Sessions: tracks each CSV import run
create table if not exists import_sessions (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  total_rows integer not null default 0,
  total_imported integer not null default 0,
  total_skipped integer not null default 0,
  ai_engine text,
  created_at timestamptz not null default now()
);

-- 2. CRM Records: stores each successfully imported lead
create table if not exists crm_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references import_sessions(id) on delete cascade,
  created_at text,
  name text,
  email text,
  country_code text,
  mobile_without_country_code text,
  company text,
  city text,
  state text,
  country text,
  lead_owner text,
  crm_status text check (crm_status in ('GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE', '')),
  crm_note text,
  data_source text check (data_source in ('leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots', '')),
  possession_time text,
  description text,
  inserted_at timestamptz not null default now()
);

-- 3. Skipped Rows: stores rows that failed validation with reason
create table if not exists skipped_rows (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references import_sessions(id) on delete cascade,
  raw_row jsonb not null,
  reason text,
  inserted_at timestamptz not null default now()
);

-- 4. Enable Row Level Security (allow all for anon key — tighten in production)
alter table import_sessions enable row level security;
alter table crm_records enable row level security;
alter table skipped_rows enable row level security;

create policy "Allow all import_sessions" on import_sessions for all using (true) with check (true);
create policy "Allow all crm_records" on crm_records for all using (true) with check (true);
create policy "Allow all skipped_rows" on skipped_rows for all using (true) with check (true);
