-- Migration 0002 — DB-side corpus normalization and qualification.
-- rros_load_corpus(): normalizes raw evidence payloads (niches_seed, cities_seed,
--   search_volume_corpus, trends_weights) into canonical rows. Idempotent via
--   deterministic UUIDv5 (namespace must match src/db/ids.ts RROS_NAMESPACE).
-- rros_qualify(): DB port of src/pipeline/qualify.ts (qual-v1.0) so research can
--   rerun from the app with no local worker. The TypeScript implementation is the
--   reference; keep both in sync when bumping QUALIFICATION_VERSION.

create extension if not exists "uuid-ossp" with schema extensions;

create or replace function rros_ns() returns uuid language sql immutable as
$$ select '1b671a64-40d5-491e-99b0-da01ff1f3341'::uuid $$;

create or replace function rros_id(name text) returns uuid language sql immutable as
$$ select extensions.uuid_generate_v5(rros_ns(), name) $$;

-- ============================================================
create or replace function rros_load_corpus() returns jsonb
language plpgsql as $fn$
declare
  v_niches jsonb; v_cities jsonb; v_volumes jsonb; v_trends jsonb;
  v_niches_ev uuid; v_cities_ev uuid; v_volumes_ev uuid;
  v_observed timestamptz;
  n_niches int; n_cities int; n_markets int; n_keywords int; n_kwobs int;
