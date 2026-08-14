import Link from "next/link";
import Nav from "../Nav";

export const dynamic = "force-static";

export default function Leads() {
  return (
    <div className="shell">
      <Nav on="/cockpit/leads" />
      <div className="pagehead"><h2>Leads &amp; Calls</h2><p>Pre-launch. This section activates at first deployment.</p></div>
      <div className="kpis">
        <div className="kpi"><label>Leads — 30 days</label><b>0</b><span className="cmp dim">no live sites</span></div>
        <div className="kpi"><label>Calls</label><b>0</b><span className="cmp dim">call tracking not yet connected</span></div>
        <div className="kpi"><label>Forms</label><b>0</b><span className="cmp dim">—</span></div>
        <div className="kpi"><label>Qualified</label><b>0</b><span className="cmp dim">—</span></div>
      </div>
      <div className="sec">
        <h3>What will appear here</h3>
        <p className="note" style={{ maxWidth: "84ch" }}>
          Per-asset calls, forms, durations, qualification and routing to renters — every event joined back to pre-launch
          predictions by experiment ID, so lead volume validates Dimension B and lead value replaces the HUMAN_ASSUMED
          economics in D and F. The measurement contract is already pre-registered:
          calls, forms, leadsTotal, qualifiedLeads, leadValueRealized, renterOutreach, renterResponses.
        </p>
        <p className="note" style={{ marginTop: 8 }}>
          Integration order after deployment: Search Console (impressions/queries) → call tracking → form events.
          {" "}<Link href="/cockpit/research">See the pre-registered outcome contract →</Link>
        </p>
      </div>
    </div>
  );
}
