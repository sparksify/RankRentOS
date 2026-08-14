import Link from "next/link";
import Nav from "../Nav";
import { loadRun, loadDecisions, money } from "../../../lib/cockpit";

export const dynamic = "force-static";

export default function Revenue() {
  const run = loadRun();
  const dec = loadDecisions();
  // The one real revenue-adjacent number that exists pre-launch: the modelled
  // renter gross profit of the five revenue candidates, clearly labelled as modelled.
  const cands = dec.assets.filter((a) => a.new?.decision === "REVENUE_CANDIDATE");
  return (
    <div className="shell">
      <Nav on="/cockpit/revenue" />
      <div className="pagehead"><h2>Revenue</h2><p>Pre-launch. Rent, MRR and outstanding balances begin at the first rental agreement.</p></div>
      <div className="kpis">
        <div className="kpi"><label>MRR</label><b>$0</b><span className="cmp dim">0 rented assets</span></div>
        <div className="kpi"><label>Rented assets</label><b>0</b><span className="cmp dim">of 0 live</span></div>
        <div className="kpi"><label>Outstanding</label><b>$0</b><span className="cmp dim">—</span></div>
        <div className="kpi"><label>6-month runway committed</label><b>{money(run.economics.sixMonthExperimentCost)}</b><span className="cmp dim">if the full portfolio is approved</span></div>
      </div>
      <div className="sec">
        <h3>Modelled — not earned</h3>
        <div className="tablewrap"><table className="grid" style={{ boxShadow: "none", border: "none" }}>
          <thead><tr><th>Revenue candidate</th><th className="numc">Assumed lead value</th><th className="numc">Modelled renter GP / mo</th><th>Recommended model</th></tr></thead>
          <tbody>{cands.map((a) => (
            <tr key={a.experimentId}>
              <td><b>{a.service}</b><div className="dim" style={{ fontSize: 11 }}>{a.geography}, {a.state}</div></td>
              <td className="numc">{a.new.leadValueUsd ? `$${a.new.leadValueUsd.toLocaleString()}` : "—"}</td>
              <td className="numc">{a.new.expectedLeadsPerMonth && a.new.leadValueUsd ? `~$${Math.round(a.new.expectedLeadsPerMonth * a.new.leadValueUsd).toLocaleString()}` : "—"}</td>
              <td style={{ fontSize: 12 }}>{a.new.recommendedMonetizationModel?.split("(")[0] ?? "—"}</td>
            </tr>))}</tbody>
        </table></div>
        <p className="note" style={{ marginTop: 10 }}>
          Every figure above is a HUMAN_ASSUMED projection (ticket × margin × close rate at benchmark funnel rates), shown so
          live results can be compared against it — never as earned revenue. Realized rent replaces these numbers asset by asset.
        </p>
      </div>
    </div>
  );
}
