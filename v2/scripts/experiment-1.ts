// EXPERIMENT 1: first real research funnel (Stage 1→4, cheap-first, ≤$1).
// Purpose: contrast dataset for A–I scoring design — NOT a portfolio pick.
// Gates are TEMPORARY (gate-v1), versioned, recorded per candidate; not investment scores.
// Run: npx vite-node scripts/experiment-1.ts
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { serpUrl, parseSerpResponse, autocompleteUrl, parseAutocompleteResponse } from "../lib/providers/serpapi";
import { DFS_VOLUME_URL, volumeRequest, parseVolumeResponse } from "../lib/providers/dataforseo";
import { extractSignals } from "../lib/serp/signals";

const GATE_VERSION = "gate-v1";
const SIGNALS_VERSION = "signals-v1";
const SERP_COST = 0.015, AC_COST = 0.015, DFS_COST = 0.08;
const store = createSupabaseStore();
const KEY = process.env.SERPAPI_KEY!, DFS = process.env.DATAFORSEO_AUTH!;
const OUTDIR = new URL("../../out/experiment-1/", import.meta.url);
mkdirSync(new URL("raw/", OUTDIR), { recursive: true });

type Cand = { id: string; strata: string; niche: string; city: string; state: string; query: string; ac: string; domain: string; v0?: any };
const v0 = JSON.parse(readFileSync(new URL("../../out/opportunities.json", import.meta.url), "utf8"));
const byKey = new Map(v0.map((r: any) => [`${r.nicheId}|${r.city}|${r.state}`, r]));
const V = (nid: string, c: string, s: string, strata: string) => {
  const r: any = byKey.get(`${nid}|${c}|${s}`);
  return { id: `${nid}|${c}|${s}`, strata, niche: nid, city: c, state: s,
    query: `${r?.niche || nid} ${c} ${s}`, ac: `${(r?.niche || nid).toLowerCase()} ${c.toLowerCase().slice(0, 4)}`,
    domain: `${c.toLowerCase().replace(/[^a-z]/g, "")}${nid.replace(/-/g, "").slice(0, 14)}.com`, v0: r };
};
const N = (nid: string, label: string, community: string, city: string, strata: string) => ({
  id: `${nid}|${community}|TX`, strata, niche: nid, city: community, state: "TX",
  query: `${label} ${community} ${city} TX`, ac: `${label.toLowerCase()} ${community.toLowerCase().slice(0, 6)}`,
  domain: `${community.toLowerCase().replace(/[^a-z]/g, "")}${nid.replace(/-/g, "").slice(0, 12)}.com`, v0: undefined });

