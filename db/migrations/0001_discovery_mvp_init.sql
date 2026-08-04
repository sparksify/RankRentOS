-- RankRentOS Discovery MVP — canonical schema v1
-- Hosted (temporarily) in the ai-employee-os Supabase project; every table is
-- prefixed rros_ so the whole system can be moved to a dedicated project by
-- replaying migrations and copying rros_* data. See docs/Discovery-MVP-Architecture.md.

create extension if not exists pgcrypto;

-- ============ Layer A: raw evidence (immutable) ============
create table if not exists rros_raw_evidence (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  request_type text not null,
  request_params jsonb not null default '{}',
  source_id text,
  observed_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  checksum text not null unique,
  payload jsonb,
  storage_ref text,
  cost_usd numeric(10,4) default 0,
  job_id uuid,
  task_id uuid,
  execution_id uuid
);
create index if not exists rros_raw_evidence_provider_idx on rros_raw_evidence (provider, request_type);

-- ============ Geography ============
create table if not exists rros_cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  county text,
  lat double precision,
  lng double precision,
  region text,
  boundary jsonb,
  external_ids jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (name, state)
);

create table if not exists rros_neighborhoods (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references rros_cities(id),
  name text not null,
  type text not null default 'neighborhood', -- census_area | neighborhood | master_planned | development | custom
  lat double precision,
  lng double precision,
  boundary jsonb,
  source text,
  validation_state text not null default 'unvalidated',
  created_at timestamptz not null default now(),
  unique (city_id, name)
);

create table if not exists rros_territories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  definition_type text not null, -- radius | metro | city_list | custom
  seed_lat double precision,
  seed_lng double precision,
  radius_km double precision,
  geometry jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists rros_territory_memberships (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references rros_territories(id),
  member_type text not null, -- city | neighborhood
  member_id uuid not null,
  unique (territory_id, member_type, member_id)
);

create table if not exists rros_geo_observations (
  id uuid primary key default gen_random_uuid(),
  geo_type text not null, -- city | neighborhood | territory
  geo_id uuid not null,
  metric text not null,   -- population | household_income | growth | housing_age | home_value
  value_num numeric,
  value_text text,
  dataset text,
  dataset_year int,
  source text not null,
  observed_at timestamptz not null,
  evidence_id uuid references rros_raw_evidence(id),
  ingested_at timestamptz not null default now()
);
create index if not exists rros_geo_obs_idx on rros_geo_observations (geo_type, geo_id, metric, observed_at desc);

-- ============ Niches & playbooks ============
create table if not exists rros_niches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  active boolean not null default true,
  attrs jsonb not null default '{}', -- editorial: ticketLow/High, margin, seasonal, archetype, need, peRisk, query, acQuery, domainTerms
  created_at timestamptz not null default now()
);

create table if not exists rros_niche_services (
  id uuid primary key default gen_random_uuid(),
  niche_id uuid not null references rros_niches(id),
  name text not null,
  search_intent text not null default 'commercial',
  active boolean not null default true,
  unique (niche_id, name)
);

create table if not exists rros_playbooks (
  id uuid primary key default gen_random_uuid(),
  niche_id uuid not null references rros_niches(id),
  name text not null,
  version int not null default 1,
  status text not null default 'active',
  build_verdict text not null default 'build', -- build | commission-only | avoid
  discovery_criteria jsonb not null default '{}',
  scoring_overrides jsonb not null default '{}',
  keyword_strategy jsonb not null default '{}',
  operator_criteria jsonb not null default '{}',
  revenue_assumptions jsonb not null default '{}',
  known_risks jsonb not null default '[]',
  kill_criteria jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (niche_id, version)
);

-- ============ Markets & keywords ============
create table if not exists rros_markets (
  id uuid primary key default gen_random_uuid(),
  niche_id uuid not null references rros_niches(id),
  geo_type text not null, -- city | neighborhood | territory
  geo_id uuid not null,
  territory_id uuid references rros_territories(id),
  research_state text not null default 'unresearched', -- unresearched | qualified | rejected | deep_researched
  last_researched_at timestamptz,
  freshness_state text not null default 'unknown',
  created_at timestamptz not null default now(),
  unique (niche_id, geo_type, geo_id)
);

