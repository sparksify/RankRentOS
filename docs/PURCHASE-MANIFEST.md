# Wave 1 Purchase Manifest — Every $12 Has a Job

**22 domains · ~$267.96 · 8 REVENUE BETS · 14 EXPERIMENTAL BETS**
Labeled *before* purchase, per Steve's rule: a good $12 experiment is not the same thing as a good rank-and-rent asset, and nothing below is allowed to blur that line. This manifest is consumed by the v5 freeze; the labels flow into the asset specs and the cockpit.

The chain being tested, with six conversions hiding in it:
**rankable → ranks → impressions → clicks → calls → qualified leads → renter pays → renter STAYS.**
Pre-launch research covers only the first link. The other six are what the $268 buys. The last one — renter durability — is now instrumented (`asset.renter.churned.date`, `asset.renter.complaints`, `asset.renter.retention.months`), because the real objective is **boring recurring revenue**, and the worst outcome isn't failing to rank — it's accidentally rebuilding an agency with 40 contractors to babysit.

---

## REVENUE BETS (8) — judged on money, killed on money

Known concentration risk, accepted with eyes open: all eight sit in two vertical families (remodeling, windows), because those were the only families that passed every gate. This is a portfolio flaw to fix in Wave 2 with transactional winners — not by relaxing gates now. Also noted: remodeling leads have slow, murky feedback (a renter may call five un-closed leads "tire kickers" before the first one signs months later) — renter-complaint tracking exists for exactly this.

| Domain | Hypothesis | Day-180 verdict |
|---|---|---|
| `bathroomremodelingofarvada.com` | Measured demand (390/mo) + soft organic SERP (62) + 3 viable renters ⇒ qualified leads within 180 days | Top-20 + ≥1 lead, or kill |
| `windowreplacementmidland.com` | The model's sleeper: A said 40, organic said 62. Ranks despite the old model's dismissal | Same |
| `windowreplacementtemecula.com` | 140/mo, organic 58, clean intent ⇒ rankable and rentable | Same |
| `windowreplacementvancouverwa.com` | Diluted intent (0 local operators in top 5) is an opening, not a warning | Same — weakest of the eight; watch conversion |
| `kitchenremodelingfriscotx.com` | 170/mo in a wealthy metro + F=66 economics beat a contested SERP | Same |
| `bathroomremodelingtemecula.com` | Promoted reserve: F=66 economics justify a slightly harder SERP (50) | Same |
| `windowreplacementdublinca.com` | Promoted reserve: organic 57 in an affluent CA market | Same |
| `bathroomremodelingogden.com` | Promoted reserve: cheapest CPC path to remodel leads | Same |

## EXPERIMENTAL BETS — Sprinkler arm (8 domains) — judged on information, not P&L

The bear case, stated up front so Search Console can settle it: *nobody types "sprinkler repair Sutton Fields" — they type "sprinkler repair near me" standing inside Sutton Fields, and Google already knows where they are.* If that's how search works, our neighborhood EMDs rank #1 for queries nobody types. The most valuable output of these sites may not be leads — it's **unexpected query impressions**, which is why the `unpredicted` query role was pre-registered as first-class instrumentation. If `sprinklerrepairsuttonfields.com` starts pulling impressions for *"sprinkler repair celina"*, that's a bigger finding than the neighborhood query existing.

| Domain | Hypothesis | Day-180 verdict |
|---|---|---|
| `sprinklerrepairoffrisco.com` | City control, 390/mo measured — calibrates whether tool volume predicts impressions | Control — judged as reference |
| `sprinklerrepairofmckinney.com` | City control, 320/mo, organic-viable (70) — the one sprinkler site with a real revenue path (~$576/mo modelled GP) | Control + revenue upside |
| `sprinklerrepairprospertx.com` | City control, 10/mo — tests city-level under-measurement | Control |
| `sprinklerrepairsuttonfields.com` | Tools undercount master-planned-community search; neighborhood relevance may capture broader Celina queries | ≥100 impressions/mo or ≥1 call ⇒ thesis lives; #1 with ~11 impressions ⇒ standalone-neighborhood thesis dies |
| `paintedtreesprinklerrepair.com` | Same, McKinney's largest MPC *(first-choice domain was registered by someone else the same day we shortlisted it)* | Same |
| `sprinklerrepairsandbrockranch.com` | Same, Denton Co | Same |
| `sprinklerrepairstartrail.com` | Same, Prosper ISD | Same |
| `sprinklerrepairnorthtexas.com` | HUB: two community pages (Trinity Falls, Union Park) test whether a regional domain beats standalone EMDs — which also probes the EMD-leverage question below | Exploratory: hub pages vs standalone on time-to-impressions |

**The EMD question rides along free:** this set mixes exact-match (`sprinklerrepairsuttonfields.com`), partial (`...offrisco.com`), reversed (`paintedtree...`), and hub-path architectures. If they perform identically, the $12 name isn't the moat — architecture, content, citations and time are — and Wave 2 stops paying premiums for exact matches.

## EXPERIMENTAL BETS — Model validation (6 domains) — some are *deliberately bad assets*

These are good experiments about potentially bad assets. If all six lose money but return clean answers, **they succeeded.**

| Domain | What it's deliberately testing | Clean answer looks like |
|---|---|---|
| `metalroofingrochester.com` | Our two rankability models disagree by 56 points (A=76, organic=20) | Whichever model predicted the ranking outcome becomes the model |
| `basementwaterproofingofnaperville.com` | Independent replicate of the same disagreement (Δ49) | Two replicates make it a conclusion, not an anecdote |
| `bathroomremodelingbellevuene.com` | Whether our 2,400/mo is contaminated by Bellevue, WA | Search Console attribution of the shared-name volume |
| `housecleaningoforlando.com` | Huge demand (2,900/mo) vs deliberately bad economics (~$10/lead) | Does volume beat the rentability floor, or validate it |
| `kitchenremodelingrockvillemd.com` | Best renter depth we found (E=100) vs a hostile SERP (organic 24) | Can renter depth ever rescue rankability |
| `appliancerepairofaurora.com` | The V0 commodity-service thesis vs V2's rejection of it | Which generation of the model was right |

---

## Standing cautions (part of the record, not fine print)

1. **Pre-launch scores are educated proxies. Google hasn't agreed with any of them yet.** That's the point of the $268 — and the reason not to bet $25,000 on these selections today.
2. **SEO working ≠ rank-and-rent working.** Twelve sites ranking and eight producing leads can still fail on renter willingness-to-pay, churn, unanswered phones, and handholding. Renter durability is now a first-class measured outcome, and "can this become boring recurring revenue?" is the graduation criterion for Wave 2 — not "did it rank."
3. **Deployment must stay cheap.** No months of handcrafting. A failure must cost roughly: $12 domain + a little infrastructure + compute + six months of observation. At that cost of experimentation, RankRentOS can be wrong often and still compound — the business is the asymmetry, not the hit rate.
