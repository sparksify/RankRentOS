"use client";
import { useEffect, useMemo, useState } from "react";
import { sb } from "../lib/config";

const STAGES = ["watchlist", "domain_bought", "site_built", "ranking", "renting"];
const STAGE_LABELS = { watchlist: "Watchlist", domain_bought: "Domain bought", site_built: "Site built", ranking: "Ranking", renting: "Renting 💰" };
const AVATAR_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#84cc16"];

function verdict(score) {
  if (score >= 60) return ["Good", "status-good", "#16a34a"];
  if (score >= 40) return ["Medium", "status-warn", "#f59e0b"];
  return ["Weak", "status-bad", "#dc2626"];
}
function demandStatus(vol, cpc) {
  if (vol >= 300) return ["Strong demand", "status-good"];
  if (vol >= 100) return ["Healthy demand", "status-good"];
  if (vol >= 30) return ["Modest demand", "status-warn"];
  return ["Thin demand", "status-bad"];
}
function whyBullets(m) {
  const g = m.signals || {}, out = [];
  if (g.volume >= 100) out.push(`~${g.volume} searches/month (Google Ads data)${g.cpc ? `; advertisers pay $${g.cpc}/click — proof the leads convert` : ""}.`);
  else if (g.volume >= 10) out.push(`~${g.volume} searches/month measured — modest but real${g.cpc ? ` (CPC $${g.cpc})` : ""}.`);
  if (g.directoriesInTop3) out.push(`${g.directoriesInTop3} of the top 3 Google results are directories — Google has no good local site to show. You'd be that site.`);
  if (g.innerPagesInTop5 >= 3) out.push(`${g.innerPagesInTop5} of the top 5 results are inner pages, not dedicated local sites.`);
  if (g.intentMismatchInTop5) out.push(`Retail/info pages rank for a service search — an exploitable mismatch.`);
  if (g.avgMapReviews !== undefined && g.avgMapReviews < 40) out.push(`Map pack sweet spot: listings average only ${g.avgMapReviews} reviews.`);
  if (g.autocompleteCityHit) out.push(`Google autocompletes this exact search for this city.`);
  if (g.competitorAvgWords && g.competitorAvgWords < 600) out.push(`Competitor content is thin (avg ${g.competitorAvgWords} words).`);
  if (g.competitorAvgDomainAge !== undefined && g.competitorAvgDomainAge < 4) out.push(`Young competition — top domains avg ${g.competitorAvgDomainAge} yrs old.`);
  if (g.buyerProof) out.push(`Buyer proof: businesses here already pay for leads.`);
  if (m.deep_check === "confirmed") out.push(`Deep-checked ✓ — weakness held across keyword variants.`);
  if (g.franchisesInTop3) out.push(`⚠️ ${g.franchisesInTop3} franchise brand(s) in the top 3.`);
  if (g.cpc > 16) out.push(`⚠️ CPC $${g.cpc} — an expensive ad war runs above the organic results.`);
  return out;
}

function Bars({ sig }) {
  const parts = [
    ["directoriesInTop3", 30, 15], ["innerPagesInTop5", 20, 5], ["intentMismatchInTop5", 12, 6],
    ["outOfTownInTop3", 8, 4], ["buyerProof", 8, 8], ["top3TitlesMissingCity", 10, 4],
  ];
  return (
    <div className="bars">
      {parts.map(([k, max, per]) => {
        const raw = sig?.[k];
        const v = typeof raw === "boolean" ? (raw ? max : 0) : Math.min((raw || 0) * per, max);
        const pct = v / max;
        const color = pct >= 0.66 ? "#16a34a" : pct > 0 ? "#f59e0b" : "#e9ecef";
        return <i key={k} style={{ height: `${Math.max(pct * 100, 12)}%`, background: color }} title={k} />;
      })}
    </div>
  );
}

