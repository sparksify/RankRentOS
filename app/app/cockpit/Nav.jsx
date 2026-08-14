import Link from "next/link";

// Minimal geometric line icons — no icon library in the repo, so these stay inline.
const I = {
  overview: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  portfolio: <svg viewBox="0 0 24 24"><path d="M4 19V5m5.3 14V9m5.4 10v-7m5.3 7V4"/></svg>,
  compare: <svg viewBox="0 0 24 24"><path d="M7 4v16m0-16L4 7m3-3 3 3m7 13V4m0 16 3-3m-3 3-3-3"/></svg>,
  rejected: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 8.5l7 7m0-7-7 7"/></svg>,
  board: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/></svg>,
};

const NAV = [
  { group: "Main", items: [["/cockpit", "Overview", I.overview]] },
  { group: "Pipeline", items: [
    ["/cockpit/portfolio", "Final Portfolio", I.portfolio],
    ["/cockpit/comparison", "Before / After", I.compare],
    ["/cockpit/rejected", "Reserves & Rejected", I.rejected],
  ] },
];

const TITLES = {
  "/cockpit": "Run Overview",
  "/cockpit/portfolio": "Final Portfolio",
  "/cockpit/comparison": "Before / After",
  "/cockpit/rejected": "Reserves & Rejected",
};

export default function Nav({ on }) {
  return (
    <>
      <aside className="os-side">
        <div className="os-brand">
          <div className="os-mark">R</div>
          <div><b>RankRentOS</b><span>Decision Cockpit</span></div>
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
        <div className="crumb">{TITLES[on] || "Opportunity Memo"} <span>· validation-run-1</span></div>
        <div className="run-chip"><span className="dot" aria-hidden />READY FOR HUMAN PURCHASE DECISION</div>
      </header>
    </>
  );
}