const candidates: Cand[] = [
  // 8 historically strong V0
  V("appliance-repair", "Meridian", "ID", "v0-strong"), V("appliance-repair", "Prosper", "TX", "v0-strong"),
  V("dumpster-rental", "Frisco", "TX", "v0-strong"), V("dumpster-rental", "Conroe", "TX", "v0-strong"),
  V("mold-remediation", "Franklin", "TN", "v0-strong"), V("outdoor-kitchens", "McKinney", "TX", "v0-strong"),
  V("auto-glass", "Erie", "CO", "v0-strong"), V("appliance-repair", "Wilmington", "DE", "v0-strong"),
  // 6 historically weak/trap V0 (incl. the water-softener false positive + franchise-held epoxy)
  V("water-softeners", "Carmel", "IN", "v0-weak"), V("epoxy-garage-floors", "Prosper", "TX", "v0-weak"),
  V("landscape-lighting", "Celina", "TX", "v0-weak"), V("fencing", "Cedar Park", "TX", "v0-weak"),
  V("sewer-line-repair", "Frisco", "TX", "v0-weak"), V("gutter-installation", "New Braunfels", "TX", "v0-weak"),
  // 6 high-ticket
  V("outdoor-kitchens", "Port St Lucie", "FL", "high-ticket"), V("mold-remediation", "Portland", "ME", "high-ticket"),
  V("retaining-walls", "Mansfield", "TX", "high-ticket"), V("artificial-turf", "Queen Creek", "AZ", "high-ticket"),
  V("deck-building", "Flower Mound", "TX", "high-ticket"), V("custom-closets", "Celina", "TX", "high-ticket"),
  // 4 strong-demand hard-SERP
  V("dumpster-rental", "Kansas City", "KS", "hard-serp"), V("appliance-repair", "Orlando", "FL", "hard-serp"),
  V("dumpster-rental", "Orlando", "FL", "hard-serp"), V("auto-glass", "Richmond", "VA", "hard-serp"),
  // 12 North Texas Community x Service hypotheses (emerging-community cluster)
  N("pool-builder", "pool builder", "Windsong Ranch", "Prosper", "community"), N("artificial-turf", "artificial turf", "Windsong Ranch", "Prosper", "community"),
  N("outdoor-kitchens", "outdoor kitchen", "Light Farms", "Celina", "community"), N("epoxy-garage-floors", "epoxy garage floor", "Light Farms", "Celina", "community"),
  N("pergolas", "pergola builder", "Star Trail", "Prosper", "community"), N("landscape-lighting", "landscape lighting", "Star Trail", "Prosper", "community"),
  N("pool-builder", "pool builder", "Mustang Lakes", "Celina", "community"), N("artificial-turf", "artificial turf", "Mustang Lakes", "Celina", "community"),
  N("outdoor-kitchens", "outdoor kitchen", "Fields", "Frisco", "community"), N("landscape-lighting", "landscape lighting", "Fields", "Frisco", "community"),
  N("epoxy-garage-floors", "epoxy garage floor", "Painted Tree", "McKinney", "community"), N("pergolas", "pergola builder", "Painted Tree", "McKinney", "community"),
  // 4 intentionally questionable (avoid-list / low-ticket controls)
  N("garage-door-repair", "garage door repair", "Allen", "Allen", "questionable"),
  N("pressure-washing", "pressure washing", "Frisco", "Frisco", "questionable"),
  N("solar-installation", "solar panel installation", "Frisco", "Frisco", "questionable"),
  N("house-cleaning", "house cleaning", "McKinney", "McKinney", "questionable"),
];

const decisions: any[] = [];
const dec = (c: Cand, stage: number, action: string, reason: string) =>
  decisions.push({ id: c.id, strata: c.strata, stage, action, reason, gate: GATE_VERSION });

// ---- STAGE 1 (free): attach existing V0 evidence ----
for (const c of candidates) {
  const g = c.v0?.signals || {};
  (c as any).vol = typeof g.volume === "number" ? g.volume : null;
  (c as any).floor = typeof g.demandFloor === "number" ? g.demandFloor : null;
  dec(c, 1, "evidence-attached", c.v0 ? `v0: vol=${(c as any).vol} floor=${(c as any).floor}` : "no prior evidence (fresh hypothesis)");
}

// ---- STAGE 2 (free gate): who needs cheap demand data; nobody rejected yet ----
const needVol = candidates.filter((c: any) => c.vol === null);
for (const c of candidates) {
  if ((c as any).vol === null) dec(c, 2, "advance-stage3", "no demand evidence -> cheap volume first");
  else dec(c, 2, "advance-stage4-eligible", "prior demand evidence exists");
}

