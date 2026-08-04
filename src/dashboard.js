import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT } from "./env.js";

const results = JSON.parse(readFileSync(join(ROOT, "out", "results.json"), "utf8"));
const scored = results.filter((r) => r.score !== undefined).sort((a, b) => b.score - a.score);

const data = scored.map((r) => ({
  score: r.score, niche: r.niche, nicheId: r.nicheId, city: `${r.city}, ${r.state}`, cityOnly: r.city,
  region: r.region, pop: r.pop, income: r.income, ticket: r.ticket,
  rent: r.suggestedRent || null, peak: r.peakMonths || null,
  sig: r.signals || {}, domains: r.availableDomains || [], ads: r.advertisers || [],
  organic: (r.topOrganic || []).slice(0, 5), compAges: r.compAges || [],
  deep: r.deepCheck || null, strategy: r.domainStrategy || null,
  deal: r.dealType || "flat", commission: r.commissionPerJob || null,
  pick: r.domainPick || null, leads: r.estLeadsMo || null,
}));

const niches = [...new Set(data.map((r) => r.niche))];
const cities = [...new Set(data.map((r) => r.city))];

// ---- Top 20 picks: highest scores, max 4 per niche so the list is a portfolio, not one niche ----
const picks = [];
const perNiche = {};
for (const r of data) {
  if (picks.length >= 20) break;
  if ((perNiche[r.niche] || 0) >= 4) continue;
  picks.push(r); perNiche[r.niche] = (perNiche[r.niche] || 0) + 1;
}

// ---- Plain-English reasoning from signals ----
function whyBullets(r) {
  const g = r.sig, out = [];
  if (g.volume !== undefined) {
    if (g.volume >= 300) out.push(`<b>~${g.volume} searches/month</b> (Google Ads data) — clears the 300/mo demand floor comfortably${g.cpc ? `, and advertisers pay <b>$${g.cpc}/click</b> for this traffic (proof the leads convert)` : ""}.`);
    else if (g.volume >= 100) out.push(`<b>~${g.volume} searches/month</b> — solid demand for a rent-model site${g.cpc ? `; advertisers pay $${g.cpc}/click` : ""}.`);
    else if (g.volume >= 10) out.push(`<b>~${g.volume} searches/month measured</b> — modest; the SERP weakness makes it viable but expect a slower lead flow${g.cpc ? ` (CPC $${g.cpc})` : ""}.`);
    else out.push(`⚠️ <b>Little measured search volume</b> (keyword tools under-report hyper-local terms and autocomplete confirms activity, but treat lead-flow projections cautiously).`);
    if (g.cpc > 16) out.push(`⚠️ <b>CPC is $${g.cpc}</b> — valuable leads, but an expensive ad war signals serious competition for attention.`);
  }
  if (g.directoriesInTop3) out.push(`<b>${g.directoriesInTop3} of the top 3 Google results are directories</b> (Yelp/Angi-type sites) — Google is showing them because no good local site exists. You'd be that site.`);
  if (g.innerPagesInTop5 >= 3) out.push(`<b>${g.innerPagesInTop5} of the top 5 results are inner pages</b>, not dedicated local sites — a whole site built for this exact city + service outranks a page.`);
  if (g.intentMismatchInTop5) out.push(`<b>Retail/info pages are ranking for a service search</b> (Lowe's-type results) — a clear mismatch you can exploit.`);
  if (g.outOfTownInTop3) out.push(`<b>Out-of-town companies rank here</b> via service-area pages — no true local specialist exists.`);
  if (g.mapPack === "absent") out.push(`No map pack renders — offset by confirmed demand below, but keep an eye on volume.`);
  else if (g.avgMapReviews !== undefined && g.avgMapReviews < 40) out.push(`<b>Map pack is the sweet spot:</b> it exists (demand is real) but listings average only ${g.avgMapReviews} reviews — weak, contestable businesses.`);
  if (g.autocompleteCityHit) out.push(`<b>Google autocompletes this exact search for this city</b> — real people here type it often enough for Google to suggest it.`);
  if (g.trendWeight >= 1) out.push(`<b>One of the highest-demand niches we tested</b> (trend weight ${g.trendWeight}× across a 5-year Google Trends comparison of all 24 niches).`);
  if (g.competitorAvgWords && g.competitorAvgWords < 600) out.push(`<b>Competitor content is thin</b> — top sites average only ${g.competitorAvgWords} words. The SOP playbook (1,000+ words per service page) buries this.`);
  if (g.competitorAvgDomainAge !== undefined && g.competitorAvgDomainAge < 4) out.push(`<b>Young competition</b> — top domains average ${g.competitorAvgDomainAge} years old; no entrenched incumbent.`);
  if (g.buyerProof) out.push(`<b>A renter provably exists:</b> businesses in this market already pay for leads (ads or lead marketplaces present in the results).`);
  if (r.deep === "confirmed") out.push(`<b>Deep-checked ✓</b> — we re-tested with "best…" and "…company" keyword variants and the weakness held on all of them.`);
  if (g.franchisesInTop3) out.push(`⚠️ <b>${g.franchisesInTop3} franchise brand(s) in the top 3</b> — factored into the score as a penalty; verify before building.`);
  return out;
}

