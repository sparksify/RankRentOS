import Link from "next/link";
import Nav from "../Nav";
import Badge from "../Badge";
import { loadRun, idOf } from "../../../lib/cockpit";

export const dynamic = "force-static";

export default function Rejected() {
  const run = loadRun();
  const cmp = new Map(run.comparison.map((c) => [c.key, c]));
  const reserves = run.assets.filter((a) => a.source === "RESERVE")
    .sort((a, b) => (cmp.get(a.key)?.newRank ?? 999) - (cmp.get(b.key)?.newRank ?? 999));
  const failed = run.assets.filter((a) => a.validation.gate.status === "FAIL");

  return (
    <div className="shell">
      <Nav on="/cockpit/rejected" />
      <p className="note" style={{ marginBottom: 14, maxWidth: "82ch" }}>
        What the machine did <i>not</i> pick, and why. These are researched candidates that sat close enough to the cutoff that
        validation could reasonably have changed the decision. Rejections are either <b>hard-rule</b> (a gate blocked it) or
        <b> comparative</b> (something else simply scored better).
      </p>

      {failed.length > 0 && (
        <div className="sec">
          <h3>Hard-rule rejections — blocked by a gate</h3>
          {failed.map((a) => (
            <div className="risk blocker" key={a.key}>
              <b>{a.service} — {a.geography}, {a.state}</b> ({a.source}). {a.validation.gate.blockers[0]}
            </div>))}
        </div>)}

      <div className="sec">
        <h3>Historic hard-rule rejections carried from earlier stages</h3>
        <div className="risk blocker"><b>Bathroom Remodeling — Conroe, TX.</b> Removed at freeze: zero viable renters, and its organic top-5 was Wikipedia, IKEA, Lowe&apos;s, Home Depot and Houzz — a retail/informational SERP with nobody hiring a contractor. This is the failure mode the commercial-intent gate now catches automatically.</div>
        <div className="risk"><b>Recurring B2B services</b> (commercial cleaning, hood cleaning, grease trap, medical waste). 126 hypotheses, zero cleared the 100/mo demand floor — falsified as a local-search category.</div>
        <div className="risk"><b>High-volume / low-ticket services</b> (lawn mowing, house cleaning at city level, appliance repair). Blocked by the rentability floor: realizable renter gross profit below the $300/mo minimum rent.</div>
        <div className="risk"><b>Windsong Ranch, Light Farms, Mustang Lakes, Canyon Falls.</b> Comparative: organically brutal because a competitor already holds a community-specific pool page.</div>
      </div>

      <table className="grid">
        <thead><tr>
          <th className="numc">Rank</th><th>Opportunity</th><th>Gate</th><th>Intent</th>
          <th className="numc">Organic</th><th className="numc">A</th><th className="numc">F</th><th className="numc">E</th>
          <th className="numc">Vol</th><th>Why it is not a finalist</th>
        </tr></thead>
        <tbody>
          {reserves.map((a) => {
            const c = cmp.get(a.key);
            const hard = a.validation.gate.status === "FAIL";
            return (
              <tr key={a.key}>
                <td className="numc rank">{c?.newRank ?? "—"}</td>
                <td><Link href={`/cockpit/opportunity/${idOf(a)}`}><b>{a.service}</b></Link>
                  <div className="dim" style={{ fontSize: 11.5 }}>{a.geography}, {a.state}</div></td>
                <td><Badge status={a.validation.gate.status} /></td>
                <td style={{ fontSize: 11.5 }} className={a.validation.intent.intentClass === "LOCAL_COMMERCIAL" ? "" : "dim"}>
                  {a.validation.intent.intentClass.replace(/_/g, " ").toLowerCase()}</td>
                <td className="numc">{a.organicV1 ?? "—"}</td>
                <td className="numc dim">{a.dimensionA ?? "—"}</td>
                <td className="numc">{a.assetValueF ?? "—"}</td>
                <td className="numc">{a.renterDepthE ?? "—"}</td>
                <td className="numc">{a.measuredVolume ?? "—"}</td>
                <td style={{ fontSize: 12.5, maxWidth: 300 }}>
                  <span className={`badge ${hard ? "b-fail" : "b-neutral"}`} style={{ marginRight: 6 }}>{hard ? "hard rule" : "comparative"}</span>
                  {hard ? a.validation.gate.blockers[0] : "Did not clear the Wave-1 selection standard (demand ≥100/mo, F ≥50, organic ≥55, viable renter, verified geography) or was displaced by diversity caps."}
                </td>
              </tr>);
          })}
        </tbody>
      </table>
    </div>
  );
}
