import Link from "next/link";
import Nav from "../Nav";
import Badge from "../Badge";
import { loadRun, idOf } from "../../../lib/cockpit";

export const dynamic = "force-static";

export default function Comparison() {
  const run = loadRun();
  const byKey = new Map(run.assets.map((a) => [a.key, a]));
  const rows = [...run.comparison].sort((a, b) => a.newRank - b.newRank);
  const movers = [...run.comparison].filter((c) => c.source === "FINALIST").sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const up = movers.filter((m) => m.delta > 0).slice(0, 3);
  const down = movers.filter((m) => m.delta < 0).slice(0, 3);

  return (
    <div className="shell">
      <Nav on="/cockpit/comparison" />
      <p className="note" style={{ marginBottom: 14, maxWidth: "82ch" }}>
        What we learned from this rerun. Both rankings are computed over the <b>same population</b> (finalists + reserves) using the
        same formula, so a movement reflects validation evidence rather than a change in the size of the pool. The frozen Wave-1 run
        is preserved untouched — this is a separate versioned pass.
      </p>

      <div className="kpis">
        <div className="kpi"><label>Moved up</label><b style={{ color: "var(--good)" }}>{movers.filter((m) => m.delta > 0).length}</b><span className="dim">finalists</span></div>
        <div className="kpi"><label>Moved down</label><b style={{ color: "var(--bad)" }}>{movers.filter((m) => m.delta < 0).length}</b><span className="dim">finalists</span></div>
        <div className="kpi"><label>Unchanged</label><b>{movers.filter((m) => m.delta === 0).length}</b></div>
        <div className="kpi"><label>Now failing</label><b style={{ color: "var(--bad)" }}>{run.comparison.filter((c) => c.source === "FINALIST" && c.gate === "FAIL").length}</b><span className="dim">of {run.counts.finalists} finalists</span></div>
      </div>

      {(up.length > 0 || down.length > 0) && (
        <div className="sec">
          <h3>Headline changes</h3>
          {up.map((m) => <div className="risk good" key={m.key}><b>▲ {m.service} — {m.geography}</b> moved up {m.delta} ({m.oldRank} → {m.newRank}). {m.primaryReason}</div>)}
          {down.map((m) => <div className="risk" key={m.key}><b>▼ {m.service} — {m.geography}</b> dropped {Math.abs(m.delta)} ({m.oldRank} → {m.newRank}). {m.primaryReason}</div>)}
        </div>)}

      <table className="grid">
        <thead><tr>
          <th>Opportunity</th><th>Source</th><th className="numc">Old</th><th className="numc">New</th><th className="numc">Δ</th>
          <th className="numc">Pre</th><th className="numc">Post</th><th>Validation</th><th>Primary reason for change</th>
        </tr></thead>
        <tbody>
          {rows.map((c) => {
            const a = byKey.get(c.key);
            const arrow = c.delta > 0 ? "up" : c.delta < 0 ? "down" : "flat";
            return (
              <tr key={c.key}>
                <td><Link href={`/cockpit/opportunity/${idOf(a)}`}><b>{c.service}</b></Link>
                  <div className="dim" style={{ fontSize: 11.5 }}>{c.geography}, {c.state}</div></td>
                <td><span className={`badge ${c.source === "FINALIST" ? "b-neutral" : "b-review"}`}>{c.source === "FINALIST" ? "Finalist" : "Reserve"}</span></td>
                <td className="numc dim">{c.oldRank}</td>
                <td className="numc rank">{c.newRank}</td>
                <td className={`numc ${arrow}`}>{c.delta > 0 ? `▲ ${c.delta}` : c.delta < 0 ? `▼ ${Math.abs(c.delta)}` : "—"}</td>
                <td className="numc dim">{c.preScore}</td>
                <td className="numc">{c.postScore}</td>
                <td><Badge status={c.gate} /></td>
                <td style={{ fontSize: 12.5, maxWidth: 340 }}>{c.primaryReason}</td>
              </tr>);
          })}
        </tbody>
      </table>
    </div>
  );
}
