# Wave 1 — Revised Portfolio (v3): Matched Architecture Experiment

**Date:** 2026-08-12 · **Machine-readable:** `out/wave-1-experiment/portfolio-v2.json` (version `wave1-v3-matched-architecture`)
**Models:** Dimension A `ai-v1.0.0` (untouched) · organic `organic-v1.2` · buckets `buckets-1.1.0`
**Research spend for this amendment: $0.00** (all reparsing of SERPs already held, plus free RDAP)
**Nothing purchased. Nothing deployed.**

---

## 1–3. Final counts

| | |
|---|---|
| **Rankable assets (pages)** | **27** |
| **Websites** | **22** (21 standalone domains + 1 shared regional hub) |
| **Domains required** | **22** |

| Cohort | Count | Type |
|---|---|---|
| **A — Best-evidence / exploitation** | 6 | standalone city sites |
| **B1 — NTX pool, STANDALONE** | 6 | standalone hyperlocal domains |
| **B2 — NTX pool, REGIONAL HUB** | 6 | pages on ONE domain (`poolbuildersnorthtexas.com`) |
| **B3 — City controls** | 3 | standalone city sites |
| **C — Model validation / contrarian** | 6 | standalone city sites, labelled EXPERIMENTAL |

The count was not targeted. It is what the stated standards produced.

---

## 4–6. What changed and why

**Removed (15).** Ten city assets — Kirkland, Bellevue WA & NE kitchen, Orlando kitchen, Temecula bathroom, Naperville & Amarillo window, Chandler & Bellevue water damage, Orlando stucco — all failed the organic standard once map-pack credit was removed (organic 12–48 against a ≥55 bar). Four communities — Windsong Ranch (38), Light Farms (39), Mustang Lakes (39), Canyon Falls (37) — are organically brutal: an incumbent already holds the community slot. Mold Remediation Knoxville was superseded by a cleaner test of the same "hard SERP / strong economics" question.

**Added (15).** Six genuinely new city assets that organic-first selection surfaced and Dimension A had overlooked: Conroe TX (organic 67, A=91), Arvada CO (62), Midland TX (62, A=40 — A had written it off), Temecula CA window (58), Vancouver WA (57), Frisco TX kitchen (56). Eight communities with materially better organic positions: Sutton Fields (82), Legacy Gardens (79), Union Park (73), Mosaic (67), Newman Village (65), Stonebridge Ranch (63), Trinity Falls (60), Cambridge Crossing (57). Plus McKinney as a third city control to complete the demand gradient.

**Why:** the previous Core cohort was selected on Dimension A, which awards up to +20 points for a weak map pack — credit an organic-only site cannot earn. Removing that credit reversed the ranking. Three of the six new Group-A assets have *lower* Dimension A than assets they replaced; they are here because their organic SERPs are genuinely softer.

---

## 7–8. The NTX matched pairs

Twelve communities, six pairs, matched on organic-v1.2, virgin/incumbent status and community scale, then split across architectures. **S** = standalone hyperlocal domain; **H** = page on the single regional hub.

| Pair | S (standalone) | org | H (hub page) | org | Δ | Why comparable |
|---|---|---|---|---|---|---|
| NTX-P1 | Sutton Fields | 82 | Legacy Gardens | 79 | 3 | both VIRGIN, active-buildout, the two strongest virgin communities |
| NTX-P2 | Sandbrock Ranch | 66 | Star Trail | 67 | 1 | both VIRGIN, 1,400 vs 1,300 homes — the tightest match |
| NTX-P3 | Painted Tree | 73 | Stonebridge Ranch | 63 | 10 | both VIRGIN, **both in McKinney** so parent-city SERP is held constant, both large |
| NTX-P4 | Mosaic | 67 | Union Park | 73 | 6 | both INCUMBENT-targeted, active-buildout, 3,000 vs 2,000 homes |
| NTX-P5 | Newman Village | 65 | Harvest | 64 | 1 | both INCUMBENT-targeted — the tightest incumbent match |
| NTX-P6 | Cambridge Crossing | 57 | Trinity Falls | 60 | 3 | both INCUMBENT-targeted, active-buildout |

**Balance:** S mean organic 68.3 vs H 67.7. Each arm holds exactly 3 virgin and 3 incumbent communities. Held constant across both treatments: service (Pool Builder), metro, visual quality, conversion architecture, content depth, topical coverage, schema, publishing window, indexing workflow, tracking, and optimisation effort. **Neither architecture receives a link or promotion advantage** — that is the whole point.

**City controls** complete the demand gradient: Frisco 320/mo (organic 23) → McKinney 210/mo (39) → Prosper 10/mo (36) → communities 0/mo (57–82).

---

## 9. Strongest expected money-makers

1. **Bathroom Remodeling — Conroe, TX** (W1-A-001): the only Group-A asset that is ORGANIC-VIABLE (67) *and* has A=91, 260/mo and F=51. Both models agree — the rarest condition in the dataset.
2. **Bathroom Remodeling — Arvada, CO** (W1-A-002): 390/mo, F=66, organic 62, A=83. Highest demand in Group A with real economics.
3. **Kitchen Remodeling — Frisco, TX** (W1-A-006): F=66 on a ~$1,050 assumed lead, organic 56.
4. **Sutton Fields / Legacy Gardens pool assets**: organic 82/79 with a $2,125 assumed lead. Highest upside per asset in the portfolio — but demand is unproven, so this is upside, not expectation.

## 10. Highest-information assets

