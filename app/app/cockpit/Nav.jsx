import Link from "next/link";

export default function Nav({ on }) {
  const tabs = [
    ["/cockpit", "Run Overview"],
    ["/cockpit/portfolio", "Final Portfolio"],
    ["/cockpit/comparison", "Before / After"],
    ["/cockpit/rejected", "Reserves & Rejected"],
  ];
  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <h1>RankRentOS — Decision Cockpit</h1>
            <span>Pre-purchase validation · nothing purchased, nothing deployed</span>
          </div>
        </div>
      </div>
      <div className="nav">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className={on === href ? "on" : ""}>{label}</Link>
        ))}
      </div>
    </>
  );
}