// ---- STAGE 3 (cheap paid): DataForSEO volume/CPC for evidence-less candidates ----
const run3 = await store.beginRun("exp1-volume", `exp1-vol-v2-${needVol.length}`, { stage: 3, budgetCapUsd: 0.2 });
if (!(run3.existing && run3.run.status === "completed")) {
  await store.charge(run3.run.id, "dataforseo", needVol.length, DFS_COST);
  const kws = needVol.map((c) => c.query.toLowerCase().replace(/ tx$/, "").replace(/[^a-z0-9 ]/g, ""));
  const res = await fetch(DFS_VOLUME_URL, { method: "POST", headers: { authorization: `Basic ${DFS}`, "content-type": "application/json" }, body: volumeRequest(kws).body });
  const raw = await res.json();
  writeFileSync(new URL("raw/dfs-volume.json", OUTDIR), JSON.stringify(raw));
  const vols = parseVolumeResponse(raw, kws);
  const obs: any[] = [];
  needVol.forEach((c: any, i) => {
    const v = (vols as any[]).find((x: any) => x.keyword === kws[i]) || { volume: 0, cpc: null };
    c.vol = v.volume ?? 0; c.cpc = v.cpc;
    obs.push({ subjectType: "market", subjectId: c.id, metric: "kw.volume.exact", value: c.vol, source: "dataforseo", evidenceType: "OBSERVED", confidence: 0.9, observedAt: Date.now(), runId: run3.run.id });
    if (v.cpc > 0) obs.push({ subjectType: "market", subjectId: c.id, metric: "kw.cpc", value: v.cpc, source: "dataforseo", evidenceType: "OBSERVED", confidence: 0.9, observedAt: Date.now(), runId: run3.run.id });
  });
  await store.insertBatch(obs);
  await store.completeRun(run3.run.id, DFS_COST);
}

// ---- STAGE 3.5 gate: select stage-4 survivors (contrast-preserving, recorded) ----
const survivors: Cand[] = [];
for (const c of candidates as any[]) {
  if (c.strata === "community") { survivors.push(c); dec(c, 3, "advance-stage4", "community hypothesis: SERP scarcity is the core evidence sought"); }
  else if (c.strata === "questionable") {
    if (c.vol >= 100) { survivors.push(c); dec(c, 3, "advance-stage4", `questionable but measured demand ${c.vol}/mo — test the avoid-list`); }
    else dec(c, 3, "reject", `questionable + demand ${c.vol}/mo below 100 floor`);
  } else if (["v0-strong", "hard-serp"].includes(c.strata)) {
    if (survivors.filter((s: any) => s.strata === c.strata).length < 4) { survivors.push(c); dec(c, 3, "advance-stage4", "fresh SERP re-verification sample"); }
    else dec(c, 3, "hold", "stratum sample quota reached (evidence retained, no fresh spend)");
  } else if (c.strata === "v0-weak") {
    if (survivors.filter((s: any) => s.strata === "v0-weak").length < 3) { survivors.push(c); dec(c, 3, "advance-stage4", "kept-for-contrast: scoring model needs negatives"); }
    else dec(c, 3, "hold", "contrast quota reached");
  } else if (c.strata === "high-ticket") {
    if (survivors.filter((s: any) => s.strata === "high-ticket").length < 3) { survivors.push(c); dec(c, 3, "advance-stage4", "high-ticket economics sample"); }
    else dec(c, 3, "hold", "stratum sample quota reached");
  }
}

