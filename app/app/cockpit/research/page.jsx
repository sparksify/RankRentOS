import Link from "next/link";
import Nav from "../Nav";
import { loadRun, money } from "../../../lib/cockpit";

export const dynamic = "force-static";

function GateRing({ counts }) {
  const segs = [
    { n: counts.pass, color: "var(--good)", label: "Pass" },
    { n: counts.passWithWarning, color: "var(--warn)", label: "Pass with warning" },
    { n: counts.needsReview, color: "var(--blue)", label: "Needs review" },
    { n: counts.fail, color: "var(--bad)", label: "Fail" },
  ];
  const total = segs.reduce((s, x) => s + x.n, 0) || 1;
  const R = 70, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="gatewrap">
      <div className="gatering">
        <svg width="168" height="168" viewBox="0 0 168 168" role="img" aria-label="Gate status distribution">
          <circle cx="84" cy="84" r={R} stroke="rgba(148,163,184,.12)" strokeWidth="13" fill="none" />
          {segs.map((s) => {
            const len = (s.n / total) * (C - segs.filter(x => x.n > 0).length * 4);
            const el = s.n > 0 ? (
              <circle key={s.label} cx="84" cy="84" r={R} fill="none" stroke={s.color} strokeWidth="13"
                strokeLinecap="round" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} opacity="0.9" />
            ) : null;
            if (s.n > 0) offset += len + 4;
            return el;
          })}
        </svg>
        <div className="mid"><div><b>{total}</b><span>validated</span></div></div>
      </div>
      <div className="gatelegend">
        {segs.map((s) => (
          <div className="row" key={s.label}>
            <span className="sw" style={{ background: s.color }} /><b>{s.n}</b>
            <span style={{ color: "var(--ink-2)" }}>{s.label}</span>
          </div>
        ))}
        <p className="note" style={{ marginTop: 4 }}>
          Validation is a separate, versioned stage. It never modifies the frozen Wave-1 run and never folds into the A–I composite.
        </p>
      </div>
    </div>
  );
}

export default function Overview() {
  const run = loadRun();
  const f = run.funnel;
  const max = Math.max(...f.map((s) => s.count));
  const finalists = run.assets.filter((a) => a.source === "FINALIST");
  const ready = finalists.filter((a) => a.validation.gate.readyForPurchaseDecision).length;

  return (
    <div className="shell">
      <Nav on="/cockpit/research" />
      <div className="pagehead">
        <h2>Research Run — Wave 1</h2>
        <p>{run.basedOn.portfolio} · validation {run.runId} · frozen baseline {run.basedOn.frozenAt}. The laboratory view: how the machine chose these assets. The operating view lives on the Overview.</p>
      </div>

      <div className="kpis">
        <div className="kpi"><label>Validated</label><b>{run.counts.finalists + run.counts.reserves}</b><span>{run.counts.finalists} finalists + {run.counts.reserves} reserves</span></div>
        <div className="kpi"><label>Ready for decision</label><b>{ready} / {run.counts.finalists}</b><span>finalists clearing the gate</span></div>
        <div className="kpi"><label>Upfront capital</label><b>{money(run.economics.upfrontCapital)}</b><span>{money(run.economics.domainCost)} domains</span></div>
        <div className="kpi"><label>6-month cost</label><b>{money(run.economics.sixMonthExperimentCost)}</b><span>{money(run.economics.monthlyCarrying)}/mo carrying</span></div>
        <div className="kpi"><label>Matched pairs</label><b>{run.matchedPairs.length}</b><span>standalone vs regional hub</span></div>
      </div>

      <div className="sec">
        <h3>Research funnel — thousands in, a handful out</h3>
        <div className="funnel2">
          {f.map((s, i) => {
            const prev = i > 0 ? f[i - 1].count : null;
            const drop = prev && prev > s.count ? Math.round((1 - s.count / prev) * 100) : null;
            return (
              <div className="fs2" key={s.stage}>
                <label>{s.stage}</label>
                <div className="track"><div className="fill" style={{ width: `${(s.count / max) * 100}%` }} /></div>
                <div className="nums"><b>{s.count.toLocaleString()}</b>{drop !== null && <span className="drop">−{drop}%</span>}</div>
              </div>
            );
          })}
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          Every discarded candidate carries a recorded reason — see <Link href="/cockpit/rejected">Reserves &amp; Rejected</Link>.
        </p>
      </div>

      <div className="sec">
        <h3>Pre-purchase gate — {run.version}</h3>
        <GateRing counts={run.counts} />
      </div>

      <div className="decision-banner" role="status">
        <span className="pulse" aria-hidden />
        <div>
          <b>READY FOR HUMAN PURCHASE DECISION</b>
          <div><span>No domain has been purchased and no site has been deployed. Final state awaits explicit approval.</span></div>
        </div>
      </div>

      <div className="sec" style={{ marginTop: 14 }}>
        <h3>Experiment frame</h3>
        <div className="kv">
          <div><label>Frozen baseline</label><b style={{ fontSize: 13 }}>{run.basedOn.frozenAt}</b></div>
          <div><label>Domains required</label><b>{run.purchaseList.length}</b></div>
          <div><label>Matched pairs</label><b>{run.matchedPairs.length}</b></div>
          <div><label>Primary endpoint</label><b style={{ fontSize: 13 }}>{run.preRegistration.primaryEndpoint}</b></div>
        </div>
      </div>
    </div>
  );
}
