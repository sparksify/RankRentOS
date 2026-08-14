import Link from "next/link";
import Nav from "./Nav";
import Badge from "./Badge";
import { loadRun, loadDecisions, idOf, money } from "../../lib/cockpit";

export const dynamic = "force-static";

// The command center reports REAL state only. RankRentOS is pre-launch: revenue,
// leads and rankings are genuinely zero, and this page says so rather than
// decorating the void. Operating metrics light up as deployment evidence arrives.
export default function Overview() {
  const run = loadRun();
  const dec = loadDecisions();
  const byKey = new Map(dec.assets.map((a) => [`${a.service}|${a.geography}|${a.state}`, a]));
  const finalists = run.assets.filter((a) => a.source === "FINALIST");
  const rows = finalists.map((a) => {
    const d = byKey.get(`${a.service}|${a.geography}|${a.state}`);
    return {
      id: idOf(a), service: a.service, geography: a.geography, state: a.state,
      decision: d?.new?.decision ?? "—", organic: a.organicV1 ?? null,
      leadValue: a.leadValueAssumedUsd ?? null, domain: a.preferredDomain ?? d?.preferredDomain ?? "—",
      isHub: d?.isHubPage ?? false,
    };
  }).sort((x, y) => (x.decision === "REVENUE_CANDIDATE" ? -1 : 1) - (y.decision === "REVENUE_CANDIDATE" ? -1 : 1) || (y.organic ?? 0) - (x.organic ?? 0));

  const domainsToBuy = run.purchaseList.length;
  const rev = dec.counts.REVENUE_CANDIDATE, exp = dec.counts.EXPERIMENTAL;

  return (
    <div className="shell">
      <Nav on="/cockpit" />
      <div className="pagehead">
        <h2>Portfolio Overview</h2>
        <p>The operating view. RankRentOS is pre-launch: research is complete, {finalists.length} assets are approved, and the factory is waiting on one human decision — the domain purchase.</p>
      </div>

      <div className="kpis">
        <div className="kpi"><label>Monthly revenue</label><b>$0</b><span className="cmp dim">0 rented assets · begins at first rental</span></div>
        <div className="kpi"><label>Leads — 30 days</label><b>0</b><span className="cmp dim">no live sites yet</span></div>
        <div className="kpi"><label>Live sites</label><b>0</b><span className="cmp" style={{ color: "var(--blue)" }}>{finalists.length} approved · awaiting purchase</span></div>
        <div className="kpi"><label>Revenue candidates</label><b>{rev}</b><span className="cmp dim">+{exp} pre-registered experiments</span></div>
        <div className="kpi"><label>Domains ready</label><b>{domainsToBuy}</b><span className="cmp" style={{ color: "var(--good)" }}>{money(run.economics.domainCost)} · verified available</span></div>
        <div className="kpi"><label>6-month runway</label><b>{money(run.economics.sixMonthExperimentCost)}</b><span className="cmp dim">{money(run.economics.monthlyCarrying)}/mo carrying</span></div>
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="sec" style={{ marginBottom: 0 }}>
          <h3>Portfolio performance <span className="dim" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 450 }}>— rank, leads and revenue fill in at deployment</span></h3>
          <div className="tablewrap"><table className="grid" style={{ boxShadow: "none", border: "none" }}>
            <thead><tr><th>Asset</th><th>Status</th><th>Decision</th><th className="numc">Organic</th><th className="numc">Rank</th><th className="numc">Leads 30d</th><th className="numc">Revenue</th></tr></thead>
            <tbody>
              {rows.slice(0, 9).map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/cockpit/opportunity/${r.id}`}><b>{r.service}</b></Link><div className="dim" style={{ fontSize: 11 }}>{r.geography}, {r.state}{r.isHub ? " · hub page" : ""}</div></td>
                  <td><span className="badge b-review">Approved</span></td>
                  <td><span className={`badge ${r.decision === "REVENUE_CANDIDATE" ? "b-pass" : "b-neutral"}`}>{r.decision === "REVENUE_CANDIDATE" ? "Revenue" : "Experiment"}</span></td>
                  <td className="numc">{r.organic ?? "—"}</td>
                  <td className="numc dim">—</td><td className="numc dim">—</td><td className="numc dim">—</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="note" style={{ marginTop: 8 }}><Link href="/cockpit/portfolio">View all {finalists.length} assets →</Link></p>
        </div>

        <div className="sec" style={{ marginBottom: 0 }}>
          <h3>Needs attention</h3>
          <div className="att"><span className="sig" style={{ background: "var(--blue)" }} />
            <div><b>{domainsToBuy} domains ready for purchase</b><p>Research complete, decision model run, availability re-verified at freeze. {money(run.economics.domainCost)} total. This is the one blocking human decision.</p><Link href="/cockpit/domains">Review domains →</Link></div></div>
          <div className="att"><span className="sig" style={{ background: "var(--warn)" }} />
            <div><b>Pool cluster launch is season-sensitive</b><p>Pool demand peaks spring–summer. The 12-community architecture experiment should deploy together and soon, or it under-reads for a year.</p><Link href="/cockpit/research">See experiment design →</Link></div></div>
          <div className="att"><span className="sig" style={{ background: "var(--bad)" }} />
            <div><b>Bellevue NE demand is unattributable</b><p>Its 2,400/mo is an upper bound shared with Bellevue WA. No tool can split it — only live Search Console data can. Deployed as an experiment, not a revenue bet.</p><Link href="/cockpit/opportunity/W1-C-003">View memo →</Link></div></div>
          <div className="att"><span className="sig" style={{ background: "var(--muted)" }} />
            <div><b>2,499 hypotheses remain unmeasured</b><p>67% of the researched universe has no demand data from any provider. The next discovery frontier once Wave 1 is live.</p><Link href="/cockpit/rejected">Reserves →</Link></div></div>
        </div>
      </div>

      <div className="sec">
        <h3>Portfolio pipeline — the factory</h3>
        <div className="pipe">
          <Link className="stage" href="/cockpit/research"><b>3,762</b><label>Hypotheses</label></Link>
          <Link className="stage" href="/cockpit/rejected"><b>168</b><label>Researched</label></Link>
          <Link className="stage" href="/cockpit/portfolio"><b>{finalists.length}</b><label>Approved</label></Link>
          <Link className="stage" href="/cockpit/domains"><b>{domainsToBuy}</b><label>Need domain</label></Link>
          <span className="stage zero"><b>0</b><label>Building</label></span>
          <span className="stage zero"><b>0</b><label>Live</label></span>
          <span className="stage zero"><b>0</b><label>Producing leads</label></span>
          <span className="stage zero"><b>0</b><label>Rented</label></span>
        </div>
        <p className="note" style={{ marginTop: 10 }}>Every stage left of "Need domain" is complete and auditable. Everything right of it begins when domains are purchased.</p>
      </div>

      <div className="grid2">
        <div className="sec" style={{ marginBottom: 0 }}>
          <h3>Leads &amp; revenue</h3>
          <div className="emptychart">
            <div>
              <b>No operating data yet — and no invented curves.</b>
              <p>This chart begins at first deployment. Instrumentation is already pre-registered: index date, ranking trajectory (weekly), impressions, calls, forms, lead value and realized rent, all joined to pre-launch predictions by experiment ID.</p>
            </div>
          </div>
        </div>
        <div className="sec" style={{ marginBottom: 0 }}>
          <h3>Domains ready to buy</h3>
          <div className="kv" style={{ marginBottom: 10 }}>
            <div><label>Approved</label><b>{domainsToBuy}</b></div>
            <div><label>Estimated cost</label><b>{money(run.economics.domainCost)}</b></div>
            <div><label>Split</label><b style={{ fontSize: 13 }}>{rev} revenue · {domainsToBuy - rev} experiment</b></div>
          </div>
          <div className="domain-mono">
            {run.purchaseList.slice(0, 6).map((d) => <div key={d.domain}>{d.domain}</div>)}
            <div className="dim">… {domainsToBuy - 6} more</div>
          </div>
          <p className="note" style={{ marginTop: 10 }}><Link href="/cockpit/domains"><b>Review &amp; approve purchase →</b></Link> RankRentOS will not buy them — that decision is yours.</p>
        </div>
      </div>
    </div>
  );
}
