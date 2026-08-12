// EXPERIMENT 2 — Stage 0/1: systematic hypothesis generation + free structural screen.
// Services come from taxonomy + data-mined SERP evidence, NOT from Exp-1 winners.
// No Community x Service hypotheses (deferred to supporting-page strategy).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";

const OUT = new URL("../../out/experiment-2/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---------- SERVICE UNIVERSE ----------
type Svc = { id: string; label: string; kw: string; cat: string; ticket: number; margin: number; source: string; control?: boolean };
const S = (id: string, label: string, kw: string, cat: string, ticket: number, margin: number, source = "taxonomy", control = false): Svc =>
  ({ id, label, kw, cat, ticket, margin, source, control });

const SERVICES: Svc[] = [
  // high-ticket home services
  S("foundation-repair", "Foundation Repair", "foundation repair", "high-ticket-home", 9000, 0.45),
  S("roof-repair", "Roof Repair", "roof repair", "high-ticket-home", 1800, 0.45),
  S("metal-roofing", "Metal Roofing", "metal roofing", "high-ticket-home", 25000, 0.35),
  S("window-replacement", "Window Replacement", "window replacement", "high-ticket-home", 12000, 0.35),
  S("kitchen-remodel", "Kitchen Remodeling", "kitchen remodeling", "high-ticket-home", 35000, 0.30),
  S("bathroom-remodel", "Bathroom Remodeling", "bathroom remodeling", "high-ticket-home", 18000, 0.32),
  S("sunroom", "Sunroom Addition", "sunroom builder", "high-ticket-home", 30000, 0.35),
  S("basement-waterproofing", "Basement Waterproofing", "basement waterproofing", "high-ticket-home", 8000, 0.45),
  S("siding-replacement", "Siding Replacement", "siding replacement", "high-ticket-home", 15000, 0.35),
  S("solar-battery", "Home Battery Storage", "home battery installation", "high-ticket-home", 14000, 0.30),
  // emergency / urgent
  S("water-damage", "Water Damage Restoration", "water damage restoration", "emergency", 4500, 0.45),
  S("fire-damage", "Fire Damage Restoration", "fire damage restoration", "emergency", 12000, 0.45),
  S("emergency-plumber", "Emergency Plumbing", "emergency plumber", "emergency", 800, 0.55),
  S("sewer-backup", "Sewer Backup Cleanup", "sewer backup cleanup", "emergency", 3500, 0.5),
  S("board-up", "Emergency Board Up", "emergency board up service", "emergency", 1200, 0.5),
  S("tree-emergency", "Emergency Tree Removal", "emergency tree removal", "emergency", 2200, 0.5),
  S("lockout", "Emergency Lockout", "emergency lockout service", "emergency", 180, 0.7, "taxonomy", true), // control: spam-heavy
  // recurring B2B / commercial
  S("commercial-cleaning", "Commercial Cleaning", "commercial cleaning service", "recurring-b2b", 2500, 0.4),
  S("hood-cleaning", "Kitchen Hood Cleaning", "kitchen hood cleaning", "recurring-b2b", 900, 0.55),
  S("parking-lot-striping", "Parking Lot Striping", "parking lot striping", "recurring-b2b", 3000, 0.5),
  S("commercial-landscaping", "Commercial Landscaping", "commercial landscaping", "recurring-b2b", 3500, 0.4),
  S("grease-trap", "Grease Trap Cleaning", "grease trap cleaning", "recurring-b2b", 600, 0.55),
  S("medical-waste", "Medical Waste Disposal", "medical waste disposal", "recurring-b2b", 1500, 0.45),
  S("commercial-hvac", "Commercial HVAC Service", "commercial hvac service", "recurring-b2b", 6000, 0.4),
  // specialty trades / subniches
  S("concrete-leveling", "Concrete Leveling", "concrete leveling", "specialty-trade", 3500, 0.55),
  S("crawl-space", "Crawl Space Encapsulation", "crawl space encapsulation", "specialty-trade", 9000, 0.45),
  S("chimney-repair", "Chimney Repair", "chimney repair", "specialty-trade", 3000, 0.5),
  S("stucco-repair", "Stucco Repair", "stucco repair", "specialty-trade", 4000, 0.45),
  S("well-pump", "Well Pump Repair", "well pump repair", "specialty-trade", 2200, 0.5),
  S("septic-install", "Septic System Installation", "septic system installation", "specialty-trade", 15000, 0.4),
  S("radon-mitigation", "Radon Mitigation", "radon mitigation", "specialty-trade", 2000, 0.55),
  S("asbestos-abatement", "Asbestos Abatement", "asbestos removal", "specialty-trade", 5000, 0.45),
  S("hardscaping", "Hardscaping", "hardscaping contractor", "specialty-trade", 14000, 0.4),
  S("spray-foam", "Spray Foam Insulation", "spray foam insulation", "specialty-trade", 7000, 0.5),
  // fragmented local services
  S("garage-door", "Garage Door Repair", "garage door repair", "fragmented-local", 700, 0.5, "taxonomy", true), // control: GBP-dependent
  S("appliance-repair", "Appliance Repair", "appliance repair", "fragmented-local", 325, 0.7),
  S("auto-glass", "Auto Glass Repair", "windshield replacement", "fragmented-local", 550, 0.5),
  S("dumpster-rental", "Dumpster Rental", "dumpster rental", "fragmented-local", 600, 0.5),
  S("junk-removal", "Junk Removal", "junk removal", "fragmented-local", 450, 0.55),
  S("mobile-mechanic", "Mobile Mechanic", "mobile mechanic", "fragmented-local", 400, 0.5),
  S("pest-control", "Pest Control", "pest control service", "fragmented-local", 500, 0.5),
  S("mold-remediation", "Mold Remediation", "mold remediation", "fragmented-local", 6000, 0.5),
  S("duct-cleaning", "Air Duct Cleaning", "air duct cleaning", "fragmented-local", 700, 0.9),
  S("gutter-installation", "Gutter Installation", "gutter installation", "fragmented-local", 2750, 0.5),
  // negative / contrast controls (expected weak)
  S("house-cleaning", "House Cleaning", "house cleaning service", "control-negative", 200, 0.5, "control", true),
  S("lawn-mowing", "Lawn Mowing", "lawn mowing service", "control-negative", 60, 0.5, "control", true),
  S("pressure-washing", "Pressure Washing", "pressure washing", "control-negative", 400, 0.6, "control", true),
];

// ---------- data-mined services (from cached SERP related_searches; free) ----------
const mined: Svc[] = [];
const rawDirs = [new URL("../../data/cache/raw/", import.meta.url), new URL("../../out/experiment-1/raw/", import.meta.url)];
const counts: Record<string, number> = {};
for (const d of rawDirs) {
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).slice(0, 260)) {
    try {
      const j = JSON.parse(readFileSync(new URL(f, d), "utf8"));
      for (const q of [...(j.related_searches || []).map((x: any) => x.query), ...(j.related_questions || []).map((x: any) => x.question)]) {
        const n = String(q).toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
        if (/\b(near me|cost|price|how|why|what|reddit|jobs?)\b/.test(n)) continue;
        if (n.split(" ").length < 2 || n.split(" ").length > 4) continue;
        if (/(repair|cleaning|installation|removal|service|replacement|restoration|contractor|remediation)/.test(n)) counts[n] = (counts[n] || 0) + 1;
      }
    } catch { /* skip */ }
  }
}
const known = new Set(SERVICES.map((s) => s.kw));
for (const [kw, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  if (mined.length >= 6 || n < 3 || known.has(kw)) continue;
  if ([...known].some((k) => kw.includes(k) || k.includes(kw))) continue;
  mined.push(S(kw.replace(/ /g, "-"), kw, kw, "discovered-from-data", 1500, 0.5, `mined:${n}-serps`));
}
const ALL_SERVICES = [...SERVICES, ...mined];

// ---------- GEOGRAPHY UNIVERSE (systematic strata) ----------
const cities = JSON.parse(readFileSync(new URL("../../data/cities-national.json", import.meta.url), "utf8"));
const withInc = cities.filter((c: any) => c.income);
const band = (c: any) => (c.pop >= 200000 ? "large" : c.pop >= 100000 ? "mid" : "small");
const wealth = (c: any) => (c.income >= 100000 ? "affluent" : c.income >= 80000 ? "upper-mid" : "middle");
const strata: Record<string, any[]> = {};
for (const c of withInc) { const k = `${band(c)}|${wealth(c)}`; (strata[k] ||= []).push(c); }
// deterministic spread: take up to 3 per stratum, ordered by population for reproducibility
const GEOS: any[] = [];
for (const k of Object.keys(strata).sort()) {
  GEOS.push(...strata[k].sort((a: any, b: any) => b.pop - a.pop).slice(0, 2).map((c: any) => ({ ...c, stratum: k })));
}

// ---------- pair generation + free structural screen ----------
type Hyp = { id: string; svc: string; svcLabel: string; cat: string; kw: string; city: string; state: string; pop: number; income: number; stratum: string; ticket: number; margin: number; control: boolean; source: string };
const hyps: Hyp[] = [];
const rejected: { id: string; reason: string }[] = [];
for (const s of ALL_SERVICES) {
  for (const g of GEOS) {
    const id = `${s.id}|${g.city}|${g.state}`;
    // Stage-1 free structural screen (documented, versioned: screen-v1)
    if (s.cat === "high-ticket-home" && g.income < 70000) { rejected.push({ id, reason: "high-ticket service in below-median-income geography" }); continue; }
    if (s.cat === "recurring-b2b" && g.pop < 80000) { rejected.push({ id, reason: "B2B service in market too small to support commercial density" }); continue; }
    if (s.ticket < 250 && g.pop < 100000) { rejected.push({ id, reason: "low-ticket service in small market: rent ceiling implausible" }); continue; }
    hyps.push({ id, svc: s.id, svcLabel: s.label, cat: s.cat, kw: s.kw, city: g.city, state: g.state, pop: g.pop, income: g.income, stratum: g.stratum, ticket: s.ticket, margin: s.margin, control: !!s.control, source: s.source });
  }
}
writeFileSync(new URL("hypotheses.json", OUT), JSON.stringify({ screenVersion: "screen-v1", services: ALL_SERVICES.length, geos: GEOS.length, generated: hyps.length + rejected.length, hyps, rejected }, null, 1));
const catCount = hyps.reduce((a: any, h) => { a[h.cat] = (a[h.cat] || 0) + 1; return a; }, {});
console.log(`services: ${ALL_SERVICES.length} (${mined.length} data-mined) | geos: ${GEOS.length} across ${Object.keys(strata).length} strata`);
console.log(`generated: ${hyps.length + rejected.length} | passed structural screen: ${hyps.length} | rejected: ${rejected.length}`);
console.log("category distribution:", JSON.stringify(catCount));
console.log("mined services:", mined.map((m) => m.kw).join(", ") || "(none met threshold)");
const rr = rejected.reduce((a: any, r) => { a[r.reason] = (a[r.reason] || 0) + 1; return a; }, {});
console.log("rejection reasons:", JSON.stringify(rr));
