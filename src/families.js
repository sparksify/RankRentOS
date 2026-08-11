// Asset Families & Subniche Specialization (see docs/asset-families-and-specialization.md)
// Deterministic, evidence-first, explainable. AI may classify/normalize evidence
// upstream; it never computes these scores.
//
// CLI: node src/families.js  -> builds out/families.json from out/opportunities.json
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { ROOT } from "./env.js";

// ---------- Hypothesis typing ----------
// specialist = niche is a service with a parent industry (and optionally parent service)
export function hypothesisType(nicheId, industries) {
  for (const ind of Object.values(industries)) {
    const svc = ind.services?.find((s) => s.id === nicheId);
    if (svc) return svc.parentService ? "specialist" : "service";
  }
  return "broad";
}

export function industryOf(nicheId, industries) {
  for (const [key, ind] of Object.entries(industries))
    if (ind.services?.some((s) => s.id === nicheId)) return key;
  return null;
}

// ---------- Stage-1 (free): subniche candidates from cached SERP evidence ----------
// Mines related_searches + PAA from raw payloads already on disk. No API cost.
export function discoverSubnicheCandidates(rawDir = join(ROOT, "data", "cache", "raw"), limitFiles = 400) {
  if (!existsSync(rawDir)) return {};
  const counts = {};
  const files = readdirSync(rawDir).slice(0, limitFiles);
  for (const f of files) {
    try {
      const d = JSON.parse(readFileSync(join(rawDir, f), "utf8"));
      const qs = [
        ...(d.related_searches || []).map((r) => r.query),
        ...(d.related_questions || []).map((r) => r.question),
      ].filter(Boolean);
      for (const q of qs) {
        const norm = q.toLowerCase().replace(/[^a-z ]/g, "").trim();
        if (norm.split(" ").length >= 2 && norm.split(" ").length <= 6)
          counts[norm] = (counts[norm] || 0) + 1;
      }
    } catch { /* skip unparseable */ }
  }
  // candidates seen across >=3 independent SERPs = real query patterns, not noise
  return Object.fromEntries(Object.entries(counts).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]));
}

// ---------- Stage-2 gate (cheap filter before any paid research) ----------
export function qualifiesForDeepResearch(h) {
  // must have SOME evidence of demand or a scored parent worth specializing from
  const vol = h.vol ?? h.signals?.volume ?? 0;
  if (vol >= 30) return true;
  if (h.parentScore !== undefined && h.parentScore >= 45 && h.evidenceCount >= 2) return true;
  return false;
}

// ---------- Specialization Opportunity (evidence-backed comparison) ----------
// Compares a specialist hypothesis against its scanned parent in the SAME geography.
// Returns null components + low confidence when evidence is missing — never invents.
export function specializationOpportunity(specialist, parent) {
  const components = {};
  let pts = 0, evidence = 0;
  if (specialist?.rankability !== undefined && parent?.rankability !== undefined) {
    components.serpWeaknessDelta = specialist.rankability - parent.rankability;
    pts += Math.max(-20, Math.min(30, components.serpWeaknessDelta));
    evidence++;
  } else components.serpWeaknessDelta = null;
  const sv = specialist?.signals?.volume, pv = parent?.signals?.volume;
  if (sv !== undefined && pv !== undefined && pv > 0) {
    components.distinctDemandShare = Math.round((sv / pv) * 100) / 100;
    if (sv >= 30) { pts += Math.min(20, Math.round(20 * Math.min(sv / pv, 1))); evidence++; }
  } else components.distinctDemandShare = null;
  const sc = specialist?.signals?.cpc, pc = parent?.signals?.cpc;
  if (sc && pc) {
    components.cpcPremium = Math.round((sc / pc) * 100) / 100;
    if (sc > pc) pts += 10;
    evidence++;
  } else components.cpcPremium = null;
  if (specialist?.signals?.competitorAvgWords !== undefined && parent?.signals?.competitorAvgWords !== undefined) {
    components.specialistContentGap = parent.signals.competitorAvgWords - specialist.signals.competitorAvgWords;
    if (components.specialistContentGap > 200) pts += 10;
    evidence++;
  } else components.specialistContentGap = null;

  const score = Math.max(0, Math.min(100, 50 + pts)); // 50 = no advantage either way
  const confidence = evidence >= 3 ? "medium" : evidence >= 1 ? "low" : "none";
  return { score: evidence === 0 ? null : score, components, evidenceCount: evidence, confidence };
}

// ---------- Asset Family construction ----------
// v1 family = industry (or standalone niche) x state cluster of scored cities.
// Documented limitation: metro adjacency is approximated by state until PostGIS lands.
export function buildFamilies(opportunities, industries) {
  const fams = new Map();
  for (const o of opportunities) {
    const ind = industryOf(o.nicheId, industries);
    const famKey = `${ind || o.nicheId}|${o.state}`;
    if (!fams.has(famKey)) fams.set(famKey, {
      id: famKey, industry: ind || null, label: `${ind ? industries[ind].label : o.niche} — ${o.state}`,
      state: o.state, members: [],
    });
    fams.get(famKey).members.push(o);
  }
  return [...fams.values()].filter((f) => f.members.length >= 2);
}

