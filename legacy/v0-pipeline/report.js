import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT } from "./env.js";

const results = JSON.parse(readFileSync(join(ROOT, "out", "results.json"), "utf8"));
const scored = results.filter((r) => r.score !== undefined).sort((a, b) => b.score - a.score);

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const rows = scored.map((r) => {
  const sig = r.signals || {};
  const domains = (r.availableDomains || [])
    .map((d) => `<a href="https://www.namecheap.com/domains/registration/results/?domain=${d}" target="_blank">${d}</a>`)
    .join("<br>");
  const evidence = (r.topOrganic || [])
    .map((o) => `<div class="ev">#${o.pos} <a href="${esc(o.link)}" target="_blank">${esc(o.title)}</a></div>`)
    .join("");
  const ads = (r.advertisers || []).map(esc).join("<br>") || "—";
  return `<tr>
    <td class="score s${r.score >= 70 ? "hi" : r.score >= 50 ? "mid" : "lo"}">${r.score}</td>
    <td><b>${esc(r.niche)}</b><br><span class="dim">${esc(r.ticket)}</span></td>
    <td>${esc(r.city)}, ${esc(r.state)}<br><span class="dim">${esc(r.region)} · pop ${(r.pop / 1000).toFixed(0)}k · $${(r.income / 1000).toFixed(0)}k HHI</span></td>
    <td class="dim">dirs:${sig.directoriesInTop3 ?? "?"} inner:${sig.innerPagesInTop5 ?? "?"} map:${sig.mapPackSize ?? "?"}${sig.avgMapReviews !== undefined ? ` (${sig.avgMapReviews} rev avg)` : ""} ads:${sig.adCount ?? "?"}</td>
    <td>${domains || "—"}</td>
    <td>${ads}</td>
    <td class="evidence">${evidence}</td>
  </tr>`;
}).join("\n");

const html = `<!doctype html><meta charset="utf-8"><title>leadgen-scout results</title>
<style>
  body{font:14px/1.45 -apple-system,sans-serif;margin:24px;color:#1a1a1a}
  h1{font-size:20px} .dim{color:#777;font-size:12px}
  table{border-collapse:collapse;width:100%} td,th{border-bottom:1px solid #e5e5e5;padding:8px;vertical-align:top;text-align:left}
  .score{font-size:20px;font-weight:700;text-align:center;width:52px}
  .shi{color:#0a7d33}.smid{color:#b57d00}.slo{color:#999}
  .ev{font-size:12px;margin-bottom:2px} .evidence{max-width:420px}
  a{color:#0b57d0;text-decoration:none}
</style>
<h1>leadgen-scout — ${scored.length} scored markets</h1>
<p class="dim">Generated ${new Date().toLocaleString()}. Score = organic winnability (directories/inner pages in top results, weak map pack, ad-proven demand, city fit). Domain links go to Namecheap search — purchases are manual.</p>
<table>
<tr><th>Score</th><th>Niche</th><th>City</th><th>Signals</th><th>Available domains</th><th>Advertisers (renter leads)</th><th>Top organic (evidence)</th></tr>
${rows}
</table>`;

const out = join(ROOT, "out", "report.html");
writeFileSync(out, html);
console.log(`Report: ${out}`);