// ---- STAGE 4 (paid): SERP snapshot + derived observations + autocomplete (community) + RDAP (free) ----
const est = survivors.length * SERP_COST + candidates.filter((c) => c.strata === "community").length * AC_COST;
console.log(`Stage 4: ${survivors.length} SERPs + 12 autocomplete ≈ $${est.toFixed(2)} (cap 0.9)`);
const run4 = await store.beginRun("exp1-serp", `exp1-serp-v2-${survivors.length}`, { stage: 4, budgetCapUsd: 0.9 });
if (!(run4.existing && run4.run.status === "completed")) {
  for (const c of survivors as any[]) {
    try {
      await store.charge(run4.run.id, "serpapi", 1, SERP_COST);
      const res = await fetch(serpUrl(c.query, `${c.strata === "community" ? c.query.split(" ").slice(-2, -1)[0] + ", Texas" : c.city + ", " + c.state}, United States`, KEY));
      const raw = await res.json();
      const evFile = `serp-${c.id.replace(/[^a-z0-9]/gi, "_")}.json`;
      writeFileSync(new URL(`raw/${evFile}`, OUTDIR), JSON.stringify(raw));
      const parsed = parseSerpResponse(raw);
      const g: any = extractSignals(parsed as any, c.city);
      const base = { subjectType: "market", subjectId: c.id, source: `serpapi:${SIGNALS_VERSION}:${evFile}`, evidenceType: "DERIVED" as const, confidence: 0.85, observedAt: Date.now(), runId: run4.run.id };
      const m: [string, number | null][] = [
        ["serp.directory.count", g.directoriesInTop3], ["serp.franchise.count", g.franchisesInTop3],
        ["serp.out_of_town.count", g.outOfTownInTop3], ["serp.inner_page.count", g.innerPagesInTop5],
        ["serp.intent_mismatch.count", g.intentMismatchInTop5], ["serp.title_targeting.count", g.top3TitlesMissingCity],
        ["serp.ads.count", g.adCount], ["serp.map_pack.count", g.mapPackSize],
        ["serp.map_pack.avg_reviews", g.avgMapReviews], ["serp.map_pack.no_website.count", g.mapListingsWithoutWebsite],
      ];
      await store.insertBatch(m.filter(([, v]) => typeof v === "number").map(([metric, value]) => ({ ...base, metric, value: value as number })));
      c.signals = g;
      // free RDAP for the hypothesis EMD
      try {
        const rd = await fetch(`https://rdap.verisign.com/com/v1/domain/${c.domain}`);
        const avail = rd.status === 404;
        await store.insertBatch([
          { ...base, metric: "domain.available.count", value: avail ? 1 : 0, evidenceType: "OBSERVED", source: "rdap" },
          { ...base, metric: "domain.pick", value: c.domain, evidenceType: "DERIVED", source: `rdap:candidate-v1` },
        ]);
        c.domainAvailable = avail;
      } catch { /* rdap fail non-fatal */ }
    } catch (e: any) { dec(c, 4, "collector-error", e.message.slice(0, 80)); }
  }
  // autocomplete demand floor for community hypotheses
  for (const c of candidates.filter((x) => x.strata === "community") as any[]) {
    try {
      await store.charge(run4.run.id, "serpapi", 1, AC_COST);
      const res = await fetch(autocompleteUrl(c.ac, KEY));
      const raw = await res.json();
      writeFileSync(new URL(`raw/ac-${c.id.replace(/[^a-z0-9]/gi, "_")}.json`, OUTDIR), JSON.stringify(raw));
      const r: any = parseAutocompleteResponse(raw, c.ac, c.city);
      await store.insertBatch([{ subjectType: "market", subjectId: c.id, metric: "kw.autocomplete.floor", value: r.floor ?? r, source: "serpapi:autocomplete", evidenceType: "DERIVED", confidence: 0.7, observedAt: Date.now(), runId: run4.run.id }]);
      c.acFloor = r.floor ?? r;
    } catch (e: any) { dec(c, 4, "ac-error", e.message.slice(0, 60)); }
  }
  const spent = await store.spent(run4.run.id);
  await store.completeRun(run4.run.id, spent);
}
writeFileSync(new URL("decisions.json", OUTDIR), JSON.stringify(decisions, null, 1));
writeFileSync(new URL("candidates.json", OUTDIR), JSON.stringify(candidates, null, 1));
console.log(`DONE. candidates=${candidates.length} survivors=${survivors.length}`);
for (const c of survivors as any[]) console.log(`${c.strata} | ${c.id} | vol=${c.vol} | map=${c.signals?.mapPackSize}x${c.signals?.avgMapReviews} dirs=${c.signals?.directoriesInTop3} | domain ${c.domainAvailable === true ? "OPEN" : c.domainAvailable === false ? "taken" : "?"} | acFloor=${c.acFloor ?? "-"}`);
