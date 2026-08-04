import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { ROOT } from "./env.js";

const CACHE_DIR = join(ROOT, "data", "cache");

// Fetch a Google SERP for `query` localized to `location` via SerpAPI.
// Responses are cached to disk so re-runs and scorer iterations are free.
export async function fetchSerp(query, location, apiKey) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const slug = `${query} ${location}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const cacheFile = join(CACHE_DIR, `${slug}.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8"));

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    location,
    hl: "en",
    gl: "us",
    num: "10",
    api_key: apiKey,
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (data.error) throw new Error(`SerpAPI error: ${data.error}`);

  // Keep the full raw payload too — this is a one-time paid dataset, never re-pay for it.
  mkdirSync(join(CACHE_DIR, "raw"), { recursive: true });
  writeFileSync(join(CACHE_DIR, "raw", `${slug}.json`), JSON.stringify(data));

  // Keep only what the scorer needs — full payloads are big.
  const trimmed = {
    query,
    location,
    fetchedAt: new Date().toISOString(),
    organic: (data.organic_results || []).map((r) => ({
      position: r.position,
      title: r.title,
      link: r.link,
      displayed_link: r.displayed_link,
      snippet: r.snippet,
    })),
    localResults: (data.local_results?.places || []).map((p) => ({
      title: p.title,
      rating: p.rating,
      reviews: p.reviews,
      website: p.links?.website || null,
      type: p.type,
    })),
    ads: (data.ads || []).map((a) => ({
      title: a.title,
      link: a.link,
      displayed_link: a.displayed_link,
    })),
  };
  writeFileSync(cacheFile, JSON.stringify(trimmed, null, 2));
  return trimmed;
}
