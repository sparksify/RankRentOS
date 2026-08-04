import { promises as dns } from "dns";

// Generate exact-match and near-match .com candidates for a (niche, city) pair.
export function domainCandidates(niche, city) {
  const c = city.city.toLowerCase().replace(/[^a-z0-9]/g, "");
  const out = new Set();
  for (const term of niche.domainTerms) {
    out.add(`${c}${term}.com`);
    out.add(`${term}${c}.com`);
  }
  // Luke's fallback pattern: {city}{primaryTerm}pros.com
  out.add(`${c}${niche.domainTerms[0]}pros.com`);
  return [...out];
}

// Two-stage availability check, both free:
// 1. DNS NS lookup — has nameservers => definitely taken (fast filter)
// 2. RDAP (Verisign, .com/.net) — 404 => available, 200 => registered
export async function checkDomain(domain) {
  try {
    const ns = await dns.resolveNs(domain);
    if (ns?.length) return { domain, available: false, via: "dns" };
  } catch {
    /* NXDOMAIN etc — fall through to RDAP for a definitive answer */
  }
  try {
    const res = await fetch(`https://rdap.verisign.com/com/v1/domain/${domain}`, {
      headers: { accept: "application/rdap+json" },
    });
    if (res.status === 404) return { domain, available: true, via: "rdap" };
    if (res.ok) return { domain, available: false, via: "rdap" };
    return { domain, available: null, via: `rdap-${res.status}` };
  } catch (e) {
    return { domain, available: null, via: `error:${e.message.slice(0, 40)}` };
  }
}

// Pick the best available domain and explain why. Ranking logic from the SOPs:
// geography+service.com is Luke's exact formula; primary keyword beats variants;
// shorter beats longer; "pros"-style suffixes are the fallback of last resort.
export function pickWinner(availableDomains, niche, city) {
  if (!availableDomains?.length) return null;
  const c = city.city.toLowerCase().replace(/[^a-z0-9]/g, "");
  const primary = niche.domainTerms[0];

  const ranked = availableDomains.map((d) => {
    const name = d.replace(".com", "");
    let pts = 0;
    const reasons = [];
    if (name.startsWith(c)) { pts += 30; reasons.push("city-first (the geography+service formula)"); }
    else if (name.endsWith(c)) { pts += 20; reasons.push("service+city order (still an exact match)"); }
    const termIdx = niche.domainTerms.findIndex((t) => name.includes(t));
    if (termIdx === 0) { pts += 25; reasons.push(`primary keyword "${primary}"`); }
    else if (termIdx > 0) { pts += 25 - termIdx * 5; reasons.push(`variant keyword "${niche.domainTerms[termIdx]}"`); }
    if (!name.includes("pros")) pts += 10; else reasons.push("'pros' suffix — fallback pattern");
    pts += Math.max(0, 15 - Math.max(0, name.length - 18)); // brevity
    if (name.length <= 22) reasons.push(`short (${name.length} chars)`);
    return { domain: d, pts, reasons };
  }).sort((a, b) => b.pts - a.pts);

  const w = ranked[0];
  return { domain: w.domain, why: w.reasons.join("; "), runnerUp: ranked[1]?.domain || null };
}

// Registration age (years) of a competitor's domain via RDAP — free.
// SOP §2.3: young top-3 domains = beatable; also useful display data either way.
const ageCache = new Map();
export async function domainAgeYears(domain) {
  if (ageCache.has(domain)) return ageCache.get(domain);
  let age = null;
  try {
    const res = await fetch(`https://rdap.verisign.com/com/v1/domain/${domain}`, {
      headers: { accept: "application/rdap+json" },
    });
    if (res.ok) {
      const data = await res.json();
      const reg = (data.events || []).find((e) => e.eventAction === "registration");
      if (reg?.eventDate) age = Math.round(((Date.now() - new Date(reg.eventDate)) / 31557600000) * 10) / 10;
    }
  } catch { /* non-.com or lookup failure — leave null */ }
  ageCache.set(domain, age);
  return age;
}

export async function checkCandidates(niche, city, { concurrency = 5 } = {}) {
  const candidates = domainCandidates(niche, city);
  const results = [];
  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    results.push(...(await Promise.all(batch.map(checkDomain))));
    await new Promise((r) => setTimeout(r, 150)); // be polite to RDAP
  }
  return results;
}
