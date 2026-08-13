import Nav from "../Nav";
import Table from "./Table";
import { loadRun, idOf } from "../../../lib/cockpit";

export const dynamic = "force-static";

export default function Portfolio() {
  const run = loadRun();
  const byKey = new Map(run.comparison.map((c) => [c.key, c]));
  const rows = run.assets.filter((a) => a.source === "FINALIST").map((a) => {
    const c = byKey.get(a.key);
    return {
      id: idOf(a), service: a.service, geography: a.geography, state: a.state,
      geographyType: a.geographyType, cohort: a.cohort, newRank: c?.newRank ?? 999,
      gate: a.validation.gate.status, intent: a.validation.intent.intentClass,
      organicV1: a.organicV1 ?? null, dimensionA: a.dimensionA ?? null,
      assetValueF: a.assetValueF ?? null, renterDepthE: a.renterDepthE ?? null,
      measuredVolume: a.measuredVolume ?? null,
      expansion: a.validation.expansion.evidence.viableCombinations ?? null,
      pages: a.validation.architecture.estimatedPages ?? null,
      leadValue: a.leadValueAssumedUsd ?? null,
      confidence: typeof a.evidenceConfidence === "number" ? a.evidenceConfidence : null,
    };
  });
  return (
    <div className="shell">
      <Nav on="/cockpit/portfolio" />
      <p className="note" style={{ marginBottom: 14, maxWidth: "80ch" }}>
        The {rows.length} recommended Wave-1 assets, ranked after pre-purchase validation. Rank blends organic rankability,
        realizable value, commercial intent and expansion surface, then penalises anything the gate flagged. Sort any column
        to interrogate the ordering.
      </p>
      <Table rows={rows} />
    </div>
  );
}