// ---------- Cluster Expansion Potential (deterministic, explainable) ----------
export function clusterExpansionPotential(family) {
  const viable = family.members.filter((m) => (m.overallOpportunity || 0) >= 45);
  const geos = new Set(viable.map((m) => m.city));
  const services = new Set(viable.map((m) => m.nicheId));
  const totalRentHigh = viable.reduce((s, m) => s + (m.rentHigh || 0), 0);
  const confidences = viable.map((m) => m.dataConfidence);
  const components = {
    viableMembers: viable.length,
    independentGeos: geos.size,
    independentServices: services.size,
    aggregateRentCeiling: totalRentHigh,
    renterOverlap: geos.size >= 2 && services.size >= 1 ? "plausible-single-renter" : "single-market",
  };
  // score: breadth of INDEPENDENTLY viable members, not raw town count
  let pts = Math.min(viable.length * 8, 40) + Math.min((geos.size - 1) * 8, 24) + Math.min((services.size - 1) * 10, 20);
  if (totalRentHigh >= 3000) pts += 16; else if (totalRentHigh >= 1500) pts += 8;
  const score = Math.max(0, Math.min(100, pts));
  const familyConfidence = confidences.includes("high") ? "medium-high"
    : confidences.filter((c) => c === "medium").length >= 2 ? "medium" : "low";
  return { score, components, familyConfidence };
}

// ---------- First-experiment selection (highest asymmetry) ----------
export function recommendFirstExperiment(family) {
  const ranked = [...family.members].sort((a, b) => {
    const conf = { high: 1.0, medium: 0.85, low: 0.6 };
    const asym = (m) => (m.overallOpportunity || 0) * (conf[m.dataConfidence] || 0.6) + (m.rankability || 0) * 0.3;
    return asym(b) - asym(a);
  });
  const pick = ranked[0];
  if (!pick) return null;
  const why = [];
  if ((pick.rankability || 0) >= 60) why.push(`weak organic competition (rankability ${pick.rankability})`);
  if ((pick.signals?.volume || 0) >= 100) why.push(`measured demand ${pick.signals.volume}/mo`);
  if ((pick.rentHigh || 0) >= 1000) why.push(`rent ceiling $${pick.rentHigh}/mo`);
  if (pick.dataConfidence !== "low") why.push(`${pick.dataConfidence} data confidence`);
  why.push("fast expected time-to-signal vs siblings");
  return { pick, why, expansionCandidates: ranked.slice(1, 5).map((m) => `${m.niche} × ${m.city}`) };
}

// ---------- CLI ----------
if (process.argv[1]?.endsWith("families.js")) {
  const industries = JSON.parse(readFileSync(join(ROOT, "data", "industries.json"), "utf8"));
  const opps = JSON.parse(readFileSync(join(ROOT, "out", "opportunities.json"), "utf8"));
  for (const o of opps) { o.hypothesisType = hypothesisType(o.nicheId, industries); o.industry = industryOf(o.nicheId, industries); }
  const families = buildFamilies(opps, industries).map((f) => {
    const cep = clusterExpansionPotential(f);
    const exp = recommendFirstExperiment(f);
    return { id: f.id, label: f.label, industry: f.industry, state: f.state,
      memberCount: f.members.length, expansion: cep,
      firstExperiment: exp ? { market: `${exp.pick.niche} × ${exp.pick.city}, ${exp.pick.state}`, why: exp.why, expansionCandidates: exp.expansionCandidates } : null,
      members: f.members.map((m) => ({ niche: m.niche, city: m.city, type: m.hypothesisType, overall: m.overallOpportunity, strategy: m.strategy, confidence: m.dataConfidence })),
    };
  }).sort((a, b) => b.expansion.score - a.expansion.score);
  writeFileSync(join(ROOT, "out", "families.json"), JSON.stringify(families, null, 2));
  writeFileSync(join(ROOT, "out", "opportunities.json"), JSON.stringify(opps, null, 2));
  console.log(`families: ${families.length} (from ${opps.length} hypotheses)`);
  for (const f of families.slice(0, 6)) {
    console.log(`\nCEP ${f.expansion.score} | ${f.label} | ${f.memberCount} hypotheses, ${f.expansion.components.viableMembers} viable, rent ceiling $${f.expansion.components.aggregateRentCeiling}/mo | conf ${f.expansion.familyConfidence}`);
    if (f.firstExperiment) console.log(`  → first experiment: ${f.firstExperiment.market} (${f.firstExperiment.why[0] || ""})`);
  }
  const cand = discoverSubnicheCandidates();
  const top = Object.entries(cand).slice(0, 10);
  console.log(`\nStage-1 subniche candidates from cached SERP evidence (free): ${Object.keys(cand).length} patterns`);
  for (const [q, c] of top) console.log(`  ${c}x  ${q}`);
}