1. **Metal Roofing — Rochester** (A=76 vs organic 20, Δ56) and **Basement Waterproofing — Naperville** (A=77 vs organic 32, Δ45): two independent replicates of the same model test. Together they can settle whether Dimension A's map-pack credit is spurious.
2. **The six NTX matched pairs**: the only way to learn whether architecture matters, and the answer changes every future build decision.
3. **The demand gradient** (320 → 210 → 10 → 0): tests whether keyword-tool volume predicts real impressions at all.
4. **House Cleaning — Orlando** (F=34, 2,900/mo): tests the rentability floor I added in `buckets-1.1.0`.

---

## 11–12. Cost

| | |
|---|---|
| Domains (22 × $12.18) | **$267.96** — known |
| Content + deployment (27 pages × $13) | $351.00 — estimated |
| **Upfront** | **$618.96** |
| Monthly carrying | **$35.50** |
| **Six-month experiment cost** | **$831.96** |
| Twelve-month risk capital | $1,313.40 |

Unknown and deliberately not estimated: deployment-engine per-asset cost, renter acquisition, link/citation acquisition, content revision cycles, and photo-heavy pool content likely exceeding the generic estimate.

The hub architecture is *cheaper per asset* (6 pages share one domain), which is itself a confound — see below.

---

## 13. Known confounders

1. **Hub cost/effort asymmetry.** Six hub pages share one domain, so the hub arm costs less. If the hub wins, part of that may be a shared-domain effect rather than architecture per se.
2. **Parent-city imbalance.** The S arm is Celina-heavy (3 of 6); the H arm has none in Celina but two in Prosper. Only NTX-P3 holds parent city constant.
3. **Community scale imbalance.** H holds ~15,500 homes vs S ~11,500, driven by Stonebridge Ranch (7,000).
4. **Hub self-competition.** The hub's own regional pages may compete with the Frisco/McKinney/Prosper city controls for city-level queries.
5. **Internal linking is unavoidably unequal.** Hub pages get internal links by construction; standalone sites have none. This is intrinsic to the architectures, not a design flaw, but it cannot be separated from the treatment.
6. **Pool seasonality.** Spring/summer peak; a late launch under-reads. City controls share the season and partially absorb this.
7. **Single service, single metro.** The architecture result may not generalise beyond pool builders in North Texas.
8. **n = 6 pairs.** Enough to detect a large effect, not a subtle one.
9. **Stonebridge Ranch and Newman Village are mature communities**; most homes may already have pools, which weakens the new-home trigger.

## 14. Remaining weaknesses in organic-v1

- **Unvalidated.** No live outcome has ever tested it. Its thresholds (65/45) are judgement.
- **Classification is list-based** and therefore incomplete. Three rounds of sanity auditing found real defects each time: substring host matching, national brands and retailers scored as local operators (IKEA, Groupon, Re-Bath, Pella, Ram Jack, Erie Home), and community/developer sites counted as service competitors. More such cases certainly remain in domains I have not inspected.
- **Title-only service evidence.** 25 slots are classified as hard competitors on the strength of their title alone. I inspected these; they are mostly correct, but the rule is weaker than domain evidence.
- **It ignores page-level quality** — backlinks, internal linking, actual content quality, page experience. It reads *who* occupies the slot, not *how strong* that page is.
- **Snippet text is unused**; only titles and hosts are parsed.
- **It cannot see intent shifts** — if Google reinterprets a query, the classification is stale.

## 15. What Wave 1 will teach us that we cannot know today

1. **Whether Dimension A or organic-v1 predicts real ranking.** They correlate at only r=0.30, so at most one can be right. Two ~50-point disagreements are instrumented to settle it.
2. **Whether zero-volume community queries produce real impressions.** No keyword tool can answer this; only live search-console data can.
3. **Whether hyperlocal standalone or regional hub ranks faster** — six matched pairs, the same service, the same build.
4. **Whether keyword-tool volume predicts traffic at all**, via the 320 → 210 → 10 → 0 gradient.
5. **The four economic actuals** (CPL, lead value, close rate, ticket) that currently carry D and F as HUMAN_ASSUMED.
6. **Whether the virgin/incumbent distinction predicts outcomes** as strongly as it predicts organic softness.
7. **Whether the $300/mo rentability floor is correctly placed.**

Every asset carries an `experimentId` that joins pre-launch evidence → deployment → ranking → traffic → leads → rentability, so all of the above become analysable rather than anecdotal.

---

## Sanity audit performed on this build

The organic top-5 of **all 27 proposed assets** was inspected programmatically. 25 classification flags were reviewed individually; the material errors found and fixed were: IKEA and Groupon scored as local service competitors, national/franchise operators (Re-Bath, Pella, Ram Jack, Erie Home, West Shore Home) scored as independent locals, and community/developer domains (unionparkbyhillwood.com, mosaiclivingtx.com) scored as pool competitors because their amenity pages mention pools.

One fix I initially made was **too broad** — treating any geo-named domain as a community site would have misclassified `bluewaterplano.com`, plausibly a real Plano pool company. The rule now applies only to community geographies, where a distinctive community name in a domain reliably indicates the community's own site. Regression tests cover both directions.

These corrections *raised* several scores. That is a consequence of fixing evidence-based misclassification, not of moving thresholds: `A_MIN_ORG = 55`, `A_MIN_F = 50`, `A_MIN_VOL = 100` were set before the corrections and never changed.

**Next step requires your approval: 22 domains (~$268). I will not purchase them.**
