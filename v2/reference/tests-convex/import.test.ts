/**
 * End-to-end V0 import through the Convex layer (real V0 files, in-memory
 * deployment). Verifies idempotency, provenance preservation, funnel
 * non-advancement, and legacy supersession by fresh V2 evidence.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { api } from "../../convex/_generated/api";
import { testConvex } from "./helpers";
import {
  parseCities,
  parseNiches,
  parseSurvivors,
  parseTrends,
  parseVolumes,
} from "../../lib/import/v0";

const V0 = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(V0, f), "utf8"));

const services = parseNiches(read("niches.json"));
const cur = parseCities(read("cities.json"), "curated");
const svcRef = services.map((s) => ({ slug: s.slug, acPhrase: s.acPhrase }));
const curRef = cur.map((c) => ({ name: c.name, state: c.state, slug: c.slug }));
const volumes = parseVolumes(read("volumes.json"), svcRef, curRef, "curated");
const trends = parseTrends(read("trends.json"), svcRef);

async function importCurated(t: ReturnType<typeof testConvex>) {
  const svcResult = await t.mutation(api.importers.v0.importServices, {
    rows: services,
  });
  const geoResult = await t.mutation(api.importers.v0.importGeographies, {
    rows: cur,
  });
  let market = { opportunitiesCreated: 0, observationsInserted: 0, observationsSkipped: 0, unresolved: [] as string[] };
  for (let i = 0; i < volumes.rows.length; i += 500) {
    const r = await t.mutation(api.importers.v0.importMarketObservations, {
      rows: volumes.rows.slice(i, i + 500),
    });
    market.opportunitiesCreated += r.opportunitiesCreated;
    market.observationsInserted += r.observationsInserted;
    market.observationsSkipped += r.observationsSkipped;
    market.unresolved.push(...r.unresolved);
  }
  return { svcResult, geoResult, market };
}

describe("full curated V0 import (real files)", () => {
  test("counts, idempotency, and provenance", async () => {
    const t = testConvex();
    const first = await importCurated(t);
    expect(first.svcResult).toEqual({
      created: 24,
      observationsInserted: 96,
      observationsSkipped: 0,
    });
    expect(first.geoResult).toEqual({
      created: 58,
      observationsInserted: 174,
      observationsSkipped: 0,
    });
    expect(first.market.opportunitiesCreated).toBe(1392);
    expect(first.market.observationsInserted).toBe(2013);
    expect(first.market.unresolved).toHaveLength(0);

    // REPEATABLE IMPORTS: second run creates nothing, overwrites nothing
    const second = await importCurated(t);
    expect(second.svcResult).toEqual({
      created: 0,
      observationsInserted: 0,
      observationsSkipped: 96,
    });
    expect(second.geoResult.created).toBe(0);
    expect(second.geoResult.observationsInserted).toBe(0);
    expect(second.market.opportunitiesCreated).toBe(0);
    expect(second.market.observationsInserted).toBe(0);
    expect(second.market.observationsSkipped).toBe(2013);

    // imported opportunities all sit at funnel stage 0 — V0 priors advance nothing
    const opps = await t.query(api.subjects.listOpportunities, { funnelStage: 0 });
    expect(opps).toHaveLength(1392);
  }, 120_000);

  test("survivor priors import as legacy DERIVED artifacts (sample)", async () => {
    const t = testConvex();
    await t.mutation(api.importers.v0.importServices, { rows: services });
    // use the national survivor parser against curated cities that overlap
    const surv = parseSurvivors(read("national-survivors.json"), svcRef);
    // import geographies for a sample of survivor slugs via national city file
    const nat = parseCities(read("cities-national.json"), "national");
    await t.mutation(api.importers.v0.importGeographies, { rows: nat.slice(0, 200) });
    const sample = surv.rows.filter((r) =>
      nat.slice(0, 200).some((c) => c.slug === r.geographySlug),
    ).slice(0, 50);
    const r = await t.mutation(api.importers.v0.importMarketObservations, {
      rows: sample,
    });
    expect(r.observationsInserted).toBe(sample.length);
    const opp = await t.query(api.subjects.listOpportunities, { funnelStage: 0 });
    expect(opp.length).toBeGreaterThan(0);
    const prior = await t.query(api.observations.latestByMetric, {
      opportunityId: opp[0]!._id,
      metric: "v0.prior.survivor",
    });
    expect(prior?.observation.evidenceType).toBe("DERIVED");
    expect(prior?.legacy).toBe(true);
  }, 60_000);

  test("trends attach to services with their real builtAt timestamp", async () => {
    const t = testConvex();
    await t.mutation(api.importers.v0.importServices, {
      rows: services.map((s) => ({
        ...s,
        observations: trends.find((x) => x.serviceSlug === s.slug)?.observations ?? [],
      })),
    });
    const svc = await t.query(api.subjects.listOpportunities, {});
    void svc;
    const first = services[0]!;
    const created = await t.mutation(api.importers.v0.importServices, { rows: [services[0]!] });
    void created;
    const all = await t.query(api.observations.historyByMetric, {
      serviceId: (await t.mutation(api.subjects.createService, {
        name: first.name, slug: first.slug, synonyms: first.synonyms, discoveryType: "SEED",
      })).id,
      metric: "kw.trend.weight",
    });
    expect(all).toHaveLength(1);
    expect(all[0]!.observedAt).toBe(new Date("2026-07-17T08:35:04.894Z").getTime());
  });
});

describe("legacy data must not become V2 truth by inheritance", () => {
  test("fresh independent V2 evidence supersedes legacy regardless of count", async () => {
    const t = testConvex();
    await t.mutation(api.importers.v0.importServices, { rows: services });
    await t.mutation(api.importers.v0.importGeographies, { rows: cur });
    // pick a market whose V0 row carries multiple observations (vol + cpc)
    const row = volumes.rows.find((r) => r.observations.length >= 2)!;
    await t.mutation(api.importers.v0.importMarketObservations, { rows: [row] });
    const opps = await t.query(api.subjects.listOpportunities, {});
    const oppId = opps[0]!._id;

    // legacy value surfaces (flagged) while no V2 evidence exists
    const before = await t.query(api.observations.latestByMetric, {
      opportunityId: oppId,
      metric: "kw.volume.exact",
    });
    expect(before?.legacy).toBe(true);

    // one fresh V2 observation beats the legacy one — even if legacy were newer
    await t.mutation(api.observations.record, {
      opportunityId: oppId,
      metric: "kw.volume.exact",
      value: 480,
      source: "dataforseo:google_ads_search_volume",
      evidenceType: "OBSERVED",
      confidence: 0.85,
      observedAt: Date.now() - 1000,
    });
    const after = await t.query(api.observations.latestByMetric, {
      opportunityId: oppId,
      metric: "kw.volume.exact",
    });
    expect(after?.legacy).toBe(false);
    expect(after?.observation.value).toBe(480);
    expect(after?.observationCount).toBe(2); // history intact

    const bag = await t.query(api.observations.evidenceBag, { opportunityId: oppId });
    expect(bag.metrics["kw.volume.exact"]?.legacy).toBe(false);
    expect(bag.legacyCount).toBeGreaterThan(0); // other metrics still legacy-only
  });

  test("supersession prefers non-legacy even when the legacy observation is newer", async () => {
    const t = testConvex();
    const { opportunityId } = await (await import("./helpers")).seedSubjects(t);
    const now = Date.now();
    await t.mutation(api.observations.record, {
      opportunityId,
      metric: "kw.volume.exact",
      value: 100,
      source: "dataforseo",
      evidenceType: "OBSERVED",
      confidence: 0.85,
      observedAt: now - 10_000, // older, independent V2
    });
    await t.mutation(api.observations.record, {
      opportunityId,
      metric: "kw.volume.exact",
      value: 999,
      source: "v0:volumes.json",
      evidenceType: "OBSERVED",
      confidence: 0.8,
      observedAt: now - 1000, // newer, but legacy
      legacy: true,
    });
    const latest = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
    });
    expect(latest?.observation.value).toBe(100);
    expect(latest?.legacy).toBe(false);
  });

  test("importer rejects rows not marked legacy (by validator)", async () => {
    const t = testConvex();
    await expect(
      t.mutation(api.importers.v0.importServices, {
        rows: [
          {
            name: "X",
            slug: "x",
            synonyms: [],
            observations: [
              {
                metric: "econ.margin.gross",
                value: 0.5,
                source: "v0:niches.json",
                evidenceType: "HUMAN_ASSUMED",
                confidence: 0.3,
                observedAt: Date.now() - 1000,
                rationale: "test",
                legacy: false, // must be literal true
              } as any,
            ],
          },
        ],
      }),
    ).rejects.toThrow();
  });
});
