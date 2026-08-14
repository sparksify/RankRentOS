import Link from "next/link";
import Nav from "../Nav";
import { loadRun, loadDecisions, money } from "../../../lib/cockpit";
import QueueBanner from "./QueueBanner";

export const dynamic = "force-static";

export default function Domains() {
  const run = loadRun();
  const dec = loadDecisions();
  const decByDomain = new Map();
  for (const a of dec.assets) {
    const d = a.isHubPage ? a.hubDomain : a.preferredDomain;
    if (!d) continue;
    if (!decByDomain.has(d)) decByDomain.set(d, []);
    decByDomain.get(d).push(a);
  }
  const rows = run.purchaseList.map((p) => {
    const assets = decByDomain.get(p.domain) ?? [];
    const decision = assets.some((a) => a.new?.decision === "REVENUE_CANDIDATE") ? "REVENUE_CANDIDATE"
      : assets.length ? "EXPERIMENTAL" : "—";
    return { ...p, decision, assetCount: assets.length || 1 };
  });
  const revenue = rows.filter((r) => r.decision === "REVENUE_CANDIDATE");
  const experiment = rows.filter((r) => r.decision !== "REVENUE_CANDIDATE");

  return (
    <div className="shell">
      <Nav on="/cockpit/domains" />
      <div className="pagehead">
        <h2>Domains</h2>
        <p>The purchase list, verified available at freeze (2026-08-12). Availability decays — re-check at the moment of purchase. RankRentOS does not buy domains; this list awaits your approval.</p>
      </div>
      <QueueBanner />
      <div className="kpis">
        <div className="kpi"><label>Ready to buy</label><b>{rows.length}</b><span className="cmp dim">all verified available (RDAP 404)</span></div>
        <div className="kpi"><label>Total cost</label><b>{money(run.economics.domainCost)}</b><span className="cmp dim">~$12.18 each, first year</span></div>
        <div className="kpi"><label>Revenue assets</label><b>{revenue.length}</b><span className="cmp dim">pass all four decision gates</span></div>
        <div className="kpi"><label>Experiment assets</label><b>{experiment.length}</b><span className="cmp dim">incl. 1 hub serving 6 pages</span></div>
      </div>

      {[["Revenue-candidate domains", revenue, "b-pass"], ["Experiment domains", experiment, "b-neutral"]].map(([title, list, cls]) => (
        <div className="sec" key={title}>
          <h3>{title} ({list.length})</h3>
          <div className="tablewrap"><table className="grid" style={{ boxShadow: "none", border: "none" }}>
            <thead><tr><th>Domain</th><th>Serves</th><th>Decision</th><th className="numc">Est. first year</th><th>Verified at freeze</th></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.domain}>
                <td className="domain-mono" style={{ fontSize: 12.5 }}>{r.domain}</td>
                <td style={{ fontSize: 12.5 }}>{r.role}</td>
                <td><span className={`badge ${cls}`}>{r.decision === "REVENUE_CANDIDATE" ? "Revenue" : "Experiment"}</span></td>
                <td className="numc">${(r.approxFirstYearUsd ?? 12.18).toFixed(2)}</td>
                <td><span className="badge b-pass">Available</span></td>
              </tr>))}</tbody>
          </table></div>
        </div>
      ))}
      <div className="decision-banner" role="status">
        <span className="pulse" aria-hidden />
        <div><b>AWAITING YOUR PURCHASE APPROVAL — {money(run.economics.domainCost)}</b>
          <div><span>Approving the 5 revenue domains alone costs $60.90; the full list funds the entire Wave-1 learning agenda. Nothing is purchased automatically.</span></div></div>
      </div>
    </div>
  );
}
