import Link from "next/link";
import Nav from "./Nav";
import Badge from "./Badge";
import { loadRun, money } from "../../lib/cockpit";

export const dynamic = "force-static";

export default function Overview() {
  const run = loadRun();
  const f = run.funnel;
  const finalists = run.assets.filter((a) => a.source === "FINALIST");
  const ready = finalists.filter((a) => a.validation.gate.readyForPurchaseDecision).length;

  return (
    <div className="shell">
      <Nav on="/cockpit" />

      <div className="kpis">
        <div className="kpi"><label>Run</label><b style={{ fontSize: 15 }}>{run.basedOn.portfolio}</b><span className="dim">validation {run.runId}</span></div>
        <div className="kpi"><label>Validated</label><b>{run.counts.finalists + run.counts.reserves}</b><span className="dim">{run.counts.finalists} finalists + {run.counts.reserves} reserves</span></div>
        <div className="kpi"><label>Ready for decision</label><b>{ready} / {run.counts.finalists}</b><span className="dim">finalists clearing the gate</span></div>
        <div className="kpi"><label>Upfront capital</label><b>{money(run.economics.upfrontCapital)}</b><span className="dim">{money(run.economics.domainCost)} domains</span></div>
        <div className="kpi"><label>6-month cost</label><b>{money(run.economics.sixMonthExperimentCost)}</b><span className="dim">{money(run.economics.monthlyCarrying)}/mo carrying</span></div>
      </div>

      <div className="sec">
        <h3>Research funnel</h3>
        <div className="funnel">
          {f.map((s, i) => {
            const prev = i > 0 ? f[i - 1].count : null;
            const drop = prev ? Math.round((1 - s.count / prev) * 100) : null;
            return (
              <div className="fstep" key={s.stage}>
                <label>{s.stage}</label>
                <b>{s.count.toLocaleString()}</b>
                {drop !== null && drop > 0 ? <div className="drop">−{drop}%</div> : <div className="drop" style={{ color: "var(--muted)" }}>&nbsp;</div>}
              </div>
            );
          })}
        </div>
        <p className="note" style={{ marginTop: 12 }}>
          3,762 hypotheses were generated and progressively narrowed. Each stage discards candidates for a recorded reason —
          see <Link href="/cockpit/rejected">Reserves &amp; Rejected</Link> for what was dropped and why.
        </p>
      </div>

      <div className="sec">
        <h3>Pre-purchase gate — {run.version}</h3>
        <div className="kv">
          <div><label>Pass</label><b style={{ color: "var(--good)" }}>{run.counts.pass}</b></div>
          <div><label>Pass with warning</label><b style={{ color: "#b45309" }}>{run.counts.passWithWarning}</b></div>
          <div><label>Needs review</label><b style={{ color: "#1d4ed8" }}>{run.counts.needsReview}</b></div>
          <div><label>Fail</label><b style={{ color: "var(--bad)" }}>{run.counts.fail}</b></div>
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          Validation is a separate, versioned stage. It does not modify the frozen Wave-1 run, and it does not fold into the
          A–I composite — each dimension carries its own evidence and verdict so the reasoning stays legible.
        </p>
      </div>

      <div className="sec">
        <h3>Status</h3>
        <div className="risk good"><b>READY FOR HUMAN PURCHASE DECISION.</b> No domain has been purchased and no site has been deployed.</div>
        <div className="kv" style={{ marginTop: 12 }}>
          <div><label>Frozen baseline</label><b style={{ fontSize: 13 }}>{run.basedOn.frozenAt}</b></div>
          <div><label>Domains required</label><b>{run.purchaseList.length}</b></div>
          <div><label>Matched pairs</label><b>{run.matchedPairs.length}</b></div>
          <div><label>Primary endpoint</label><b style={{ fontSize: 13 }}>{run.preRegistration.primaryEndpoint}</b></div>
        </div>
      </div>
    </div>
  );
}