export default function Page() {
  const [markets, setMarkets] = useState(null);
  const [pipeline, setPipeline] = useState({});
  const [runLabel, setRunLabel] = useState("");
  const [fNiche, setFNiche] = useState("");
  const [fMin, setFMin] = useState(40);
  const [fStage, setFStage] = useState("");
  const [fTicket, setFTicket] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("value");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => {
      const runs = await sb("runs?select=id,label,started_at&order=started_at.desc&limit=1");
      if (!runs.length) return setMarkets([]);
      setRunLabel(runs[0].label);
      const sel = `select=*,domains(domain,is_winner,winner_reason)`;
      const a = await sb(`markets?run_id=eq.${runs[0].id}&${sel}&order=score.desc&limit=1000`);
      const b = await sb(`markets?run_id=eq.${runs[0].id}&${sel}&order=score.desc&limit=1000&offset=1000`);
      const all = [...a, ...b].map((m) => ({ ...m, winner: (m.domains || []).find((d) => d.is_winner) || null }));
      setMarkets(all);
      const pl = await sb("pipeline?select=market_id,status,id");
      setPipeline(Object.fromEntries(pl.map((p) => [p.market_id, p])));
    })().catch((e) => { console.error(e); setMarkets([]); });
  }, []);

  async function setStage(m, status) {
    const existing = pipeline[m.id];
    if (existing) {
      await sb(`pipeline?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
      setPipeline({ ...pipeline, [m.id]: { ...existing, status } });
    } else {
      const [row] = await sb("pipeline", { method: "POST", body: JSON.stringify({ market_id: m.id, status }) });
      setPipeline({ ...pipeline, [m.id]: row });
    }
  }

  const niches = useMemo(() => [...new Set((markets || []).map((m) => m.niche))].sort(), [markets]);
  const shown = useMemo(() => {
    let rows = (markets || []).filter((m) =>
      (!fNiche || m.niche === fNiche) && m.score >= fMin &&
      (!q || m.city.toLowerCase().includes(q.toLowerCase())) &&
      (!fStage || pipeline[m.id]?.status === fStage) &&
      (!fTicket || (m.ticket_low + m.ticket_high) / 2 >= fTicket)
    );
    if (sort === "value") rows = [...rows].sort((a, b) => (b.value_rank || 0) - (a.value_rank || 0));
    else if (sort === "dollars") rows = [...rows].sort((a, b) => (b.est_monthly_value || 0) - (a.est_monthly_value || 0));
    else if (sort === "volume") rows = [...rows].sort((a, b) => (b.signals?.volume || 0) - (a.signals?.volume || 0));
    else rows = [...rows].sort((a, b) => b.score - a.score);
    return rows.slice(0, 100);
  }, [markets, fNiche, fMin, q, sort, fStage, fTicket, pipeline]);

  const stats = useMemo(() => {
    const ms = markets || [];
    const viable = ms.filter((m) => m.score >= 40 && (m.est_monthly_value || 0) >= 1000);
    return {
      total: ms.length,
      strong: ms.filter((m) => m.score >= 55).length,
      highValue: viable.length,
      tracked: Object.keys(pipeline).length,
      renting: Object.values(pipeline).filter((p) => p.status === "renting").length,
    };
  }, [markets, pipeline]);

  if (markets === null) return <div className="shell"><div className="loading">Loading markets from Supabase…</div></div>;

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">LS</div>
          <div><h1>LeadGen Scout</h1><span>{runLabel || "no runs yet"}</span></div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><label>Markets scanned</label><b>{stats.total.toLocaleString()}</b></div>
        <div className="kpi"><label>Strong (55+)</label><b className="status-good">{stats.strong}</b></div>
        <div className="kpi"><label>High-dollar ($1k+/mo)</label><b className="status-good">{stats.highValue}</b></div>
        <div className="kpi"><label>In pipeline</label><b>{stats.tracked}</b></div>
        <div className="kpi"><label>Renting</label><b className="status-good">{stats.renting}</b></div>
      </div>

      <div className="toolbar">
        <select value={fNiche} onChange={(e) => setFNiche(e.target.value)}>
          <option value="">All niches</option>
          {niches.map((n) => <option key={n}>{n}</option>)}
        </select>
        <select value={fMin} onChange={(e) => setFMin(+e.target.value)}>
          <option value={0}>Any score</option><option value={40}>40+</option><option value={55}>55+</option><option value={70}>70+</option>
        </select>
        <select value={fStage} onChange={(e) => setFStage(e.target.value)}>
          <option value="">Any stage</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <select value={fTicket} onChange={(e) => setFTicket(+e.target.value)}>
          <option value={0}>Any ticket</option><option value={5000}>$5k+ jobs</option><option value={15000}>$15k+ jobs</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="value">Sort: Best value (ease × $)</option><option value="dollars">Sort: Est. $/mo</option><option value="score">Sort: Score</option><option value="volume">Sort: Volume</option>
        </select>
        <input type="search" placeholder="Search city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="count">{shown.length} shown</span>
      </div>

      {shown.map((m, idx) => {
        const [v, vc, vcolor] = verdict(m.score);
        const g = m.signals || {};
        const [dLabel, dClass] = demandStatus(g.volume || 0, g.cpc);
        const stage = pipeline[m.id]?.status;
        const isOpen = open === m.id;
        const av = AVATAR_COLORS[m.niche.length % AVATAR_COLORS.length];
        return (
          <div className="mcard" key={m.id}>
            <div className="mhead">
              <div className="avatar" style={{ background: av }}>{m.niche[0]}</div>
              <span className="who">{m.city}, {m.state} · {m.region} · {Math.round(m.pop / 1000)}k pop · ${Math.round(m.income / 1000)}k income</span>
            </div>
            <div className="mtitle">{m.niche} — {m.city}, {m.state}</div>
            <div className="mgrid">
              <div className="mcell">
                <div className="lab">Market score: <b className={vc}>{v}</b></div>
                <div className="bignum">{m.score}</div>
                <div className="progress"><i style={{ width: `${m.score}%`, background: vcolor }} /></div>
                <div className="subline">{m.deep_check === "confirmed" ? "✓ deep-check verified" : "primary keyword only"}</div>
              </div>
              <div className="mcell">
                <div className="lab">Demand: <b className={dClass}>{dLabel}</b></div>
                <div className="bignum">{g.volume ?? "—"}<span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}> /mo</span></div>
                <div className="subline">{g.cpc ? `$${g.cpc} CPC — advertisers pay for this` : "no ad market measured"}</div>
              </div>
              <div className="mcell">
                <div className="lab">Est. value: <b className={(m.est_monthly_value || 0) >= 1000 ? "status-good" : (m.est_monthly_value || 0) >= 500 ? "status-warn" : ""}>{(m.est_monthly_value || 0) >= 1000 ? "High-dollar" : (m.est_monthly_value || 0) >= 500 ? "Mid" : "Low-rent"}</b></div>
                <div className="bignum">${(m.est_monthly_value || m.suggested_rent)?.toLocaleString() || "—"}<span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}> /mo</span></div>
                <div className="subline">${((m.ticket_low + m.ticket_high) / 2).toLocaleString()} avg job · ~{m.est_leads ?? "?"} leads/mo{m.commission_per_job ? ` · $${m.commission_per_job.toLocaleString()}/job comm.` : ""}</div>
              </div>
              <div className="mcell">
                <div className="lab">SERP weakness signals</div>
                <Bars sig={g} />
                <div className="subline">
                  {m.winner ? <a className="domainlink" href={`https://www.namecheap.com/domains/registration/results/?domain=${m.winner.domain}`} target="_blank" rel="noreferrer">{m.winner.domain} →</a> : <span>no domain pick</span>}
                </div>
              </div>
            </div>
            <div className="mfoot">
              {STAGES.map((s) => (
                <button key={s} className={`chip ${stage === s ? "active" : ""}`} onClick={() => setStage(m, s)}>{STAGE_LABELS[s]}</button>
              ))}
              <button className="chip expand-btn" onClick={() => setOpen(isOpen ? null : m.id)}>{isOpen ? "Hide detail" : "Why this market ▾"}</button>
            </div>
            {isOpen && (
              <div className="detail">
                <div>
                  <h4>Why this market</h4>
                  <ul>{whyBullets(m).map((b, i) => <li key={i}>{b}</li>)}</ul>
                </div>
                <div>
                  <h4>Who you'd outrank</h4>
                  {(m.top_organic || []).slice(0, 5).map((o, i) => (
                    <div className="evrow" key={i}><span className="pos">#{o.pos}</span><a href={o.link} target="_blank" rel="noreferrer">{(o.title || "").slice(0, 70)}</a></div>
                  ))}
                  {m.winner?.winner_reason && (<><h4 style={{ marginTop: 12 }}>Domain reasoning</h4><span style={{ fontSize: 12.5, color: "var(--muted)" }}>{m.winner.winner_reason}</span></>)}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {shown.length === 0 && <div className="loading">No markets match these filters.</div>}
    </div>
  );
}