begin
  select payload, id into v_niches, v_niches_ev from rros_raw_evidence where request_type='niches_seed' order by ingested_at desc limit 1;
  select payload, id into v_cities, v_cities_ev from rros_raw_evidence where request_type='cities_seed' order by ingested_at desc limit 1;
  select payload, id, observed_at into v_volumes, v_volumes_ev, v_observed from rros_raw_evidence where request_type='search_volume_corpus' order by ingested_at desc limit 1;
  select payload into v_trends from rros_raw_evidence where request_type='trends_weights' order by ingested_at desc limit 1;
  if v_niches is null or v_cities is null then
    raise exception 'corpus evidence missing (niches_seed / cities_seed)';
  end if;

  -- Niches
  insert into rros_niches (id, name, slug, active, attrs)
  select rros_id('niche:'||(n->>'id')), n->>'label', n->>'id', true,
         jsonb_build_object(
           'query', n->>'query', 'acQuery', n->>'acQuery', 'domainTerms', n->'domainTerms',
           'ticketLow', (n->>'ticketLow')::numeric, 'ticketHigh', (n->>'ticketHigh')::numeric,
           'margin', (n->>'margin')::numeric, 'seasonal', (n->>'seasonal')::boolean,
           'peRisk', n->>'peRisk', 'archetype', n->>'archetype', 'need', (n->>'need')::boolean)
  from jsonb_array_elements(v_niches) n
  on conflict (slug) do update set attrs = excluded.attrs, name = excluded.name;
  get diagnostics n_niches = row_count;

  -- Playbooks v1
  insert into rros_playbooks (id, niche_id, name, version, status, build_verdict, discovery_criteria, keyword_strategy, revenue_assumptions, operator_criteria, known_risks, kill_criteria)
  select rros_id('playbook:'||(n->>'id')||'|1'), rros_id('niche:'||(n->>'id')), (n->>'label')||' Playbook', 1, 'active', 'build',
         jsonb_build_object('archetype', n->>'archetype', 'minIncome', case when n->>'archetype'='affluent-suburb' then 90000 else null end),
         jsonb_build_object('primaryQuery', n->>'query', 'acQuery', n->>'acQuery', 'domainTerms', n->'domainTerms'),
         jsonb_build_object('ticketLow', (n->>'ticketLow')::numeric, 'ticketHigh', (n->>'ticketHigh')::numeric, 'margin', (n->>'margin')::numeric, 'seasonal', (n->>'seasonal')::boolean),
         jsonb_build_object('profile', 'local operator ranked below #5 or absent from organic; buys leads or advertises'),
         case when n->>'peRisk' <> 'low' then jsonb_build_array('PE roll-up risk: '||(n->>'peRisk')) else '[]'::jsonb end,
         '["zero measured volume and no autocomplete demand","top-3 owned by brand-search franchises"]'::jsonb
  from jsonb_array_elements(v_niches) n
  on conflict (niche_id, version) do nothing;

  -- Cities + geo observations
  insert into rros_cities (id, name, state, region, external_ids)
  select rros_id('city:'||(c->>'city')||'|'||(c->>'state')), c->>'city', c->>'state', c->>'region', '{}'::jsonb
  from jsonb_array_elements(v_cities) c
  on conflict (name, state) do nothing;
  get diagnostics n_cities = row_count;

  insert into rros_geo_observations (id, geo_type, geo_id, metric, value_num, value_text, dataset, dataset_year, source, observed_at, evidence_id)
  select rros_id('geoobs:'||cid||'|'||m.metric||'|v0-curated|2026-08-03T00:00:00Z'),
         'city', cid::uuid, m.metric, m.value_num, m.value_text, 'v0-curated', 2026, 'v0-curated', '2026-08-03T00:00:00Z', v_cities_ev
  from (
    select rros_id('city:'||(c->>'city')||'|'||(c->>'state'))::text as cid, c from jsonb_array_elements(v_cities) c
  ) s
  cross join lateral (values
    ('population', (s.c->>'pop')::numeric, null::text),
    ('household_income', (s.c->>'income')::numeric, null::text),
    ('growth', null::numeric, s.c->>'growth')
  ) as m(metric, value_num, value_text)
  on conflict (id) do nothing;

  -- Markets: niche × city
  insert into rros_markets (id, niche_id, geo_type, geo_id, research_state, freshness_state)
  select rros_id('market:'||n.slug||'|'||c.name||'|'||c.state), n.id, 'city', c.id, 'unresearched', 'unknown'
  from rros_niches n cross join rros_cities c
  on conflict (niche_id, geo_type, geo_id) do nothing;
  get diagnostics n_markets = row_count;

  -- Keywords + observations from the volume corpus
  insert into rros_keywords (id, niche_id, term, intent, geo_scope)
  select rros_id('keyword:'||(n.attrs->>'acQuery')||' '||lower(c.name)||'|city:'||c.id),
         n.id, (n.attrs->>'acQuery')||' '||lower(c.name), 'commercial', 'city:'||c.id
  from rros_niches n cross join rros_cities c
  on conflict (term, geo_scope) do nothing;
  get diagnostics n_keywords = row_count;

  insert into rros_keyword_observations (id, keyword_id, volume, cpc, competition, provider, observed_at, evidence_id)
  select rros_id('kwobs:'||k.term||'|dataforseo|'||to_char(v_observed at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')),
         k.id,
         (v_volumes->(k.term)->>'vol')::int,
         nullif(v_volumes->(k.term)->>'cpc','null')::numeric,
         nullif(v_volumes->(k.term)->>'competition','null')::numeric,
         'dataforseo', v_observed, v_volumes_ev
  from rros_keywords k
  where v_volumes ? k.term
  on conflict (id) do nothing;
  get diagnostics n_kwobs = row_count;

  return jsonb_build_object('niches', n_niches, 'cities', n_cities, 'markets', n_markets, 'keywords', n_keywords, 'keyword_observations', n_kwobs);
end
$fn$;

-- ============================================================
-- Qualification qual-v1.0 (DB port of src/pipeline/qualify.ts)
create or replace function rros_qualify() returns jsonb
language plpgsql as $fn$
declare
  v_version text := 'qual-v1.0';
  v_job uuid;
  v_trends jsonb;
  r record;
  n_pass int := 0; n_fail int := 0; n_needs int := 0;
  score numeric; reasons jsonb; failed bool; needs bool;
  vol int; cpc numeric; pop numeric; income numeric; growth text;
  avg_ticket numeric; lead_value numeric; tw numeric; warns int; conf numeric;
  res text; ihash text;
begin
  select payload->'stats' into v_trends from rros_raw_evidence where request_type='trends_weights' order by ingested_at desc limit 1;
  v_job := rros_id('job:qualification|qualify|'||v_version);
  insert into rros_jobs (id, type, params, status, budget_usd, actual_cost_usd, started_at)
  values (v_job, 'qualification', jsonb_build_object('version', v_version), 'running', 0, 0, now())
  on conflict (id) do update set status='running', started_at=now();

  for r in
    select m.id as market_id, n.slug as niche_slug, n.attrs, c.name as city, c.state,
           (select go.value_num from rros_geo_observations go where go.geo_id=c.id and go.metric='population' order by go.observed_at desc limit 1) as pop,
           (select go.value_num from rros_geo_observations go where go.geo_id=c.id and go.metric='household_income' order by go.observed_at desc limit 1) as income,
           (select go.value_text from rros_geo_observations go where go.geo_id=c.id and go.metric='growth' order by go.observed_at desc limit 1) as growth,
           (n.attrs->>'acQuery')||' '||lower(c.name) as term,
           (select ko.volume from rros_keyword_observations ko join rros_keywords k on k.id=ko.keyword_id
             where k.term=(n.attrs->>'acQuery')||' '||lower(c.name) and k.geo_scope='city:'||c.id
             order by ko.observed_at desc limit 1) as vol,
           (select ko.cpc from rros_keyword_observations ko join rros_keywords k on k.id=ko.keyword_id
             where k.term=(n.attrs->>'acQuery')||' '||lower(c.name) and k.geo_scope='city:'||c.id
             order by ko.observed_at desc limit 1) as cpc
    from rros_markets m
    join rros_niches n on n.id=m.niche_id
    join rros_cities c on c.id=m.geo_id
    where m.geo_type='city'
  loop
    score := 0; reasons := '[]'::jsonb; failed := false; needs := false;
    vol := r.vol; cpc := r.cpc; pop := r.pop; income := r.income; growth := r.growth;

    -- population gate
    if pop is null then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','population','outcome','warn','detail','Population unknown — needs verification'));
      needs := true;
    elsif pop < 15000 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','population','outcome','fail','detail', format('Population %s below 15,000 floor', pop)));
      failed := true;
    else
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','population','outcome','pass','detail', format('Population %s', pop)));
      score := score + 10;
    end if;

    -- income gate
    if r.attrs->>'archetype' = 'affluent-suburb' then
      if income is null then
        reasons := reasons || jsonb_build_array(jsonb_build_object('gate','income','outcome','warn','detail','Income unknown for affluence-sensitive niche'));
        needs := true;
      elsif income < 90000 then
        reasons := reasons || jsonb_build_array(jsonb_build_object('gate','income','outcome','fail','detail', format('Median income $%s below $90,000 for %s', income, r.niche_slug)));
        failed := true;
      else
        reasons := reasons || jsonb_build_array(jsonb_build_object('gate','income','outcome','pass','detail', format('Median income $%s', income)));
        score := score + case when income >= 120000 then 15 else 10 end;
      end if;
    elsif income is not null then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','income','outcome','info','detail', format('Median income $%s (niche not affluence-gated)', income)));
      score := score + 5;
    end if;

    -- demand gate
    if vol is null then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','demand','outcome','warn','detail', format('No volume observation for "%s"', r.term)));
      needs := true;
    elsif vol >= 100 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','demand','outcome','pass','detail', format('%s/mo measured searches for "%s"', vol, r.term)));
      score := score + 30;
    elsif vol >= 30 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','demand','outcome','pass','detail', format('%s/mo — modest but real (hyper-local under-reporting likely)', vol)));
      score := score + 20;
    elsif vol >= 10 then
      if (r.attrs->>'ticketHigh')::numeric >= 15000 then
        reasons := reasons || jsonb_build_array(jsonb_build_object('gate','demand','outcome','pass','detail', format('%s/mo but high-ticket — commission-grade economics', vol)));
        score := score + 14;
      else
        reasons := reasons || jsonb_build_array(jsonb_build_object('gate','demand','outcome','warn','detail', format('%s/mo — thin demand for a rent-model niche', vol)));
        score := score + 6; needs := true;
      end if;
    else
      if (r.attrs->>'ticketHigh')::numeric >= 15000 and vol > 0 then
        reasons := reasons || jsonb_build_array(jsonb_build_object('gate','demand','outcome','warn','detail', format('%s/mo — very thin; only viable as commission play', vol)));
        score := score + 4; needs := true;
      else
        reasons := reasons || jsonb_build_array(jsonb_build_object('gate','demand','outcome','fail','detail', format('%s/mo measured — below viability floor', vol)));
        failed := true;
      end if;
    end if;

    -- cpc gate
    if cpc is null or cpc = 0 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','cpc','outcome','warn','detail','No CPC — advertisers not measurably buying these clicks'));
    elsif cpc >= 2 and cpc <= 15 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','cpc','outcome','pass','detail', format('CPC $%s — healthy commercial intent', round(cpc,2))));
      score := score + 15;
    elsif cpc > 16 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','cpc','outcome','warn','detail', format('CPC $%s — ad-war pricing; organic prize is large but competition capital is real', round(cpc,2))));
      score := score + 8;
    else
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','cpc','outcome','info','detail', format('CPC $%s', round(cpc,2))));
      score := score + 5;
    end if;

    -- niche economics
    avg_ticket := ((r.attrs->>'ticketLow')::numeric + (r.attrs->>'ticketHigh')::numeric) / 2;
    lead_value := avg_ticket * (r.attrs->>'margin')::numeric * 0.1;
    if lead_value >= 300 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','economics','outcome','pass','detail', format('Avg ticket $%s, margin %s — strong lead economics', avg_ticket, r.attrs->>'margin')));
      score := score + 15;
    elsif lead_value >= 100 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','economics','outcome','pass','detail', format('Avg ticket $%s — workable flat-rent economics', avg_ticket)));
      score := score + 8;
    else
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','economics','outcome','warn','detail', format('Low ticket ($%s) — rent ceiling is low', avg_ticket)));
      score := score + 3;
    end if;

    -- growth
    if growth = 'high' then
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','growth','outcome','pass','detail','High-growth city — demand compounding'));
      score := score + 8;
    elsif growth = 'medium' then
      score := score + 4;
    end if;

    -- trend weight
    tw := case when (r.attrs->>'seasonal')::boolean
               then (v_trends->(r.attrs->>'acQuery')->>'weightPeak')::numeric
               else (v_trends->(r.attrs->>'acQuery')->>'weight')::numeric end;
    if tw is not null then
      score := round(score * tw);
      reasons := reasons || jsonb_build_array(jsonb_build_object('gate','trend','outcome','info','detail', format('Niche demand weight %s', tw)));
    end if;

    select count(*) into warns from jsonb_array_elements(reasons) e where e->>'outcome'='warn';
    conf := greatest(0.2, least(0.9, 0.9 - warns * 0.15));
    res := case when failed then 'failed' when needs then 'needs_research' else 'passed' end;
    ihash := substr(md5(r.market_id::text||v_version||coalesce(vol::text,'-')||coalesce(cpc::text,'-')||coalesce(pop::text,'-')||coalesce(income::text,'-')), 1, 16);

    insert into rros_candidates (id, market_id, qualification_version, result, reasons, confidence, input_hash, research_status)
    values (rros_id('candidate:'||r.market_id||'|'||v_version||'|'||ihash), r.market_id, v_version, res,
            reasons || jsonb_build_array(jsonb_build_object('gate','preliminary_score','outcome','info','detail', greatest(0, least(100, score))::text)),
            conf, ihash, 'none')
    on conflict (market_id, qualification_version, input_hash) do update set reasons=excluded.reasons, confidence=excluded.confidence, result=excluded.result;

    update rros_markets set research_state = case when res='passed' then 'qualified' when res='failed' then 'rejected' else research_state end,
                            last_researched_at = now()
    where id = r.market_id;

    if res='passed' then n_pass := n_pass + 1;
    elsif res='failed' then n_fail := n_fail + 1;
    else n_needs := n_needs + 1; end if;
  end loop;

  update rros_jobs set status='completed', completed_at=now(),
    progress = jsonb_build_object('passed', n_pass, 'needs_research', n_needs, 'failed', n_fail)
  where id = v_job;

  return jsonb_build_object('passed', n_pass, 'needs_research', n_needs, 'failed', n_fail);
end
$fn$;
