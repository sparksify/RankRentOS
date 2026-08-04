import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { ROOT } from "./env.js";

const CACHE_DIR = join(ROOT, "data", "cache", "demand");

// --- Layer 1: autocomplete demand floor ------------------------------------
// If Google suggests "{service} {city}" while typing, real people search it.
// acQuery is the short-form phrase people actually type (niches.json).
export async function autocompleteCheck(niche, city, apiKey) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const typed = `${niche.acQuery} ${city.city.toLowerCase().slice(0, 4)}`;
  const slug = typed.replace(/[^a-z0-9]+/g, "-");
  const cacheFile = join(CACHE_DIR, `ac-${slug}.json`);

  let suggestions;
  if (existsSync(cacheFile)) {
    suggestions = JSON.parse(readFileSync(cacheFile, "utf8"));
  } else {
    const params = new URLSearchParams({ engine: "google_autocomplete", q: typed, gl: "us", hl: "en", api_key: apiKey });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) throw new Error(`autocomplete ${res.status}`);
    const data = await res.json();
    suggestions = (data.suggestions || []).map((s) => s.value?.toLowerCase() || "");
    writeFileSync(cacheFile, JSON.stringify(suggestions));
  }

  const cityLower = city.city.toLowerCase();
  const cityHit = suggestions.some((s) => s.includes(cityLower));
  const nicheActivity = suggestions.length > 0;
  // 1.0 = Google autocompletes the exact city pair; 0.8 = niche is typed but not this city; 0.6 = dead air
  const floor = cityHit ? 1.0 : nicheActivity ? 0.8 : 0.6;
  return { typed, suggestions, cityHit, floor };
}

// --- Layer 2: niche-relative demand + seasonality via Google Trends --------
// Trends values are only comparable within one call (max 5 terms), so we run
// two batches sharing an anchor term and rescale batch 2 onto batch 1's scale.
export async function buildTrends(niches, apiKey, geo = "US") {
  const outFile = join(ROOT, "data", "trends.json");
  if (existsSync(outFile)) return JSON.parse(readFileSync(outFile, "utf8"));

  const terms = niches.map((n) => n.acQuery);
  const anchor = terms[0];
  // Trends compares max 5 terms per call — chunk into batches of 4 + shared anchor
  const batches = [terms.slice(0, 5)];
  for (let i = 5; i < terms.length; i += 4) batches.push([anchor, ...terms.slice(i, i + 4)]);

  async function trendsCall(batch) {
    const params = new URLSearchParams({
      engine: "google_trends", q: batch.join(","), geo,
      date: "today 5-y", data_type: "TIMESERIES", api_key: apiKey,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) throw new Error(`trends ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`trends: ${data.error}`);
    return data.interest_over_time?.timeline_data || [];
  }

  function seriesStats(timeline, idx) {
    const monthly = {}; // month -> [values]
    let sum = 0, n = 0;
    for (const point of timeline) {
      const v = point.values?.[idx]?.extracted_value ?? 0;
      sum += v; n++;
      const m = new Date(point.timestamp * 1000).getMonth();
      (monthly[m] = monthly[m] || []).push(v);
    }
    const mean = n ? sum / n : 0;
    const monthMeans = Object.entries(monthly).map(([m, vs]) => [Number(m), vs.reduce((a, b) => a + b, 0) / vs.length]);
    monthMeans.sort((a, b) => b[1] - a[1]);
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    // peakMean = avg of the 3 strongest months — fair demand basis for seasonal niches
    const peakMean = monthMeans.slice(0, 3).reduce((a, [, v]) => a + v, 0) / Math.max(monthMeans.slice(0, 3).length, 1);
    return {
      mean: Math.round(mean * 10) / 10,
      peakMean: Math.round(peakMean * 10) / 10,
      peakMonths: monthMeans.slice(0, 3).map(([m]) => names[m]),
    };
  }

  const stats = {};
  for (const [bi, batch] of batches.entries()) {
    const timeline = await trendsCall(batch);
    if (bi === 0) {
      batch.forEach((term, i) => { stats[term] = seriesStats(timeline, i); });
    } else {
      const anchorHere = seriesStats(timeline, 0);
      const scale = anchorHere.mean > 0 ? stats[anchor].mean / anchorHere.mean : 1;
      batch.slice(1).forEach((term, i) => {
        const s = seriesStats(timeline, i + 1);
        stats[term] = {
          mean: Math.round(s.mean * scale * 10) / 10,
          peakMean: Math.round(s.peakMean * scale * 10) / 10,
          peakMonths: s.peakMonths,
        };
      });
    }
  }

  // Normalize into 0.7–1.15 multipliers; seasonal niches judged on peak-season interest
  const maxMean = Math.max(...Object.values(stats).map((s) => s.mean), 1);
  for (const term of Object.keys(stats)) {
    stats[term].weight = Math.round((0.7 + (stats[term].mean / maxMean) * 0.45) * 100) / 100;
    stats[term].weightPeak = Math.round((0.7 + Math.min(stats[term].peakMean / maxMean, 1) * 0.45) * 100) / 100;
  }

  writeFileSync(outFile, JSON.stringify({ geo, builtAt: new Date().toISOString(), stats }, null, 2));
  return { geo, stats };
}

// --- Layer 3: competitor content depth (free) -------------------------------
// Kyle's "how many words do they have on the page" check, automated.
export async function contentDepth(topOrganic, { max = 3, timeoutMs = 8000 } = {}) {
  const targets = (topOrganic || []).filter((o) => o.link).slice(0, max);
  const counts = [];
  for (const t of targets) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(t.link, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; market-research)" }, redirect: "follow" });
      clearTimeout(timer);
      if (!res.ok) { counts.push({ link: t.link, words: null }); continue; }
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
      counts.push({ link: t.link, words: text.split(" ").filter((w) => w.length > 2).length });
    } catch {
      counts.push({ link: t.link, words: null });
    }
  }
  const valid = counts.filter((c) => c.words !== null).map((c) => c.words);
  return {
    pages: counts,
    avgWords: valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null,
  };
}