create table if not exists rros_keywords (
  id uuid primary key default gen_random_uuid(),
  niche_id uuid references rros_niches(id),
  niche_service_id uuid references rros_niche_services(id),
  term text not null,
  intent text not null default 'commercial',
  geo_scope text, -- national | city:<uuid> | none
  parent_keyword_id uuid references rros_keywords(id),
  unique (term, geo_scope)
);

create table if not exists rros_keyword_observations (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references rros_keywords(id),
  volume int,
  cpc numeric(8,2),
  competition numeric(4,3),
  trend jsonb,
  provider text not null,
  observed_at timestamptz not null,
  evidence_id uuid references rros_raw_evidence(id),
  ingested_at timestamptz not null default now()
);
create index if not exists rros_kw_obs_idx on rros_keyword_observations (keyword_id, observed_at desc);

create table if not exists rros_serp_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references rros_markets(id),
  keyword_id uuid references rros_keywords(id),
  query text not null,
  engine text not null default 'google',
  device text not null default 'desktop',
  geo_params jsonb not null default '{}',
  provider text not null,
  observed_at timestamptz not null,
  evidence_id uuid references rros_raw_evidence(id),
  cost_usd numeric(10,4) default 0
);
create index if not exists rros_serp_snap_idx on rros_serp_snapshots (market_id, observed_at desc);

create table if not exists rros_serp_results (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references rros_serp_snapshots(id),
  position int,
  result_type text not null default 'organic', -- organic | local_pack | ad
  url text,
  domain text,
  title text,
  business_id uuid,
  is_directory boolean not null default false,
  is_franchise boolean not null default false,
  is_emd boolean not null default false,
  is_inner_page boolean not null default false,
  authority jsonb not null default '{}'
);
create index if not exists rros_serp_results_snap_idx on rros_serp_results (snapshot_id);

-- ============ Businesses ============
create table if not exists rros_businesses (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  root_domain text,
  primary_phone text,
  place_id text,
  identity_confidence numeric(4,3) not null default 0.5,
  identity_review_state text not null default 'auto',
  created_at timestamptz not null default now()
);
create index if not exists rros_businesses_domain_idx on rros_businesses (root_domain);

create table if not exists rros_business_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references rros_businesses(id),
  name text,
  address text,
  city_id uuid references rros_cities(id),
  neighborhood_id uuid references rros_neighborhoods(id),
  lat double precision,
  lng double precision,
  phone text,
  google_place_id text,
  service_area boolean not null default false
);

create table if not exists rros_business_observations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references rros_businesses(id),
  location_id uuid references rros_business_locations(id),
  obs_type text not null, -- review_count | rating | ranking | website_state | tech_stack | content_depth | authority | gbp | multi_location | franchise | operator_fit
  value jsonb not null,
  tier text not null default 'scan', -- scan | enrichment | operate
  source text not null,
  inferred boolean not null default false,
  confidence numeric(4,3) not null default 0.5,
  observed_at timestamptz not null,
  evidence_id uuid references rros_raw_evidence(id),
  ingested_at timestamptz not null default now()
);
create index if not exists rros_biz_obs_idx on rros_business_observations (business_id, obs_type, observed_at desc);

create table if not exists rros_pipeline_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references rros_businesses(id),
  role text not null, -- competitor | operator_candidate | research_target
  market_id uuid references rros_markets(id),
  state text not null default 'active',
  created_at timestamptz not null default now(),
  unique (business_id, role, market_id)
);

-- ============ Domains ============
create table if not exists rros_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  root_name text not null,
  tld text not null,
  created_at timestamptz not null default now()
);

create table if not exists rros_domain_observations (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references rros_domains(id),
  available boolean,
  reg_price numeric(10,2),
  premium_price numeric(10,2),
  registrar text,
  provider text not null,
  observed_at timestamptz not null,
  evidence_id uuid references rros_raw_evidence(id),
  ingested_at timestamptz not null default now()
);
create index if not exists rros_domain_obs_idx on rros_domain_observations (domain_id, observed_at desc);