function moneyLine(r) {
  const flow = r.leads ? `Est. <b>~${r.leads} leads/mo</b> at #1 (from measured volume). ` : "";
  if (r.deal === "commission") return `${flow}Rent flat at up to <b>$${(r.rent||0).toLocaleString()}/mo</b> — or the bigger play: <b>commission at ~$${(r.commission||0).toLocaleString()} per closed job</b> (avg ticket ${r.ticket}). ${r.strategy || ""}`;
  return `${flow}Flat rent target: <b>$${(r.rent||0).toLocaleString()}/mo</b> (avg job ${r.ticket}). ${r.strategy || ""}`;
}

const esc=(s)=>String(s??"").replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const nc=(d)=>`https://www.namecheap.com/domains/registration/results/?domain=${d}`;

const pickCards = picks.map((r, i) => {
  const bullets = whyBullets(r).map((b) => `<li>${b}</li>`).join("");
  const dom = r.pick;
  return `<div class="card">
    <div class="cardhead">
      <div class="ranknum">${i + 1}</div>
      <div class="cardtitle">
        <div class="ct1">${esc(r.niche)}</div>
        <div class="ct2">${esc(r.city)} · ${esc(r.region)} · ${Math.round(r.pop/1000)}k people · $${Math.round(r.income/1000)}k household income${r.peak ? " · demand peaks " + r.peak.join("/") : ""}</div>
      </div>
      <div class="cardscore"><span>${r.score}</span><label>score</label></div>
    </div>
    <div class="cardbody">
      <div class="whycol">
        <h4>Why this market</h4>
        <ul class="why">${bullets}</ul>
        <p class="moneyline">${moneyLine(r)}</p>
      </div>
      <div class="domcol">
        <h4>The domain to buy</h4>
        ${dom ? `<a class="thedomain" href="${nc(dom.domain)}" target="_blank">${dom.domain}</a>
        <p class="domwhy">${esc(dom.why)}</p>
        ${dom.runnerUp ? `<p class="domalt">Backup: <a href="${nc(dom.runnerUp)}" target="_blank">${dom.runnerUp}</a></p>` : ""}
        <p class="domalt">${r.domains.length} names open in total</p>` : `<p class="domwhy">No exact-match names open — competitor signal; consider a brand-style (PMD) name.</p>`}
        <h4 style="margin-top:14px">Who you'd outrank</h4>
        ${r.organic.slice(0,3).map((o)=>`<div class="ev">#${o.pos} <a href="${esc(o.link)}" target="_blank">${esc((o.title||"").slice(0,70))}</a></div>`).join("")}
      </div>
    </div>
  </div>`;
}).join("\n");

// ---- niche leaderboard + city callouts ----
const byN = {}; for (const r of data) (byN[r.niche] = byN[r.niche] || []).push(r.score);
const lead = niches.map((n) => { const s = byN[n]; return { n, avg: Math.round(s.reduce((a,b)=>a+b,0)/s.length), strong: s.filter((x)=>x>=55).length }; }).sort((a,b)=>b.avg-a.avg);
const byC = {}; for (const r of data) (byC[r.city] = byC[r.city] || []).push(r);
const softCities = Object.entries(byC).map(([c, rs]) => ({ c, strong: rs.filter((x)=>x.score>=55).length, best: rs.sort((a,b)=>b.score-a.score)[0] })).sort((a,b)=>b.strong-a.strong).slice(0,6);

const html = `<title>LeadGen Scout — Decisions</title>
<style>
:root{--bg:#f6f5f1;--panel:#fff;--ink:#20241d;--muted:#71766a;--line:#e2e0d8;--accent:#3d6b47;--accent-ink:#fff;--hi:#2e7d43;--mid:#a07713;--lo:#9a9d94;--chip:#ecebe3;--heat0:#eeede6;--heat1:#cfe3d3;--heat2:#8fc49b;--heat3:#3d8a52;--heat4:#1f6b38}
@media (prefers-color-scheme:dark){:root{--bg:#181a16;--panel:#21241e;--ink:#e7e5dd;--muted:#989c90;--line:#32352d;--accent:#7fb389;--accent-ink:#141613;--hi:#7fc98d;--mid:#d9a83c;--lo:#6f736a;--chip:#2a2d26;--heat0:#24271f;--heat1:#2c3d2f;--heat2:#3a5c41;--heat3:#4f8a5c;--heat4:#6fbf80}}
:root[data-theme="dark"]{--bg:#181a16;--panel:#21241e;--ink:#e7e5dd;--muted:#989c90;--line:#32352d;--accent:#7fb389;--accent-ink:#141613;--hi:#7fc98d;--mid:#d9a83c;--lo:#6f736a;--chip:#2a2d26;--heat0:#24271f;--heat1:#2c3d2f;--heat2:#3a5c41;--heat3:#4f8a5c;--heat4:#6fbf80}
:root[data-theme="light"]{--bg:#f6f5f1;--panel:#fff;--ink:#20241d;--muted:#71766a;--line:#e2e0d8;--accent:#3d6b47;--accent-ink:#fff;--hi:#2e7d43;--mid:#a07713;--lo:#9a9d94;--chip:#ecebe3;--heat0:#eeede6;--heat1:#cfe3d3;--heat2:#8fc49b;--heat3:#3d8a52;--heat4:#1f6b38}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:15px/1.55 "Avenir Next","Segoe UI",system-ui,sans-serif;margin:0;padding:30px 4vw 80px;max-width:1180px;margin-inline:auto}
h1{font-size:26px;font-weight:700;letter-spacing:-.015em;margin:0 0 4px}
h2{font-size:19px;font-weight:700;margin:52px 0 6px;letter-spacing:-.01em}
.lede{color:var(--muted);font-size:14.5px;max-width:70ch;margin:0 0 8px}
.verdict{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:8px;padding:16px 20px;margin:20px 0 34px;font-size:15px;max-width:75ch}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;margin-bottom:18px;overflow:hidden}
.cardhead{display:flex;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid var(--line)}
.ranknum{font-size:26px;font-weight:700;color:var(--muted);min-width:38px;text-align:center;font-variant-numeric:tabular-nums}
.cardtitle{flex:1}
.ct1{font-size:18px;font-weight:700;letter-spacing:-.01em}
.ct2{font-size:12.5px;color:var(--muted)}
.cardscore{text-align:center}
.cardscore span{font-size:30px;font-weight:700;color:var(--hi);font-variant-numeric:tabular-nums}
.cardscore label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.cardbody{display:grid;grid-template-columns:1.4fr 1fr;gap:0}
.whycol{padding:16px 20px;border-right:1px solid var(--line)}
.domcol{padding:16px 20px}
h4{margin:0 0 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600}
ul.why{margin:0;padding-left:18px}
ul.why li{margin-bottom:7px;font-size:13.5px}
.moneyline{margin:12px 0 0;padding:10px 12px;background:var(--chip);border-radius:6px;font-size:13px}
.thedomain{display:inline-block;font-size:17px;font-weight:700;color:var(--accent);text-decoration:none;border:1.5px solid var(--accent);border-radius:8px;padding:8px 14px;margin-bottom:8px}
.thedomain:hover{background:var(--accent);color:var(--accent-ink)}
.domwhy{font-size:12.5px;color:var(--muted);margin:6px 0}
.domalt{font-size:12px;color:var(--muted);margin:4px 0}
.domalt a{color:var(--accent);text-decoration:none}
.ev{font-size:12px;margin-bottom:4px}
.ev a{color:var(--accent);text-decoration:none}
.lead{display:grid;grid-template-columns:230px 1fr 90px;gap:10px;align-items:center;font-size:13px;margin-bottom:6px}
.bar{height:10px;border-radius:5px;background:var(--chip);overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent);border-radius:5px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px}
.citygrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.citycard{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px;font-size:13px}
.citycard b{font-size:15px}
.heatwrap{overflow-x:auto;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}
.heat{border-collapse:collapse;font-size:10.5px}
.heat th{font-weight:600;color:var(--muted);padding:3px 6px;text-align:left;white-space:nowrap}
.heat th.col{writing-mode:vertical-rl;transform:rotate(200deg);vertical-align:bottom;padding:4px 1px}
.heat td{width:30px;height:24px;text-align:center;border:2px solid var(--panel);border-radius:4px;font-weight:600;font-variant-numeric:tabular-nums}
details{margin-top:10px}
summary{cursor:pointer;font-weight:600;color:var(--accent)}
.controls{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
select,input[type=search]{background:var(--panel);border:1px solid var(--line);color:var(--ink);border-radius:6px;padding:6px 10px;font-size:13px}
.row{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 14px;margin-bottom:6px;display:grid;grid-template-columns:44px 1.2fr 1fr 1fr auto;gap:10px;align-items:center;font-size:13px}
.row .sc{font-weight:700;font-size:17px;text-align:center;font-variant-numeric:tabular-nums}
.meta{color:var(--muted);font-size:11.5px}
@media (max-width:760px){.cardbody{grid-template-columns:1fr}.whycol{border-right:none;border-bottom:1px solid var(--line)}.row{grid-template-columns:36px 1fr auto}}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
<h1>LeadGen Scout — Start Here</h1>
<p class="lede">We scanned <b>${data.length.toLocaleString()} markets</b> (${niches.length} niches × ${cities.length} cities) for rank-and-rent opportunities. Score = how winnable the Google results are × whether real search demand exists. The top 30 were re-verified with extra keyword phrasings.</p>
<div class="verdict"><b>The verdict:</b> ${data.filter(r=>r.score>=70).length} exceptional markets and ${data.filter(r=>r.score>=55&&r.score<70).length} strong ones. Water softeners and appliance repair are the breakout niches. Below are the <b>20 we'd start with</b> — capped at 4 per niche so you get a diversified portfolio, not one bet. Total cost to claim all 20 domains: ~$200.</div>

<h2>The Top 20 — build these first</h2>
${pickCards}

<h2>Niche leaderboard</h2>
<p class="lede">Average score across all ${cities.length} cities — which service categories travel.</p>
<div class="panel">${lead.map((x)=>`<div class="lead"><div>${esc(x.n)}</div><div class="bar"><i style="width:${x.avg}%"></i></div><div style="text-align:right;font-variant-numeric:tabular-nums"><b>${x.avg}</b> <span class="meta">${x.strong} strong</span></div></div>`).join("")}</div>

<h2>Cities soft in multiple niches</h2>
<p class="lede">Blanket-the-metro candidates: one city, several rentable sites, one bench of local renters.</p>
<div class="citygrid">${softCities.map((x)=>`<div class="citycard"><b>${esc(x.c)}</b><br>${x.strong} niches scoring 55+<br><span class="meta">best: ${esc(x.best.niche)} (${x.best.score})</span></div>`).join("")}</div>

<h2>The full map</h2>
<p class="lede">Every niche × city cell, colored by score (darker green = softer market). This is the raw terrain the Top 20 was picked from — click nothing, just scan for dark bands: a dark <i>row</i> means the niche travels; a dark <i>column</i> means the city is soft everywhere.</p>
<div class="heatwrap"><table class="heat" id="heat"></table></div>

<h2>Explore everything</h2>
<div class="controls">
  <select id="fNiche"><option value="">All niches</option>${niches.map((n)=>`<option>${esc(n)}</option>`).join("")}</select>
  <input type="search" id="fSearch" placeholder="Search city…">
  <select id="fMin"><option value="0">Any score</option><option value="55">55+</option><option value="70" selected>70+</option></select>
</div>
<div id="list"></div>

<script>
const DATA=${JSON.stringify(data.map((r)=>({score:r.score,niche:r.niche,city:r.city,region:r.region,rent:r.rent,deal:r.deal,commission:r.commission,dom:r.pick?.domain||null,deep:r.deep})))};
const NICHES=${JSON.stringify(niches)};
const CITIES=${JSON.stringify(cities)};
const HEAT=${JSON.stringify(Object.fromEntries(data.map((r)=>[r.niche+"|"+r.city,r.score])))};
function heatColor(s){return s>=60?'var(--heat4)':s>=48?'var(--heat3)':s>=36?'var(--heat2)':s>=24?'var(--heat1)':'var(--heat0)'}
(function(){
  let h='<tr><th></th>'+CITIES.map((c)=>'<th class="col">'+c.split(',')[0]+'</th>').join('')+'</tr>';
  for(const n of NICHES){h+='<tr><th>'+n+'</th>'+CITIES.map((c)=>{const s=HEAT[n+'|'+c];return s===undefined?'<td></td>':'<td style="background:'+heatColor(s)+';color:'+(s>=48?'#fff':'inherit')+'" title="'+n+' — '+c+'">'+s+'</td>';}).join('')+'</tr>';}
  document.getElementById('heat').innerHTML=h;
})();
function render(){
  const fn=document.getElementById('fNiche').value,q=document.getElementById('fSearch').value.toLowerCase(),min=+document.getElementById('fMin').value;
  const rows=DATA.filter((r)=>(!fn||r.niche===fn)&&(!q||r.city.toLowerCase().includes(q))&&r.score>=min);
  document.getElementById('list').innerHTML=rows.slice(0,200).map((r)=>'<div class="row"><div class="sc">'+r.score+'</div><div><b>'+r.niche+'</b></div><div>'+r.city+'<div class="meta">'+r.region+'</div></div><div>'+(r.deal==='commission'?'~$'+(r.commission||0).toLocaleString()+'/job':'$'+(r.rent||0).toLocaleString()+'/mo')+'<div class="meta">'+(r.deep?'deep: '+r.deep:'')+'</div></div><div>'+(r.dom?'<a style="color:var(--accent);text-decoration:none" href="https://www.namecheap.com/domains/registration/results/?domain='+r.dom+'" target="_blank">'+r.dom+'</a>':'')+'</div></div>').join('')+(rows.length>200?'<p class="meta">Showing 200 of '+rows.length+' — narrow the filters.</p>':'');
}
['fNiche','fSearch','fMin'].forEach((id)=>document.getElementById(id).addEventListener('input',render));
render();
</script>`;

writeFileSync(join(ROOT, "out", "dashboard.html"), html);
console.log(`Decision dashboard: out/dashboard.html — ${picks.length} picks, ${data.length} markets total`);
