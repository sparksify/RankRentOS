// LIVE Supabase store-contract parity — same 15 rules as contract.test.ts,
// run against RankRent OS (jhzpmmdyqzynjvkwgdbg). Gated: LIVE=1.
// Test rows use subject_type='selftest' + unique suffixes (append-only DB).
import { describe, test, expect } from "vitest";
import { createSupabaseStore } from "../../lib/store/supabase";

const LIVE = process.env.LIVE === "1";
const d = describe.skipIf(!LIVE);
const store = LIVE ? createSupabaseStore() : (null as any);
const uniq = `lv${Date.now().toString(36)}`;
const T = Date.now();
const obs = (over: Record<string, unknown> = {}) => ({
  subjectType: "selftest", subjectId: `${uniq}_s1`,
  metric: "kw.volume.exact", value: 320, source: "dataforseo",
  evidenceType: "OBSERVED" as const, confidence: 0.9, observedAt: T, ...over,
});

d("LIVE observations", () => {
  test("contract exposes no update/delete", () => {
    expect(Object.keys(store).some((k) => /update|delete|remove/i.test(k))).toBe(false);
  });
  test("append + history + latest", async () => {
    await store.insertObservation(obs({ value: 100, observedAt: T - 2000 }));
    await store.insertObservation(obs({ value: 200, observedAt: T - 1000 }));
    const h = await store.history(`${uniq}_s1`, "kw.volume.exact");
    expect(h.map((o: any) => o.value)).toEqual([100, 200]);
    expect((await store.latestByMetric(`${uniq}_s1`, "kw.volume.exact"))!.value).toBe(200);
  });
  test("unknown metric rejected", async () => {
    await expect(store.insertObservation(obs({ metric: "not.a.metric" }))).rejects.toThrow();
  });
  test("AI citation guard", async () => {
    await expect(store.insertObservation(obs({ metric: "kw.volume.universe", evidenceType: "AI_ESTIMATED" }))).rejects.toThrow();
  });
  test("OBSERVED-only metric rejects AI even with citation", async () => {
    await expect(store.insertObservation(obs({ metric: "kw.cpc", evidenceType: "AI_ESTIMATED", sourceUrl: "https://x" }))).rejects.toThrow();
  });
  test("batch atomic on invalid row", async () => {
    await expect(store.insertBatch([obs({ subjectId: `${uniq}_atomic` }), obs({ subjectId: `${uniq}_atomic`, metric: "bad.metric" })])).rejects.toThrow();
    expect(await store.history(`${uniq}_atomic`, "kw.volume.exact")).toHaveLength(0);
  });
  test("asOf reproducibility", async () => {
    const sid = `${uniq}_asof`;
    await store.insertObservation(obs({ subjectId: sid, value: 100, observedAt: T - 60000 }));
    await store.insertObservation(obs({ subjectId: sid, value: 999, observedAt: T - 1000 }));
    expect((await store.latestByMetric(sid, "kw.volume.exact", T - 30000))!.value).toBe(100);
    expect((await store.latestByMetric(sid, "kw.volume.exact"))!.value).toBe(999);
  });
  test("fresh non-legacy supersedes legacy regardless of count/recency", async () => {
    const sid = `${uniq}_leg`;
    await store.insertObservation(obs({ subjectId: sid, value: 1, observedAt: T - 500, legacy: true }));
    await store.insertObservation(obs({ subjectId: sid, value: 2, observedAt: T + 500, legacy: true }));
    await store.insertObservation(obs({ subjectId: sid, value: 42, observedAt: T - 1000 }));
    expect((await store.latestByMetric(sid, "kw.volume.exact"))!.value).toBe(42);
  });
  test("supersede is pointer-only (append-only DB enforced)", async () => {
    const sid = `${uniq}_sup`;
    const a = await store.insertObservation(obs({ subjectId: sid, value: 100, observedAt: T - 2000 }));
    const b = await store.insertObservation(obs({ subjectId: sid, value: 200, observedAt: T - 1000 }));
    await store.supersede(a.id, b.id);
    const h = await store.history(sid, "kw.volume.exact");
    expect(h.find((o: any) => o.id === a.id)!.value).toBe(100);
    expect((await store.latestByMetric(sid, "kw.volume.exact"))!.id).toBe(b.id);
  });
});

d("LIVE research runs + budget", () => {
  test("begin -> complete with actuals; idempotent; double-complete rejected; failure recorded", async () => {
    const h1 = `${uniq}_h1`;
    const a = await store.beginRun("selftest", h1, { stage: 1, budgetCapUsd: 5 });
    expect(a.existing).toBe(false);
    const b = await store.beginRun("selftest", h1, { stage: 1, budgetCapUsd: 5 });
    expect(b.existing).toBe(true);
    expect(b.run.id).toBe(a.run.id);
    const done = await store.completeRun(a.run.id, 1.25);
    expect(done.status).toBe("completed");
    expect(done.spentUsd).toBe(1.25);
    await expect(store.completeRun(a.run.id, 1)).rejects.toThrow(/double-complete/);
    const c = await store.beginRun("selftest", `${uniq}_h2`, { stage: 1, budgetCapUsd: 5 });
    const failed = await store.failRun(c.run.id, "provider 500");
    expect(failed.status).toBe("failed");
  });
  test("budget refusal recorded; spend uses actuals", async () => {
    const { run } = await store.beginRun("selftest", `${uniq}_h3`, { stage: 1, budgetCapUsd: 1.0 });
    await store.charge(run.id, "serpapi", 1, 0.8);
    await expect(store.charge(run.id, "serpapi", 1, 0.5)).rejects.toThrow();
    expect(await store.spent(run.id)).toBeCloseTo(0.8);
  });
});