-- ============ Jobs / tasks / executions ============
create table if not exists rros_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  params jsonb not null default '{}',
  status text not null default 'queued', -- queued | running | completed | failed | cancelled
  progress jsonb not null default '{}',
  budget_usd numeric(10,2),
  actual_cost_usd numeric(10,4) not null default 0,
  error_summary text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists rros_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rros_jobs(id),
  type text not null,
  params jsonb not null default '{}',
  status text not null default 'queued', -- queued | running | completed | failed | skipped
  depends_on uuid[] not null default '{}',
  retry_count int not null default 0,
  max_retries int not null default 2,
  error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, idempotency_key)
);

create table if not exists rros_executions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references rros_tasks(id),
  provider text,
  worker text,
  ai_model text,
  fn_version text,
  input_ref jsonb,
  output_ref jsonb,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10,4) not null default 0,
  latency_ms int,
  retry_number int not null default 0,
  error text,
  success boolean,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ============ Candidates / opportunities / scores / blueprints ============
create table if not exists rros_candidates (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references rros_markets(id),
  qualification_version text not null,
  result text not null, -- passed | failed | needs_research
  reasons jsonb not null default '[]',
  confidence numeric(4,3) not null default 0.5,
  input_hash text not null,
  qualified_at timestamptz not null default now(),
  research_status text not null default 'none', -- none | queued | deep_researched
  unique (market_id, qualification_version, input_hash)
);

create table if not exists rros_opportunities (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references rros_markets(id),
  candidate_id uuid references rros_candidates(id),
  state text not null default 'researched', -- researched | recommended | approved | rejected | hold
  evidence_completeness numeric(4,3),
  freshness_state text not null default 'unknown',
  blocking_conditions jsonb not null default '[]',
  review_state text not null default 'unreviewed',
  created_at timestamptz not null default now(),
  unique (market_id)
);

create table if not exists rros_scores (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  lens text not null,
  lens_version text not null,
  weights_version text not null,
  overall numeric(6,2) not null,
  subscores jsonb not null default '{}',
  confidence numeric(4,3) not null,
  reasons jsonb not null default '[]',
  input_hash text not null,
  computed_at timestamptz not null default now()
);
create index if not exists rros_scores_idx on rros_scores (entity_type, entity_id, lens, computed_at desc);

create table if not exists rros_blueprint_versions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references rros_opportunities(id),
  version int not null default 1,
  recommended_domain text,
  alt_domains jsonb not null default '[]',
  domain_availability_checked_at timestamptz,
  target_services jsonb not null default '[]',
  target_geography jsonb not null default '{}',
  sitemap jsonb not null default '[]',
  content_plan jsonb not null default '[]',
  authority_assumptions jsonb not null default '{}',
  operator_strategy jsonb not null default '{}',
  est_cost_low numeric(10,0),
  est_cost_high numeric(10,0),
  est_rank_months_low numeric(4,1),
  est_rank_months_high numeric(4,1),
  est_leads_low numeric(6,1),
  est_leads_high numeric(6,1),
  est_revenue_low numeric(10,0),
  est_revenue_high numeric(10,0),
  risks jsonb not null default '[]',
  assumptions jsonb not null default '[]',
  confidence numeric(4,3),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  unique (opportunity_id, version)
);

-- ============ Batch 1 approval surface ============
create table if not exists rros_batch_targets (
  id uuid primary key default gen_random_uuid(),
  batch text not null default 'batch-1',
  position int not null,
  opportunity_id uuid not null references rros_opportunities(id),
  role text not null default 'primary', -- primary | alternate
  inclusion_reasons jsonb not null default '[]',
  decision text not null default 'pending', -- pending | approved | rejected | hold | replaced
  notes text,
  locked boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (batch, opportunity_id)
);

-- ============ Config (versioned weights, thresholds, freshness policies) ============
create table if not exists rros_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS: single-admin app; all access is server-side with the project key.
-- Enable RLS with permissive policies so the anon key works from the app's
-- server routes only (the app itself is behind password auth middleware).
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname='public' and tablename like 'rros_%'
  loop
    execute format('alter table %I enable row level security', t);
    begin
      execute format('create policy rros_all on %I for all using (true) with check (true)', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
