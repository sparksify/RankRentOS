// Store-contract tests: backend-independent ports of the Convex reference
// rules (tests/convex/*.test.ts names preserved). Run against memory store;
// the Supabase store must pass this identical suite once the project is live.
import { describe, test, expect, beforeEach } from "vitest";
import { createMemoryStore } from "../../lib/store/memory";
import type { Store } from "../../lib/store/contract";

let clock = 1_000_000;
const now = () => clock;
let store: Store;
beforeEach(() => { clock = 1_000_000; store = createMemoryStore(now); });

const obs = (over: Record<string, unknown> = {}) => ({
  subjectType: "market", subjectId: "mkt_1",
  metric: "kw.volume.exact", value: 320, source: "dataforseo",
  evidenceType: "OBSERVED" as const, confidence: 0.9, observedAt: clock,
  ...over,
});

describe("observations (parity: tests/convex/observations.test.ts)", () => {
  test("the store contract exposes no update or delete functions", () => {
    const keys = Object.keys(store);
    expect(keys.some((k) => /update|delete|remove/i.test(k))).toBe(false);
  });

  test("newer knowledge appends; history preserves both", async () => {
    await store.insertObservation(obs({ value: 100, observedAt: 1 }));
    await store.insertObservation(obs({ value: 200, observedAt: 2 }));
    const h = await store.history("mkt_1", "kw.volume.exact");
    expect(h.map((o) => o.value)).toEqual([100, 200]);
    expect((await store.latestByMetric("mkt_1", "kw.volume.exact"))!.value).toBe(200);
  });

  test("unknown metric is rejected", async () => {
    await expect(store.insertObservation(obs({ metric: "not.a.metric" }))).rejects.toThrow();
  });

  test("AI citation guard holds at the store boundary", async () => {
    await expect(store.insertObservation(obs({ metric: "kw.volume.universe", evidenceType: "AI_ESTIMATED" }))).rejects.toThrow();
  });

  test("OBSERVED-only metrics reject AI estimates even with citation", async () => {
    await expect(store.insertObservation(obs({ metric: "kw.cpc", evidenceType: "AI_ESTIMATED", sourceUrl: "https://x" }))).rejects.toThrow();
  });

  test("batch is atomic: one invalid row rejects the whole batch", async () => {
    await expect(store.insertBatch([obs(), obs({ metric: "bad.metric" })])).rejects.toThrow();
    expect(await store.history("mkt_1", "kw.volume.exact")).toHaveLength(0);
  });

  test("asOf makes freshness reproducible at a point in time", async () => {
    await store.insertObservation(obs({ value: 100, observedAt: 10 }));
    await store.insertObservation(obs({ value: 999, observedAt: 50 }));
    expect((await store.latestByMetric("mkt_1", "kw.volume.exact", 20))!.value).toBe(100);
    expect((await store.latestByMetric("mkt_1", "kw.volume.exact"))!.value).toBe(999);
  });
});

describe("legacy supersession (parity: import.test.ts supersession rules)", () => {
  test("fresh independent V2 evidence supersedes legacy regardless of count", async () => {
    await store.insertObservation(obs({ value: 1, observedAt: 5, legacy: true }));
    await store.insertObservation(obs({ value: 2, observedAt: 6, legacy: true }));
    await store.insertObservation(obs({ value: 42, observedAt: 7 }));
    expect((await store.latestByMetric("mkt_1", "kw.volume.exact"))!.value).toBe(42);
  });

  test("supersession prefers non-legacy even when the legacy observation is newer", async () => {
    await store.insertObservation(obs({ value: 42, observedAt: 5 }));
    await store.insertObservation(obs({ value: 1, observedAt: 99, legacy: true }));
    expect((await store.latestByMetric("mkt_1", "kw.volume.exact"))!.value).toBe(42);
  });

  test("explicit supersede is a pointer, never a value mutation", async () => {
    const a = await store.insertObservation(obs({ value: 100, observedAt: 1 }));
    const b = await store.insertObservation(obs({ value: 200, observedAt: 2 }));
    await store.supersede(a.id, b.id);
    const h = await store.history("mkt_1", "kw.volume.exact");
    expect(h.find((o) => o.id === a.id)!.value).toBe(100); // value untouched
    expect((await store.latestByMetric("mkt_1", "kw.volume.exact"))!.id).toBe(b.id);
  });
});

describe("research runs (parity: tests/convex/researchRuns.test.ts)", () => {
  test("begin → complete lifecycle with cost actuals", async () => {
    const { run } = await store.beginRun("serp", "h1", { stage: 1, budgetCapUsd: 5 });
    const done = await store.completeRun(run.id, 1.25);
    expect(done.status).toBe("completed");
    expect(done.spentUsd).toBe(1.25);
  });

  test("idempotency: identical (kind, paramsHash) returns the existing run", async () => {
    const a = await store.beginRun("serp", "h1", { stage: 1, budgetCapUsd: 5 });
    const b = await store.beginRun("serp", "h1", { stage: 1, budgetCapUsd: 5 });
    expect(b.existing).toBe(true);
    expect(b.run.id).toBe(a.run.id);
  });

  test("double-complete rejected; failure recorded", async () => {
    const { run } = await store.beginRun("serp", "h2", { stage: 1, budgetCapUsd: 5 });
    await store.completeRun(run.id, 1);
    await expect(store.completeRun(run.id, 1)).rejects.toThrow(/double-complete/);
    const { run: r2 } = await store.beginRun("serp", "h3", { stage: 1, budgetCapUsd: 5 });
    const failed = await store.failRun(r2.id, "provider 500");
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("provider 500");
  });
});

describe("budget ledger (parity: budget/collectors tests)", () => {
  test("collector refuses to spend past the remaining budget; refusal is recorded", async () => {
    const { run } = await store.beginRun("serp", "h4", { stage: 1, budgetCapUsd: 1.0 });
    await store.charge(run.id, "serpapi", 1, 0.8);
    await expect(store.charge(run.id, "serpapi", 1, 0.5)).rejects.toThrow();
    expect(await store.spent(run.id)).toBeCloseTo(0.8); // refused entry not counted
  });

  test("spend totals use actuals", async () => {
    const { run } = await store.beginRun("serp", "h5", { stage: 1, budgetCapUsd: 10 });
    await store.charge(run.id, "serpapi", 2, 0.02);
    await store.charge(run.id, "dataforseo", 1000, 0.075);
    expect(await store.spent(run.id)).toBeCloseTo(0.095);
  });
});
