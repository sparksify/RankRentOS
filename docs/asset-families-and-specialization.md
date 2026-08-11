# Asset Families & Subniche Specialization
### RankRentOS V2 capability · 2026-08 · implements the Industry → Service → Geography model

## Why this exists
Opportunities were previously only `Niche × City`. Practitioner evidence (the
"subniche-inside-a-dead-niche" play: stump grinding vs tree service, hydro
jetting vs plumbing) shows specialist hypotheses can beat generalists — but
this is a **hypothesis to test per-market with SERP evidence, not an SEO law**.
This capability separates *opportunity discovery* (how big is the space?) from
*deployment strategy* (build ONE evidence-backed experiment at a time).

## Model
- **Industry → Service/Subniche** taxonomy: `data/industries.json`. Each service:
  canonical id, label, `parentService` (null = top-level service), aliases,
  `source: seed | evidence`. Seed lists are the bootstrap; long-term entries are
  discovered from evidence (see Progressive Research).
- **Hypothesis typing** (`hypothesisType`): `broad` (niche not in taxonomy) ·
  `service` (top-level, e.g. Roofing × Kansas City) · `specialist`
  (has parentService, e.g. Metal Roofing × Kansas City). Stamped onto every
  opportunity row; existing scoring untouched.
- **Asset Family** (`buildFamilies`): industry (or standalone niche) × geographic
  cluster of scored markets, ≥2 members. The family is the *opportunity space*;
  members are child hypotheses. v1 limitation (documented): metro adjacency is
  approximated by state until PostGIS geography lands per ARCHITECTURE.md.
- **Cluster Expansion Potential** (`clusterExpansionPotential`, 0–100):
  rewards *independently viable* members (overall ≥45), distinct geographies,
  distinct services, and aggregate rent ceiling — explicitly NOT raw town count
  (tested). Returns explainable components + `familyConfidence` derived from
  member data confidence, kept separate from strength (tested). Family scores
  never mutate member scores (tested). Stored as separate metadata — not folded
  into the A–I dimensions.
- **Specialization Opportunity** (`specializationOpportunity`, 0–100, 50=neutral):
  evidence-backed specialist-vs-parent comparison in the same geography:
  SERP-weakness delta, distinct demand share, CPC premium, competitor content
  gap. Missing evidence → null components, lower confidence — values are never
  invented (tested). Deterministic (tested). AI may normalize evidence upstream;
  it cannot compute or override these scores (no AI calls exist in scoring code).
- **First experiment** (`recommendFirstExperiment`): confidence-weighted
  asymmetry ranking → one pick + reasons + expansion candidates #2–5.

## Relationship to existing scoring
Rankability / Asset Value / Arbitrage / Overall / Confidence are unchanged.
Specialist hypotheses flow through the SAME scoring pipeline (they're niches
with parent links). Family CEP and Specialization Opportunity are supporting
dimensions alongside, preserving explainability.

## Progressive research (anti-combinatorial-explosion)
1. **Stage 1 (free):** `discoverSubnicheCandidates` mines related_searches/PAA
   from already-cached raw SERP payloads (proved in first run: surfaced "dryer
   vent cleaning" as an appliance-adjacent subniche from existing data).
   LLM proposal is an allowed additional Stage-1 source (classification only).
2. **Stage 2 (free):** `qualifiesForDeepResearch` gate — demand evidence or a
   strong scanned parent + ≥2 evidence signals required (tested).
3. **Stage 3 (cheap):** DataForSEO volume/CPC on qualifiers (~$0.0004/kw).
4. **Stage 4 (moderate):** SERP + autocomplete + CI only on Stage-3 survivors.
5. **Stage 5:** lens scoring + family assembly + experiment selection.

## Test → Learn → Expand
Experiment outcomes land in `site_outcomes` (migration 002) keyed to the
market; success raises confidence on sibling hypotheses in the family,
failure lowers confidence on related *specialist-service* hypotheses without
auto-rejecting the family. (Feedback propagation itself is deferred; the data
model supports it now.)

## Explicitly NOT assumed
Specialists always outrank generalists · exact-match domains auto-win · every
town/subservice deserves a site · microsites rank faster · network footprints
auto-penalize. All such claims must arrive as per-market SERP evidence.

## Files
`data/industries.json` · `src/families.js` · `src/families.test.js` (9 tests)
· output: `out/families.json`, hypothesis typing stamped into
`out/opportunities.json`. UI: deferred (families render from families.json
when the Opportunities surface lands per ARCHITECTURE §14).
