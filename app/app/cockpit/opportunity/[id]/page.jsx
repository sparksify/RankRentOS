import Link from "next/link";
import Nav from "../../Nav";
import Badge from "../../Badge";
import { loadRun, findAsset, idOf, money, num } from "../../../../lib/cockpit";

export const dynamic = "force-static";
export function generateStaticParams() { return loadRun().assets.map((a) => ({ id: idOf(a) })); }

const DIMS = [
  ["A", "Rankability", "How beatable the search results are (includes map-pack weakness)"],
  ["B", "Demand", "Measured search volume for the exact term"],
  ["C", "Commercial Intent", "Whether advertisers are paying to acquire this customer"],
  ["D", "Lead Economics", "Gross profit the renter earns per lead"],
  ["E", "Renter Depth", "How many local operators could actually rent this"],
  ["F", "Asset Value", "Realizable monthly gross profit from the lead flow"],
  ["G", "Time-to-Signal", "How fast we expect first ranking movement"],
  ["H", "Asymmetry", "Whether the upside is unusually mispriced"],
  ["I", "Confidence", "Evidence quality — independent of opportunity quality"],
];
const REC = (s) => s === "PASS" ? ["BUY CANDIDATE", "b-pass"] : s === "PASS_WITH_WARNING" ? ["BUY CANDIDATE — WITH WARNINGS", "b-warn"]
  : s === "NEEDS_REVIEW" ? ["NEEDS REVIEW BEFORE BUYING", "b-review"] : ["DO NOT BUY", "b-fail"];

function Tree({ node, lvl = 0 }) {
  return (
    <>
      <div className={`lvl${Math.min(lvl, 3)}`}>{lvl > 0 ? "└─ " : ""}<b>{node.path}</b> <span className="dim">{node.label}</span></div>
      {(node.children || []).map((c) => <Tree key={c.path} node={c} lvl={lvl + 1} />)}
    </>
  );
}

