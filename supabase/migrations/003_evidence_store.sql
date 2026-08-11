-- Migration 003: evidence/provenance store (Convex V2 parity on Supabase)
-- NOT YET APPLIED — LeadGenScout project unreachable at authoring time.
-- Invariants mirrored by v2/lib/store/{memory,supabase}.ts and contract tests.

create table if not exists observations (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id text not null,
  metric text not null,                          -- validated against lib/evidence/metrics registry at boundary
  value jsonb not null,
  unit text,
  basis text not null check (basis in ('OBSERVED','DERIVED','AI_ESTIMATED','HUMAN_ASSUMED')),
  source text not null,
  citation text,                                  -- required for AI_ESTIMATED (enforced at boundary + trigger below)
  confidence numeric,
  observed_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  run_id uuid,
  legacy boolean not null default false,          -- V0-imported evidence
  superseded_by uuid references observations(id)
);
create index if not exists idx_obs_subject_metric on observations (subject_id, metric, observed_at desc);
create index if not exists idx_obs_run on observations (run_id);

-- AI citation guard at the database layer too
create or replace function obs_ai_citation_guard() returns trigger language plpgsql as $$
begin
  if new.basis = 'AI_ESTIMATED' and (new.citation is null or length(new.citation) = 0) then
    raise exception 'AI_ESTIMATED observations require a citation';
  end if;
  return new;
end $$;
drop trigger if exists trg_obs_ai_citation on observations;
create trigger trg_obs_ai_citation before insert on observations
  for each row execute function obs_ai_citation_guard();

-- Append-only: only superseded_by may ever change, via this RPC; no deletes.
create or replace function supersede_observation(p_old uuid, p_by uuid)
returns void language sql security definer as
$$ update observations set superseded_by = p_by where id = p_old and superseded_by is null; $$;

revoke update, delete on observations from anon, authenticated;

create table if not exists research_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  params_hash text not null,
  stage int not null default 0,
  as_of timestamptz,
  status text not null default 'running' check (status in ('running','completed','failed')),
  budget_cap_usd numeric not null default 0,
  spent_usd numeric not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (kind, params_hash)                      -- idempotency
);

create table if not exists budget_ledger (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references research_runs(id) on delete cascade,
  provider text not null,
  units numeric not null default 1,
  cost_usd numeric not null default 0,
  refused boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_run on budget_ledger (run_id);
revoke update, delete on budget_ledger from anon, authenticated;
