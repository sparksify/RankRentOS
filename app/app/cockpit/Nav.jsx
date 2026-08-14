import Link from "next/link";

const I = {
  overview: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  research: <svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>,
  portfolio: <svg viewBox="0 0 24 24"><path d="M4 19V5m5.3 14V9m5.4 10v-7m5.3 7V4"/></svg>,
  compare: <svg viewBox="0 0 24 24"><path d="M7 4v16m0-16L4 7m3-3 3 3m7 13V4m0 16 3-3m-3 3-3-3"/></svg>,
  rejected: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 8.5l7 7m0-7-7 7"/></svg>,
  domains: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c-2.7 2.3-4 5.2-4 8.5s1.3 6.2 4 8.5c2.7-2.3 4-5.2 4-8.5s-1.3-6.2-4-8.5z"/></svg>,
  leads: <svg viewBox="0 0 24 24"><path d="M20 15.5v3a1.5 1.5 0 0 1-1.7 1.5A17 17 0 0 1 4 5.7 1.5 1.5 0 0 1 5.5 4h3L10 8l-2 1.7a13.5 13.5 0 0 0 6.3 6.3L16 14l4 1.5z"/></svg>,
  revenue: <svg viewBox="0 0 24 24"><path d="M12 3v18M7.5 7.5c0-1.7 2-3 4.5-3s4.5 1.3 4.5 3-2 3-4.5 3-4.5 1.3-4.5 3 2 3 4.5 3 4.5-1.3 4.5-3"/></svg>,
};

const NAV = [
  { group: "Portfolio", items: [["/cockpit", "Overview", I.overview]] },
  { group: "Growth", items: [
    ["/cockpit/research", "Research Run", I.research],
    ["/cockpit/portfolio", "Final Portfolio", I.portfolio],
    ["/cockpit/comparison", "Before / After", I.compare],
    ["/cockpit/rejected", "Reserves & Rejected", I.rejected],
    ["/cockpit/domains", "Domains", I.domains],
  ] },
  { group: "Monetization", items: [
    ["/cockpit/leads", "Leads & Calls", I.leads],
    ["/cockpit/revenue", "Revenue", I.revenue],
  ] },
];

const TITLES = {
  "/cockpit": "Portfolio Overview",
  "/cockpit/research": "Research Run",
  "/cockpit/portfolio": "Final Portfolio",
  "/cockpit/comparison": "Before / After",
  "/cockpit/rejected": "Reserves & Rejected",
  "/cockpit/domains": "Domains",
  "/cockpit/leads": "Leads & Calls",
  "/cockpit/revenue": "Revenue",
};

export default function Nav({ on }) {
  return (
    <>
      <aside className="os-side">
        <div className="os-brand">
          <div className="os-mark">R</div>
          <div><b>RankRentOS</b><span>Portfolio Command</span></div>
        </div>
        <nav className="os-nav">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <div className="os-group">{group}</div>
              {items.map(([href, label, icon]) => (
                <Link key={href} href={href} className={on === href ? "on" : ""}>{icon}{label}</Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="os-foot">wave1-v3 · frozen 2026-08-12<br/>nothing purchased · nothing deployed</div>
      </aside>
      <header className="os-top">
        <div className="crumb">{TITLES[on] || "Opportunity Memo"} <span>· decision-v2.0.0</span></div>
        <div className="run-chip"><span className="dot" aria-hidden />PRE-LAUNCH · AWAITING PURCHASE APPROVAL</div>
      </header>
    </>
  );
}