export default async function Detail({ params }) {
  const { id } = await params;
  const a = findAsset(id);
  if (!a) return <div className="shell"><Nav /><p>Not found.</p></div>;
  const run = loadRun();
  const cmp = run.comparison.find((c) => c.key === a.key);
  const v = a.validation;
  const [recText, recCls] = REC(v.gate.status);
  const isCommunity = a.geographyType === "master-planned-community";

  return (
    <div className="shell">
      <Nav on="/cockpit/portfolio" />
      <p style={{ marginBottom: 12 }}><Link href="/cockpit/portfolio">← Back to portfolio</Link></p>

      <div className="memo-head">
        <h2>{a.service} — {a.geography}, {a.state}</h2>
        <div className="sub">{a.experimentId} · {a.cohort} · {a.geographyType}{a.parentCity ? ` in ${a.parentCity}` : ""} · {a.source}</div>
        <div className="rec"><span className={`badge ${recCls}`} style={{ fontSize: 13, padding: "5px 12px" }}>{recText}</span>
          {cmp && <span className="dim" style={{ fontWeight: 400, fontSize: 13 }}>rank #{cmp.newRank} (was #{cmp.oldRank})</span>}</div>
        <div className="why"><b>Why this opportunity exists.</b> {v.intent.explanation} {v.expansion.explanation}</div>
        {a.hypothesis && <div className="why"><b>Hypothesis under test.</b> {a.hypothesis}</div>}
      </div>

      {(v.gate.blockers.length > 0 || v.gate.warnings.length > 0 || v.gate.reasons.length > 0) && (
        <div className="sec">
          <h3>Risks &amp; what could lose us money</h3>
          {v.gate.blockers.map((b, i) => <div className="risk blocker" key={i}><b>Blocker.</b> {b}</div>)}
          {v.gate.warnings.map((w, i) => <div className="risk" key={i}><b>Warning.</b> {w}</div>)}
          {v.gate.reasons.map((r, i) => <div className="risk good" key={i}>{r}</div>)}
        </div>
      )}

      <div className="sec">
        <h3>Scorecard — A–I (each dimension separate, never a mystery number)</h3>
        {a.dimensions ? DIMS.map(([letter, name, blurb]) => {
          const d = a.dimensions[letter];
          const val = d?.score;
          return (
            <div className="score-row" key={letter}>
              <div className="lt">{letter}</div>
              <div className="vl">{val ?? <span className="dim" style={{ fontSize: 13 }}>—</span>}</div>
              <div className="ex">
                <b>{name}</b> <span className="dim" style={{ fontWeight: 400 }}>— {blurb}</span>
                {typeof val === "number" && <div className="bar"><i style={{ width: `${val}%` }} /></div>}
                <div className="meta">
                  {(d?.rationale || []).slice(0, 2).join(" · ") || "No rationale recorded."}
                  {d?.confidence != null && ` · confidence ${Number(d.confidence).toFixed(2)}`}
                  {d?.version && ` · ${d.version}`}
                  {d?.missing?.length ? ` · missing: ${d.missing.slice(0, 2).join(", ")}` : ""}
                  {letter === "D" && ` · assumes $${num(a.ticketAssumed)} ticket × ${a.marginAssumed} margin × 10% close = $${num(a.leadValueAssumedUsd)}/lead (HUMAN_ASSUMED)`}
                  {letter === "E" && v.renterEvidence?.note ? ` · ${v.renterEvidence.note}` : ""}
                </div>
              </div>
            </div>);
        }) : (
          <div className="note" style={{ marginBottom: 8 }}>{a.dimensionsNote}</div>
        )}
        <div className="score-row">
          <div className="lt" style={{ color: "var(--ink)" }}>O</div>
          <div className="vl">{a.organicV1 ?? "—"}</div>
          <div className="ex"><b>Organic-only rankability ({a.organicVersion || "organic-v1.2"})</b>
            {a.organicV1 != null && <div className="bar"><i style={{ width: `${a.organicV1}%` }} /></div>}
            <div className="meta">{a.organicVerdict} · Scores only organic positions 1–10, excluding map-pack credit we cannot earn without a Google Business Profile.
              {a.modelDisagreement ? ` Dimension A and this model disagree by ${a.modelDisagreement} points — this asset is part of the model-validation test.` : ""}</div>
          </div>
        </div>
        <div className="score-row">
          <div className="lt">I</div>
          <div className="vl">{typeof a.evidenceConfidence === "number" ? a.evidenceConfidence : "—"}</div>
          <div className="ex"><b>Confidence / evidence quality</b>
            <div className="meta">How much we trust the evidence — deliberately independent of how good the opportunity is. Completeness: {a.evidenceCompleteness ?? "—"}%.</div></div>
        </div>
      </div>

      <div className="sec">
        <h3>Search demand</h3>
        <div className="kv">
          <div><label>Exact-match volume</label><b>{a.measuredVolume === 0 ? "0" : num(a.measuredVolume)}</b></div>
          <div><label>CPC</label><b>{a.cpc ? `$${a.cpc}` : "—"}</b></div>
          <div><label>Demand status</label><b style={{ fontSize: 13 }}>{a.demandProven === false ? "UNPROVEN" : "measured"}</b></div>
          <div><label>Assumed lead value</label><b>{money(a.leadValueAssumedUsd)}</b></div>
        </div>
        <p className="note" style={{ marginTop: 10 }}>{a.volumeState}</p>
      </div>

      <div className="sec">
        <h3>SERP &amp; rankability — what Google actually shows</h3>
        <div className="slots">{(a.organicTop5 || v.intent.evidence.topSlots).map((s, i) => {
          const m = String(s).match(/^(\d+)\.\s(\S+)\s\[(.+)\]$/);
          return <div key={i}>{m ? <>{m[1]}. <b>{m[2]}</b> <span className="tag">[{m[3]}]</span></> : s}</div>;
        })}</div>
        <div className="kv" style={{ marginTop: 14 }}>
          <div><label>Distinct hosts (top 5)</label><b>{a.organicStructure?.distinctHostsTop5 ?? "—"}</b></div>
          <div><label>Displaceable</label><b>{a.organicStructure?.displaceableTop5 ?? "—"}</b></div>
          <div><label>Hard local (top 3)</label><b>{a.organicStructure?.hardLocalTop3 ?? "—"}</b></div>
          <div><label>Targeting this geo</label><b>{a.organicStructure?.geoTargetedCompetitorsTop5 ?? "—"}</b></div>
          <div><label>Content bar</label><b>{a.contentBarWords ? `${num(a.contentBarWords)}w` : "—"}</b></div>
          <div><label>Competitor domain age</label><b>{a.competitorDomainAgeYears ? `${a.competitorDomainAgeYears}y` : "—"}</b></div>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          Local pack: {a.localPackEvidence?.mapPackSize ?? "—"} listings{a.localPackEvidence?.avgReviews ? `, ${a.localPackEvidence.avgReviews} avg reviews` : ""}.
          {" "}{a.localPackEvidence?.note || "Market evidence only — excluded from organic scoring."}
        </p>
      </div>

      <div className="sec">
        <h3>Commercial intent — {v.intent.intentClass.replace(/_/g, " ").toLowerCase()} <Badge status={v.intent.verdict} /></h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: "80ch" }}>{v.intent.explanation}</p>
        <div className="kv" style={{ marginTop: 12 }}>
          <div><label>Local operators</label><b>{v.intent.evidence.localOperatorsTop10}</b></div>
          <div><label>Directories</label><b>{v.intent.evidence.directoriesTop10}</b></div>
          <div><label>National retail</label><b>{v.intent.evidence.nationalRetailTop10}</b></div>
          <div><label>Editorial</label><b>{v.intent.evidence.informationalTop10}</b></div>
          <div><label>Reference</label><b>{v.intent.evidence.institutionalTop10}</b></div>
          <div><label>Ads</label><b>{v.intent.evidence.adCount ?? "—"}</b></div>
        </div>
      </div>

      <div className="sec">
        <h3>Economics</h3>
        <div className="kv">
          <div><label>Assumed ticket</label><b>{money(a.ticketAssumed)}</b></div>
          <div><label>Assumed margin</label><b>{a.marginAssumed ?? "—"}</b></div>
          <div><label>Lead value</label><b>{money(a.leadValueAssumedUsd)}</b></div>
          <div><label>Viable renters</label><b>{v.renterEvidence?.viableRenters ?? a.renterContext?.viableRenters ?? "—"}</b></div>
          <div><label>Operators seen</label><b>{a.renterContext?.relevantOperators ?? "—"}</b></div>
          <div><label>Website adoption</label><b>{a.renterContext?.websiteAdoptionPct != null ? `${a.renterContext.websiteAdoptionPct}%` : "—"}</b></div>
        </div>
        <p className="note" style={{ marginTop: 10 }}>Ticket and margin are HUMAN_ASSUMED and drive D and F. Wave 1 exists partly to replace them with observed values.
          {v.renterEvidence?.note ? ` ${v.renterEvidence.note}` : ""}</p>
      </div>

      <div className="sec">
        <h3>Expansion surface <Badge status={v.expansion.verdict} /></h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: "80ch" }}>{v.expansion.explanation}</p>
        <div className="kv" style={{ marginTop: 12 }}>
          <div><label>Viable services</label><b>{v.expansion.evidence.viableServiceCount}</b></div>
          <div><label>Viable areas</label><b>{v.expansion.evidence.viableAreaCount}</b></div>
          <div><label>Service × Area pages</label><b>{v.expansion.evidence.viableCombinations}</b></div>
          <div><label>Demand covered</label><b>{num(v.expansion.evidence.demandCoveredPerMonth)}/mo</b></div>
        </div>
        {v.expansion.evidence.primaryServices.length > 1 && (
          <p className="note" style={{ marginTop: 10 }}><b>Strongest expansions:</b>{" "}
            {v.expansion.evidence.primaryServices.slice(1, 6).map((s) => `${s.service} (${s.volume ?? "?"}/mo)`).join(" · ")}</p>)}
        {v.expansion.evidence.notes.map((n, i) => <p className="note" key={i} style={{ marginTop: 6 }}>{n}</p>)}
      </div>

      <div className="sec">
        <h3>Proposed site map — {v.architecture.estimatedPages} legitimate pages</h3>
        <div className="tree"><Tree node={v.architecture.tree} /></div>
        <p className="note" style={{ marginTop: 12 }}><b>Clusters:</b> {v.architecture.clusters.join(" · ")}</p>
        <p className="note"><b>Internal linking:</b> {v.architecture.internalLinking.join("; ")}.</p>
        <p className="note" style={{ marginTop: 8 }}>Investment-planning artifact only — not permission to generate pages.</p>
      </div>

      <div className="sec">
        <h3>Cannibalization risk <Badge status={v.cannibalization.verdict} /></h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: "80ch" }}>{v.cannibalization.explanation}</p>
        {v.cannibalization.evidence.conflictGroups.map((g, i) => (
          <p className="note" key={i} style={{ marginTop: 8 }}><b>{g.intent}:</b> {g.pages.join(" · ")}</p>))}
        {v.cannibalization.evidence.recommendations.map((r, i) => <div className="risk" key={i} style={{ marginTop: 8 }}>{r}</div>)}
      </div>

      <div className="sec">
        <h3>Local content depth <Badge status={v.localDepth.verdict} /> &nbsp; Visual assets <Badge status={v.visual.verdict} /></h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: "80ch" }}>{v.localDepth.explanation}</p>
        <p className="note" style={{ marginTop: 8 }}><b>Have:</b> {v.localDepth.evidence.availableSignals.join(" · ") || "none"}</p>
        <p className="note"><b>Missing (must not be fabricated at build time):</b> {v.localDepth.evidence.missingSignals.join(" · ")}</p>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 12, maxWidth: "80ch" }}>{v.visual.explanation}</p>
        <p className="note"><b>Suggested assets:</b> {v.visual.evidence.suggestedAssets.join(" · ")}</p>
      </div>

      <div className="sec">
        <h3>Domain</h3>
        <div className="kv">
          <div><label>Preferred</label><b style={{ fontSize: 13 }}>{a.preferredDomain || "—"}</b></div>
          <div><label>Verified at freeze</label><b style={{ fontSize: 13 }}>{a.domainVerifiedAtFreeze === true ? "available" : a.domainVerifiedAtFreeze === false ? "taken" : "unknown"}</b></div>
          <div><label>Architecture</label><b style={{ fontSize: 12 }}>{a.urlArchitecture || "—"}</b></div>
        </div>
        <p className="note" style={{ marginTop: 8 }}>Not purchased. Availability decays — re-check immediately before buying.</p>
      </div>

      <div className="sec">
        <h3>Evidence &amp; provenance</h3>
        <div className="prov">
          {Object.entries(a.evidenceRefs || {}).map(([k, val]) => (
            <div key={k}>{k}: {typeof val === "object" ? JSON.stringify(val) : String(val)}</div>))}
          <div>validation: {v.version} · intent {v.intent.version} · confidence {v.intent.confidence.toFixed(2)}</div>
          <div>scoring: {a.dimensionAVersion || "ai-v1.0.0"} · organic {a.organicVersion || "organic-v1.2"}</div>
        </div>
      </div>

      {a.successCondition && (
        <div className="sec">
          <h3>Pre-registered outcome conditions</h3>
          <p className="note"><b>Success:</b> {a.successCondition}</p>
          <p className="note" style={{ marginTop: 6 }}><b>Failure:</b> {a.failureCondition}</p>
        </div>)}
    </div>
  );
}
