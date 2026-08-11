/**
 * V0 → V2 live import driver. Requires a provisioned Convex deployment:
 *
 *   cd v2 && npx convex dev   # once, to create the deployment
 *   NEXT_PUBLIC_CONVEX_URL=... npx tsx scripts/import-v0.ts
 *
 * Reads the tracked V0 data files from the repo root and feeds them through
 * the idempotent importer mutations. Safe to re-run: subjects upsert,
 * observations dedupe. When the MacBook datasets (out/, data/cache/) are
 * recovered, add parsers in lib/import/v0.ts and extend this driver — the
 * mutations already accept them.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import {
  parseCities,
  parseNiches,
  parseSurvivors,
  parseTrends,
  parseVolumes,
} from "../lib/import/v0";

const V0_DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(V0_DATA, f), "utf8"));

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  console.error("NEXT_PUBLIC_CONVEX_URL not set — provision Convex first (npx convex dev)");
  process.exit(1);
}
const client = new ConvexHttpClient(url);

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<any>) {
  const totals: Record<string, number> = {};
  for (let i = 0; i < rows.length; i += size) {
    const r = await fn(rows.slice(i, i + size));
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "number") totals[k] = (totals[k] ?? 0) + v;
    }
    console.log(`  ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
  return totals;
}

const services = parseNiches(read("niches.json"));
console.log(`services: ${services.length}`);
console.log(await client.mutation(api.importers.v0.importServices, { rows: services }));

const curatedCities = parseCities(read("cities.json"), "curated");
const nationalCities = parseCities(read("cities-national.json"), "national");
console.log(`geographies: ${curatedCities.length} curated + ${nationalCities.length} national`);
console.log(await chunked([...curatedCities, ...nationalCities], 200, (rows) =>
  client.mutation(api.importers.v0.importGeographies, { rows }),
));

const svcRef = services.map((s) => ({ slug: s.slug, acPhrase: s.acPhrase }));
const cityRef = [...curatedCities, ...nationalCities].map((c) => ({
  name: c.name, state: c.state, slug: c.slug,
}));

const vol = parseVolumes(read("volumes.json"), svcRef, cityRef, "curated");
const volNat = parseVolumes(read("volumes-national.json"), svcRef, cityRef, "national");
const surv = parseSurvivors(read("national-survivors.json"), svcRef);
console.log(`market rows: ${vol.rows.length} curated vol (${vol.skippedKeys.length} skipped), ` +
  `${volNat.rows.length} national vol (${volNat.skippedKeys.length} skipped), ` +
  `${surv.rows.length} survivors (${surv.skippedKeys.length} skipped)`);
for (const batch of [vol.rows, volNat.rows, surv.rows]) {
  console.log(await chunked(batch, 200, (rows) =>
    client.mutation(api.importers.v0.importMarketObservations, { rows }),
  ));
}

const trends = parseTrends(read("trends.json"), svcRef);
// trends observations attach to services — reuse importServices' dedupe path
console.log(await client.mutation(api.importers.v0.importServices, {
  rows: services.map((s) => ({
    ...s,
    observations: trends.find((t) => t.serviceSlug === s.slug)?.observations ?? [],
  })),
}));
console.log("V0 import complete (idempotent — safe to re-run).");
