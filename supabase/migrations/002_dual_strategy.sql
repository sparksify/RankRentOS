-- Dual-strategy scoring columns + feedback loop (apply when DB write access restores;
-- until then strategy fields ship inside markets.signals JSONB under "strategyV2")
alter table markets
  add column if not exists rankability int,
  add column if not exists asset_value int,
  add column if not exists arbitrage int,
  add column if not exists overall_opportunity int,
  add column if not exists strategy text,
  add column if not exists data_confidence text,
  add column if not exists rent_low int,
  add column if not exists rent_high int,
  add column if not exists rent_tier text,
  add column if not exists coverage_ratio numeric,
  add column if not exists gross_profit_mo int,
  add column if not exists time_to_2k_prob numeric,
  add column if not exists source_dataset text;

create table if not exists site_outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references markets(id) on delete set null,
  domain text, launch_date date, indexed_date date, first_impressions_date date,
  first_top20_date date, first_top10_date date, first_top3_date date, first_lead_date date,
  leads_mo int, qualified_leads_mo int, monetization_date date,
  actual_mrr int, actual_renter text, churned_at date,
  predicted_rankability int, predicted_asset_value int,
  predicted_rent_low int, predicted_rent_high int,
  notes text, updated_at timestamptz default now()
);
